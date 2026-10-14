"""Bluebuild launchpad: launch a pump.fun coin for a design.

How it works
------------
* The design's owner fills in the coin details on the design page.
* POST /launchpad/projects/<id>/prepare checks the details, stores the logo and
  the metadata JSON in public storage, and records a "prepared" launch.
* The browser builds the pump.fun create transaction with the official
  @pump-fun/pump-sdk, the user's own wallet signs and pays for it, and
  POST /launchpad/launches/<id>/confirm checks the transaction on-chain before
  marking the launch "launched".

Bluebuild takes no fee and never holds keys or funds. The launchpad is OFF
unless BLUEBUILD_LAUNCHPAD=on; every limit is an environment variable (see
.env.example).
"""

from __future__ import annotations

import datetime as dt
import json
import logging
import os
import re
import sqlite3
import threading
import uuid
from contextlib import contextmanager
from dataclasses import dataclass
from typing import Any, Dict, Iterator, List, Optional
from urllib.parse import quote, urlparse

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import FileResponse
from pydantic import BaseModel
from starlette.concurrency import run_in_threadpool

from apps.api.auth import UserContext, deployed_auth_required, optional_user_context, require_user_context
from apps.api.bluebuild_tiers import BASE58_RE, _rpc, rpc_url, wallet_for_user
from forma_core.config import config
from forma_core.safe_images import UnsafeImageError, sanitize_inline_image


logger = logging.getLogger(__name__)

PUMP_PROGRAM_ID = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P"
METADATA_BUCKET = "coin-metadata"
MAX_IMAGE_BYTES = 1_500_000
RESERVED_TERMS = ("bluebuild", "blueprint")
RPC_METHODS = {
    "getAccountInfo",
    "getBalance",
    "getBlockHeight",
    "getLatestBlockhash",
    "getMinimumBalanceForRentExemption",
    "getMultipleAccounts",
    "getSignatureStatuses",
    "sendTransaction",
    "simulateTransaction",
}
SYMBOL_RE = re.compile(r"^[A-Z0-9]{1,10}$")
HANDLE_RE = re.compile(r"^@?([A-Za-z0-9_]{1,15})$")
TELEGRAM_HANDLE_RE = re.compile(r"^@?([A-Za-z0-9_]{5,32})$")
SIGNATURE_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{64,90}$")


# ---------------------------------------------------------------- settings

def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = config.get(name)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return default


def _number(name: str, default: float) -> float:
    try:
        return max(0.0, float(_env(name, str(default)) or default))
    except ValueError:
        return default


def launchpad_enabled() -> bool:
    return (_env("BLUEBUILD_LAUNCHPAD", "off") or "off").lower() in {"on", "true", "1", "yes"}


def launches_per_day() -> int:
    return int(_number("BLUEBUILD_LAUNCHES_PER_DAY", 3))


def max_initial_buy_sol() -> float:
    return _number("BLUEBUILD_LAUNCH_MAX_BUY_SOL", 5)


def blocked_terms() -> List[str]:
    extra = [term.strip().lower() for term in (_env("BLUEBUILD_LAUNCH_BLOCKLIST", "") or "").split(",")]
    return [term for term in extra if term]


# ---------------------------------------------------------------- validation

class LaunchValidationError(ValueError):
    pass


@dataclass
class LaunchDetails:
    name: str
    symbol: str
    description: str
    website: Optional[str]
    twitter: Optional[str]
    telegram: Optional[str]
    mint: str
    creator_wallet: str
    initial_buy_sol: float
    image_bytes: bytes
    image_type: str
    image_ext: str


def _clean_text(value: Any, limit: int) -> str:
    text = re.sub(r"\s+", " ", str(value or "")).strip()
    return text[:limit]


def _contains_term(text: str, term: str) -> bool:
    return re.search(rf"(?<![a-z0-9]){re.escape(term)}(?![a-z0-9])", text.lower()) is not None


def _https_url(value: str, field: str, hosts: Optional[set[str]] = None) -> str:
    parsed = urlparse(value if "://" in value else f"https://{value}")
    host = (parsed.hostname or "").lower()
    if parsed.scheme not in {"https", "http"} or not host or "." not in host:
        raise LaunchValidationError(f"{field} must be a web address like https://example.com.")
    if hosts is not None and host.removeprefix("www.") not in hosts:
        raise LaunchValidationError(f"{field} must be a {sorted(hosts)[0]} link.")
    if len(value) > 200:
        raise LaunchValidationError(f"{field} is too long.")
    return parsed._replace(scheme="https").geturl()


def normalize_website(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    return _https_url(text, "Website") if text else None


def normalize_twitter(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    handle = HANDLE_RE.match(text)
    if handle:
        return f"https://x.com/{handle.group(1)}"
    return _https_url(text, "X / Twitter", {"x.com", "twitter.com"}).replace("://twitter.com", "://x.com").replace(
        "://www.twitter.com", "://x.com"
    )


def normalize_telegram(value: Any) -> Optional[str]:
    text = str(value or "").strip()
    if not text:
        return None
    handle = TELEGRAM_HANDLE_RE.match(text)
    if handle:
        return f"https://t.me/{handle.group(1)}"
    return _https_url(text, "Telegram", {"t.me", "telegram.me"})


def decode_image(data_url: Any) -> tuple[bytes, str, str]:
    """Verify and re-encode the logo so only clean PNG or JPEG pixels are ever published."""
    text = str(data_url or "")
    if not text.startswith("data:image/"):
        raise LaunchValidationError("Choose a logo image for the coin.")
    try:
        safe = sanitize_inline_image(text, max_bytes=MAX_IMAGE_BYTES, max_dimension=2048)
    except UnsafeImageError as exc:
        raise LaunchValidationError(str(exc)) from exc
    return safe.content, safe.content_type, "png" if safe.content_type == "image/png" else "jpg"


def normalize_launch(payload: Dict[str, Any]) -> LaunchDetails:
    name = _clean_text(payload.get("name"), 32)
    symbol = _clean_text(payload.get("symbol"), 10).upper().lstrip("$")
    description = _clean_text(payload.get("description"), 500)
    if not name:
        raise LaunchValidationError("Give the coin a name.")
    if not SYMBOL_RE.match(symbol):
        raise LaunchValidationError("The ticker must be 1 to 10 letters or numbers.")
    if re.search(r"https?://|www\.", name, re.IGNORECASE):
        raise LaunchValidationError("The coin name can't contain a web address.")
    for term in RESERVED_TERMS:
        if _contains_term(name, term) or _contains_term(symbol, term):
            raise LaunchValidationError(
                f"Coin names and tickers can't use \"{term.title()}\", so nobody mistakes a community coin for an official one."
            )
    for term in blocked_terms():
        if any(_contains_term(text, term) for text in (name, symbol, description)):
            raise LaunchValidationError("That name, ticker or description isn't allowed. Please choose different wording.")

    mint = str(payload.get("mint") or "").strip()
    creator_wallet = str(payload.get("creator_wallet") or "").strip()
    if not BASE58_RE.match(mint):
        raise LaunchValidationError("The coin address is missing. Please reopen the launch form.")
    if not BASE58_RE.match(creator_wallet):
        raise LaunchValidationError("Connect your wallet first.")

    try:
        initial_buy = float(payload.get("initial_buy_sol") or 0)
    except (TypeError, ValueError) as exc:
        raise LaunchValidationError("The first buy must be a number of SOL.") from exc
    if initial_buy < 0 or initial_buy > max_initial_buy_sol():
        raise LaunchValidationError(f"The first buy must be between 0 and {max_initial_buy_sol():g} SOL.")

    image_bytes, image_type, image_ext = decode_image(payload.get("image_data"))
    return LaunchDetails(
        name=name,
        symbol=symbol,
        description=description,
        website=None,  # always the coin's Bluebuild pitch deck, set when the launch is prepared
        twitter=normalize_twitter(payload.get("twitter")),
        telegram=normalize_telegram(payload.get("telegram")),
        mint=mint,
        creator_wallet=creator_wallet,
        initial_buy_sol=round(initial_buy, 4),
        image_bytes=image_bytes,
        image_type=image_type,
        image_ext=image_ext,
    )


def build_metadata(details: LaunchDetails, image_url: str, created_on: Optional[str]) -> Dict[str, Any]:
    """Token metadata JSON in the shape pump.fun reads from a coin's URI."""
    metadata: Dict[str, Any] = {
        "name": details.name,
        "symbol": details.symbol,
        "description": details.description,
        "image": image_url,
        "showName": True,
    }
    if created_on:
        metadata["createdOn"] = created_on
    for key in ("website", "twitter", "telegram"):
        value = getattr(details, key)
        if value:
            metadata[key] = value
    return metadata


# ---------------------------------------------------------------- on-chain verification

_B58_ALPHABET = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58decode(value: str) -> bytes:
    number = 0
    for char in value:
        number = number * 58 + _B58_ALPHABET.index(char)
    body = number.to_bytes((number.bit_length() + 7) // 8, "big") if number else b""
    return b"\x00" * (len(value) - len(value.lstrip("1"))) + body


def verify_launch_transaction(transaction: Optional[Dict[str, Any]], *, mint: str, creator: str, metadata_uri: str) -> Optional[str]:
    """Return None when the transaction is a successful pump.fun create of this coin, else the reason it isn't."""
    if not transaction:
        return "pending"
    meta = transaction.get("meta") or {}
    if meta.get("err") is not None:
        return "The launch transaction failed on-chain."
    message = (transaction.get("transaction") or {}).get("message") or {}
    keys = list(message.get("accountKeys") or [])
    loaded = meta.get("loadedAddresses") or {}
    keys += list(loaded.get("writable") or []) + list(loaded.get("readonly") or [])
    if not keys or keys[0] != creator:
        return "The transaction wasn't paid for by the connected wallet."
    if mint not in keys:
        return "The transaction doesn't create this coin."
    uri_bytes = metadata_uri.encode("utf-8")
    for instruction in message.get("instructions") or []:
        index = instruction.get("programIdIndex")
        if not isinstance(index, int) or index >= len(keys) or keys[index] != PUMP_PROGRAM_ID:
            continue
        try:
            data = b58decode(str(instruction.get("data") or ""))
        except ValueError:
            continue
        if uri_bytes in data:
            return None
    return "The transaction isn't a pump.fun launch of this coin's details."


def fetch_transaction(signature: str) -> Optional[Dict[str, Any]]:
    return _rpc(
        "getTransaction",
        [signature, {"encoding": "json", "commitment": "confirmed", "maxSupportedTransactionVersion": 0}],
    )


# ---------------------------------------------------------------- storage

LAUNCH_FIELDS = (
    "id", "project_id", "owner_user_id", "creator_wallet", "mint", "name", "symbol", "description", "website",
    "twitter", "telegram", "image_url", "metadata_uri", "initial_buy_sol", "status", "signature", "pitch", "hidden",
    "created_at", "launched_at",
)


def _utc_now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat()


class _SupabaseLaunchStore:
    def __init__(self, client: Any, supabase_url: str) -> None:
        self.client = client
        self.supabase_url = supabase_url.rstrip("/")

    def put_file(self, key: str, content: bytes, content_type: str) -> str:
        self.client.storage.from_(METADATA_BUCKET).upload(
            key, content, file_options={"content-type": content_type, "cache-control": "31536000", "upsert": "false"}
        )
        return f"{self.supabase_url}/storage/v1/object/public/{METADATA_BUCKET}/{quote(key)}"

    def insert(self, row: Dict[str, Any]) -> None:
        self.client.table("bluebuild_coin_launches").insert(row).execute()

    def get(self, launch_id: str) -> Optional[Dict[str, Any]]:
        rows = self.client.table("bluebuild_coin_launches").select("*").eq("id", launch_id).limit(1).execute().data or []
        return rows[0] if rows else None

    def by_mint(self, mint: str) -> Optional[Dict[str, Any]]:
        rows = self.client.table("bluebuild_coin_launches").select("*").eq("mint", mint).limit(1).execute().data or []
        return rows[0] if rows else None

    def for_project(self, project_id: str) -> List[Dict[str, Any]]:
        return (
            self.client.table("bluebuild_coin_launches").select("*").eq("project_id", project_id)
            .order("created_at", desc=True).limit(20).execute().data or []
        )

    def count_since(self, owner_user_id: str, since: str, status_value: Optional[str] = None) -> int:
        query = (
            self.client.table("bluebuild_coin_launches").select("id", count="exact")
            .eq("owner_user_id", owner_user_id).gte("created_at", since)
        )
        if status_value:
            query = query.eq("status", status_value)
        return int(query.execute().count or 0)

    def mark(self, launch_id: str, values: Dict[str, Any]) -> None:
        self.client.table("bluebuild_coin_launches").update(values).eq("id", launch_id).execute()


class _SQLiteLaunchStore:
    """Local-development storage so the launch flow can be tried without Supabase."""

    def __init__(self, directory: str, public_base: str) -> None:
        os.makedirs(os.path.join(directory, "files"), exist_ok=True)
        self.directory = directory
        self.public_base = public_base.rstrip("/")
        self._lock = threading.Lock()
        with self._connect() as db:
            db.execute(
                "create table if not exists bluebuild_coin_launches ("
                + ", ".join(f"{field} text" for field in LAUNCH_FIELDS)
                + ", primary key (id))"
            )

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(os.path.join(self.directory, "launchpad.db"), timeout=10, isolation_level=None)
        connection.row_factory = sqlite3.Row
        try:
            yield connection
        finally:
            connection.close()

    def file_path(self, key: str) -> Optional[str]:
        if not re.match(r"^[0-9a-f-]{36}(-image-[0-9])?\.(png|jpg|json)$", key):
            return None
        path = os.path.join(self.directory, "files", key)
        return path if os.path.exists(path) else None

    def put_file(self, key: str, content: bytes, content_type: str) -> str:
        with open(os.path.join(self.directory, "files", key), "wb") as handle:
            handle.write(content)
        return f"{self.public_base}/launchpad/files/{quote(key)}"

    def insert(self, row: Dict[str, Any]) -> None:
        with self._lock, self._connect() as db:
            if row.get("status") == "launched" and db.execute(
                "select 1 from bluebuild_coin_launches where project_id=? and status='launched'", (row["project_id"],)
            ).fetchone():
                raise RuntimeError("duplicate launched coin for project")
            fields = [field for field in LAUNCH_FIELDS if field in row]
            db.execute(
                f"insert into bluebuild_coin_launches ({', '.join(fields)}) values ({', '.join('?' for _ in fields)})",
                [self._encode(row[field]) for field in fields],
            )

    @staticmethod
    def _encode(value: Any) -> Any:
        return json.dumps(value) if isinstance(value, (bool, dict, list)) else value

    @staticmethod
    def _row(row: sqlite3.Row) -> Dict[str, Any]:
        record = dict(row)
        record["hidden"] = record.get("hidden") in {"true", "1", 1, True}
        if record.get("initial_buy_sol") is not None:
            record["initial_buy_sol"] = float(record["initial_buy_sol"])
        if isinstance(record.get("pitch"), str):
            record["pitch"] = json.loads(record["pitch"])
        return record

    def by_mint(self, mint: str) -> Optional[Dict[str, Any]]:
        with self._connect() as db:
            row = db.execute("select * from bluebuild_coin_launches where mint=?", (mint,)).fetchone()
        return self._row(row) if row else None

    def get(self, launch_id: str) -> Optional[Dict[str, Any]]:
        with self._connect() as db:
            row = db.execute("select * from bluebuild_coin_launches where id=?", (launch_id,)).fetchone()
        return self._row(row) if row else None

    def for_project(self, project_id: str) -> List[Dict[str, Any]]:
        with self._connect() as db:
            rows = db.execute(
                "select * from bluebuild_coin_launches where project_id=? order by created_at desc limit 20", (project_id,)
            ).fetchall()
        return [self._row(row) for row in rows]

    def count_since(self, owner_user_id: str, since: str, status_value: Optional[str] = None) -> int:
        query = "select count(*) from bluebuild_coin_launches where owner_user_id=? and created_at>=?"
        params: List[Any] = [owner_user_id, since]
        if status_value:
            query += " and status=?"
            params.append(status_value)
        with self._connect() as db:
            return int(db.execute(query, params).fetchone()[0])

    def mark(self, launch_id: str, values: Dict[str, Any]) -> None:
        with self._lock, self._connect() as db:
            if values.get("status") == "launched":
                row = db.execute("select project_id from bluebuild_coin_launches where id=?", (launch_id,)).fetchone()
                if row and db.execute(
                    "select 1 from bluebuild_coin_launches where project_id=? and status='launched' and id<>?",
                    (row["project_id"], launch_id),
                ).fetchone():
                    raise RuntimeError("duplicate launched coin for project")
            assignments = ", ".join(f"{field}=?" for field in values)
            db.execute(
                f"update bluebuild_coin_launches set {assignments} where id=?",
                [*(self._encode(value) for value in values.values()), launch_id],
            )


_STORE: Any = None
_STORE_LOCK = threading.Lock()


def store() -> Any:
    global _STORE
    with _STORE_LOCK:
        if _STORE is None:
            from forma_core import database

            if database.DATABASE_BACKEND == "supabase":
                _STORE = _SupabaseLaunchStore(database.get_supabase_client(), _env("SUPABASE_URL", "") or "")
            else:
                _STORE = _SQLiteLaunchStore(
                    _env("BLUEBUILD_LAUNCHPAD_DIR", os.path.join(".forma", "launchpad")) or ".forma/launchpad",
                    _env("BLUEBUILD_LAUNCHPAD_PUBLIC_BASE", "http://localhost:8000") or "http://localhost:8000",
                )
        return _STORE


# ---------------------------------------------------------------- endpoints

router = APIRouter()


class ConfirmLaunchRequest(BaseModel):
    signature: str


def public_launch(record: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "id": record["id"],
        "project_id": record["project_id"],
        "mint": record["mint"],
        "name": record["name"],
        "symbol": record["symbol"],
        "description": record.get("description") or "",
        "image_url": record["image_url"],
        "metadata_uri": record["metadata_uri"],
        "website": record.get("website"),
        "twitter": record.get("twitter"),
        "telegram": record.get("telegram"),
        "creator_wallet": record["creator_wallet"],
        "status": record["status"],
        "signature": record.get("signature"),
        "launched_at": record.get("launched_at"),
        "pump_url": f"https://pump.fun/coin/{record['mint']}",
        "product_page_path": f"/coin/{record['mint']}",
    }


def _bad_request(message: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail={"code": "launch_invalid", "message": message})


def _require_enabled() -> None:
    if not launchpad_enabled():
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "launchpad_disabled", "message": "Coin launches aren't open yet."},
        )


def _resolve_owner(project_id: str, user: UserContext) -> Any:
    from apps.api.main import _resolve_project_owner

    return _resolve_project_owner(project_id, user)


def _resolve_reader(project_id: str, user: UserContext) -> Any:
    from apps.api.main import _resolve_project_reader

    return _resolve_project_reader(project_id, user)


@router.get("/launchpad/projects/{project_id}")
async def launchpad_project(project_id: str, user: UserContext = Depends(optional_user_context)) -> Dict[str, Any]:
    project = await run_in_threadpool(_resolve_reader, project_id, user)
    owner_id = getattr(project, "owner_user_id", None) if not isinstance(project, dict) else project.get("owner_user_id")
    is_owner = bool(user.owner_user_id and owner_id == user.owner_user_id)
    enabled = launchpad_enabled()
    launched: Optional[Dict[str, Any]] = None
    if enabled:
        try:
            records = await run_in_threadpool(store().for_project, project_id)
        except Exception:
            logger.exception("Launchpad lookup failed for project %s", project_id)
            records = []
        launched = next((record for record in records if record["status"] == "launched" and not record.get("hidden")), None)
    return {
        "enabled": enabled,
        "launch": public_launch(launched) if launched else None,
        "can_launch": enabled and is_owner and launched is None,
        "max_initial_buy_sol": max_initial_buy_sol(),
    }


@router.post("/launchpad/projects/{project_id}/prepare")
async def prepare_launch(project_id: str, request: Request, user: UserContext = Depends(require_user_context)) -> Dict[str, Any]:
    _require_enabled()
    project = await run_in_threadpool(_resolve_owner, project_id, user)
    try:
        details = normalize_launch(await request.json())
    except LaunchValidationError as exc:
        raise _bad_request(str(exc)) from exc
    except ValueError as exc:
        raise _bad_request("The launch details could not be read.") from exc

    if deployed_auth_required():
        signed_in_wallet = await run_in_threadpool(wallet_for_user, user.owner_user_id)
        if signed_in_wallet != details.creator_wallet:
            raise _bad_request("Connect the same wallet you signed in to Bluebuild with.")

    db = store()
    records = await run_in_threadpool(db.for_project, project_id)
    if any(record["status"] == "launched" for record in records):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "launch_exists", "message": "This design already has a coin."},
        )
    since = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(days=1)).isoformat()
    owner_id = str(user.owner_user_id)
    launched_today = await run_in_threadpool(db.count_since, owner_id, since, "launched")
    attempts_today = await run_in_threadpool(db.count_since, owner_id, since)
    if launched_today >= launches_per_day() or attempts_today >= launches_per_day() * 5:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={"code": "launch_limit", "message": "You've reached today's coin launch limit. Please try again tomorrow."},
        )

    launch_id = str(uuid.uuid4())
    created_on = (_env("BLUEBUILD_PUBLIC_SITE_URL") or request.headers.get("origin") or "").rstrip("/")
    if not created_on:
        raise _bad_request("Couldn't work out this site's address for the pitch deck. Please reload and try again.")
    # Every coin's website is its own pitch deck; creators can't change or remove it.
    details.website = f"{created_on}/coin/{details.mint}"
    try:
        pitch = await run_in_threadpool(_build_pitch_deck, project_id, user, launch_id, details.name)
    except Exception as exc:
        logger.exception("Pitch deck build failed for project %s", project_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "pitch_deck_failed", "message": "Couldn't build the pitch deck for this coin. Please try again."},
        ) from exc
    try:
        image_url = await run_in_threadpool(
            db.put_file, f"{launch_id}.{details.image_ext}", details.image_bytes, details.image_type
        )
        metadata = build_metadata(details, image_url, created_on)
        metadata_uri = await run_in_threadpool(
            db.put_file, f"{launch_id}.json", json.dumps(metadata, ensure_ascii=False).encode("utf-8"), "application/json"
        )
        await run_in_threadpool(db.insert, {
            "id": launch_id,
            "project_id": getattr(project, "project_id", None) or project_id,
            "owner_user_id": owner_id,
            "creator_wallet": details.creator_wallet,
            "mint": details.mint,
            "name": details.name,
            "symbol": details.symbol,
            "description": details.description,
            "website": details.website,
            "twitter": details.twitter,
            "telegram": details.telegram,
            "image_url": image_url,
            "metadata_uri": metadata_uri,
            "initial_buy_sol": details.initial_buy_sol,
            "pitch": pitch,
            "status": "prepared",
            "created_at": _utc_now(),
        })
    except Exception as exc:
        logger.exception("Launch preparation failed for project %s", project_id)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail={"code": "launch_storage_failed", "message": "Couldn't save the coin details. Please try again."},
        ) from exc
    return {
        "launch_id": launch_id,
        "metadata_uri": metadata_uri,
        "name": details.name,
        "symbol": details.symbol,
        "initial_buy_sol": details.initial_buy_sol,
    }


@router.post("/launchpad/launches/{launch_id}/confirm")
async def confirm_launch(
    launch_id: str,
    body: ConfirmLaunchRequest,
    user: UserContext = Depends(require_user_context),
) -> Dict[str, Any]:
    db = store()
    record = await run_in_threadpool(db.get, launch_id)
    if not record or record["owner_user_id"] != user.owner_user_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Launch not found.")
    if record["status"] == "launched":
        return {"status": "launched", "launch": public_launch(record)}
    signature = body.signature.strip()
    if not SIGNATURE_RE.match(signature):
        raise _bad_request("That transaction signature isn't valid.")
    try:
        transaction = await run_in_threadpool(fetch_transaction, signature)
    except Exception as exc:
        logger.warning("Launch confirmation lookup failed for %s: %s", launch_id, exc)
        return {"status": "pending"}
    problem = verify_launch_transaction(
        transaction, mint=record["mint"], creator=record["creator_wallet"], metadata_uri=record["metadata_uri"]
    )
    if problem == "pending":
        return {"status": "pending"}
    if problem:
        await run_in_threadpool(db.mark, launch_id, {"status": "failed", "signature": signature})
        raise _bad_request(problem)
    values = {"status": "launched", "signature": signature, "launched_at": _utc_now()}
    try:
        await run_in_threadpool(db.mark, launch_id, values)
    except Exception as exc:
        logger.exception("Could not record launch %s", launch_id)
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "launch_exists", "message": "This design already has a coin recorded."},
        ) from exc
    if not record.get("pitch"):
        # Launches prepared before decks were built up front still get one.
        try:
            values["pitch"] = await run_in_threadpool(
                _build_pitch_deck, record["project_id"], user, record["id"], record["name"]
            )
            await run_in_threadpool(db.mark, launch_id, {"pitch": values["pitch"]})
        except Exception:
            logger.exception("Pitch deck build failed for launch %s", launch_id)
    return {"status": "launched", "launch": public_launch({**record, **values})}


def _build_pitch_deck(project_id: str, user: UserContext, launch_id: str, coin_name: str) -> Dict[str, Any]:
    """Snapshot the design into the coin's pitch deck before it launches."""
    from apps.api.bluebuild_pitch import build_pitch
    from apps.api.main import get_project_endpoint

    ir = get_project_endpoint(project_id, user).get("project_ir") or {}
    return build_pitch(
        ir,
        project_id=project_id,
        coin_name=coin_name,
        put_file=store().put_file,
        key_prefix=f"{launch_id}-image",
    )


@router.get("/launchpad/coins/{mint}")
async def coin_product_page(mint: str) -> Dict[str, Any]:
    """Public product page data for a launched coin."""
    if not BASE58_RE.match(mint):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coin not found.")
    record = await run_in_threadpool(store().by_mint, mint)
    if not record or record["status"] != "launched" or record.get("hidden"):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Coin not found.")
    return {"launch": public_launch(record), "pitch": record.get("pitch")}


@router.post("/launchpad/rpc")
async def launchpad_rpc(request: Request, user: UserContext = Depends(require_user_context)) -> Any:
    """Narrow Solana JSON-RPC relay so the browser can build and send its launch without our RPC key."""
    _require_enabled()
    url = rpc_url()
    if not url:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail="Solana RPC is not configured.")
    try:
        payload = await request.json()
    except ValueError as exc:
        raise _bad_request("Invalid RPC request.") from exc
    calls = payload if isinstance(payload, list) else [payload]
    if not calls or len(calls) > 10 or any(
        not isinstance(call, dict) or call.get("method") not in RPC_METHODS for call in calls
    ):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="That RPC method isn't available.")
    async with httpx.AsyncClient(timeout=20) as client:
        response = await client.post(url, json=payload)
    return response.json()


@router.get("/launchpad/files/{key}")
async def launchpad_file(key: str) -> Any:
    """Serves metadata in local development; production files live in public Supabase storage."""
    db = store()
    path = db.file_path(key) if isinstance(db, _SQLiteLaunchStore) else None
    if not path:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found.")
    media_type = "application/json" if key.endswith(".json") else f"image/{'jpeg' if key.endswith('.jpg') else key.rsplit('.', 1)[1]}"
    return FileResponse(path, media_type=media_type)


__all__ = ["router", "normalize_launch", "verify_launch_transaction", "build_metadata"]
