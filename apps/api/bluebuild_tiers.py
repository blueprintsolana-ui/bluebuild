"""Bluebuild: daily design allowances based on $BLUEBUILD holdings.

How it works
------------
* People sign in with their Solana wallet through Clerk ("Sign in with Solana").
* Each new design (POST /generate) or change (POST /projects/<id>/iterate)
  uses one design from today's allowance.
* A wallet's tier for the day uses the LOWER of:
    - what it held at today's snapshot (taken once per UTC day), and
    - what it holds right now.
  So tokens moved into a fresh wallet don't count until the next day, and
  selling during the day lowers the tier straight away.
* Wallets below the first tier get the free taster, which is also limited per
  network connection and by a site-wide free pool.
* A site-wide daily cap protects the API bill no matter what.
* Failed generations give the design back.

Everything is configured with environment variables (see .env.example).
Gating is OFF unless BLUEBUILD_GATING=on.
"""

from __future__ import annotations

import datetime as dt
import hashlib
import logging
import os
import re
import sqlite3
import threading
import time
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, List, Optional, Tuple

import httpx
from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from starlette.concurrency import run_in_threadpool
from starlette.middleware.base import BaseHTTPMiddleware

from apps.api.auth import UserContext, _clerk_secret_key, optional_user_context
from forma_core.config import config


logger = logging.getLogger(__name__)

DEFAULT_TIERS = "100000:10,1000000:20,5000000:40,10000000:75"
BASE58_RE = re.compile(r"^[1-9A-HJ-NP-Za-km-z]{32,44}$")
GATED_PATH_RE = re.compile(r"^(/api)?/(generate|projects/[^/]+/iterate)/?$")
SNAPSHOT_STALE_SECONDS = 600


# ---------------------------------------------------------------- settings

def _env(name: str, default: Optional[str] = None) -> Optional[str]:
    value = config.get(name)
    if isinstance(value, str) and value.strip():
        return value.strip()
    return default


def _int(name: str, default: int) -> int:
    try:
        return max(0, int(_env(name, str(default)) or default))
    except ValueError:
        return default


def gating_enabled() -> bool:
    return (_env("BLUEBUILD_GATING", "off") or "off").lower() in {"on", "true", "1", "yes"}


def token_mint() -> Optional[str]:
    mint = _env("BLUEBUILD_TOKEN_MINT")
    return mint if mint and BASE58_RE.match(mint) else None


def rpc_url() -> Optional[str]:
    explicit = _env("SOLANA_RPC_URL")
    if explicit:
        return explicit
    key = _env("HELIUS_API_KEY")
    return f"https://mainnet.helius-rpc.com/?api-key={key}" if key else None


def tiers() -> List[Tuple[float, int]]:
    """(minimum tokens held, designs per day), highest first."""
    parsed: List[Tuple[float, int]] = []
    for item in (_env("BLUEBUILD_TIERS", DEFAULT_TIERS) or DEFAULT_TIERS).split(","):
        try:
            minimum, per_day = item.split(":", 1)
            parsed.append((float(minimum), int(per_day)))
        except ValueError:
            logger.warning("Ignoring malformed BLUEBUILD_TIERS entry %r", item)
    return sorted(parsed, reverse=True)


def free_per_day() -> int:
    return _int("BLUEBUILD_FREE_PER_DAY", 5)


def free_pool_per_day() -> int:
    return _int("BLUEBUILD_FREE_POOL_PER_DAY", 500)


def total_per_day() -> int:
    return _int("BLUEBUILD_TOTAL_PER_DAY", 2000)


def today() -> dt.date:
    return dt.datetime.now(dt.timezone.utc).date()


def next_reset_iso() -> str:
    tomorrow = today() + dt.timedelta(days=1)
    return dt.datetime.combine(tomorrow, dt.time(0, 0), tzinfo=dt.timezone.utc).isoformat()


def tier_for(holding: float) -> Tuple[str, int]:
    for index, (minimum, per_day) in enumerate(tiers()):
        if holding >= minimum:
            return f"tier-{len(tiers()) - index}", per_day
    return "free", 0


# ---------------------------------------------------------------- small cache

class _TTLCache:
    def __init__(self) -> None:
        self._values: Dict[str, Tuple[float, Any]] = {}
        self._lock = threading.Lock()

    def get(self, key: str, ttl: float, load: Callable[[], Any]) -> Any:
        now = time.monotonic()
        with self._lock:
            hit = self._values.get(key)
            if hit and now - hit[0] < ttl:
                return hit[1]
        value = load()
        with self._lock:
            self._values[key] = (now, value)
        return value


_CACHE = _TTLCache()


# ---------------------------------------------------------------- Clerk + Solana

def wallet_for_user(user_id: Optional[str]) -> Optional[str]:
    """The verified Solana address on this Clerk user, if any."""
    if not user_id:
        return None

    def load() -> Optional[str]:
        secret = _clerk_secret_key()
        if not secret:
            return None
        try:
            response = httpx.get(
                f"https://api.clerk.com/v1/users/{user_id}",
                headers={"Authorization": f"Bearer {secret}", "Accept": "application/json"},
                timeout=6,
            )
            response.raise_for_status()
            payload = response.json()
        except Exception:
            logger.warning("Could not load Clerk user for wallet lookup", exc_info=True)
            raise
        wallets = payload.get("web3_wallets") or []
        primary_id = payload.get("primary_web3_wallet_id")
        ordered = sorted(wallets, key=lambda w: 0 if w.get("id") == primary_id else 1)
        for wallet in ordered:
            address = str(wallet.get("web3_wallet") or "").strip()
            status = ((wallet.get("verification") or {}).get("status") or "").lower()
            if BASE58_RE.match(address) and status == "verified":
                return address
        return None

    return _CACHE.get(f"wallet:{user_id}", 600, load)


def _rpc(method: str, params: Any) -> Any:
    url = rpc_url()
    if not url:
        raise RuntimeError("Set HELIUS_API_KEY (or SOLANA_RPC_URL) to read token balances.")
    response = httpx.post(
        url,
        json={"jsonrpc": "2.0", "id": "bluebuild", "method": method, "params": params},
        timeout=10,
    )
    response.raise_for_status()
    body = response.json()
    if body.get("error"):
        raise RuntimeError(f"Solana RPC error from {method}: {body['error']}")
    return body.get("result")


def live_balance(owner: str) -> float:
    mint = token_mint()
    if not mint:
        return 0.0

    def load() -> float:
        result = _rpc(
            "getTokenAccountsByOwner",
            [owner, {"mint": mint}, {"encoding": "jsonParsed", "commitment": "confirmed"}],
        )
        total = 0.0
        for account in (result or {}).get("value", []):
            amount = account["account"]["data"]["parsed"]["info"]["tokenAmount"]
            total += float(amount.get("uiAmountString") or amount.get("uiAmount") or 0)
        return total

    return _CACHE.get(f"balance:{owner}", 30, load)


def fetch_all_holders() -> Dict[str, float]:
    """Every wallet's $BLUEBUILD balance right now (Helius getTokenAccounts)."""
    mint = token_mint()
    if not mint:
        return {}
    decimals = int(((_rpc("getTokenSupply", [mint]) or {}).get("value") or {}).get("decimals", 6))
    holders: Dict[str, float] = {}
    for page in range(1, 501):
        result = _rpc("getTokenAccounts", {"mint": mint, "page": page, "limit": 1000}) or {}
        accounts = result.get("token_accounts") or []
        for account in accounts:
            owner = account.get("owner")
            amount = float(account.get("amount") or 0) / (10 ** decimals)
            if owner and amount > 0:
                holders[owner] = holders.get(owner, 0.0) + amount
        if len(accounts) < 1000:
            break
    return holders


# ---------------------------------------------------------------- storage

class _SupabaseStore:
    def __init__(self, client: Any) -> None:
        self.client = client

    def consume(self, day: dt.date, subjects: List[str], limits: List[int]) -> Optional[str]:
        result = self.client.rpc(
            "bluebuild_consume",
            {"p_day": day.isoformat(), "p_subjects": subjects, "p_limits": limits},
        ).execute()
        return result.data or None

    def refund(self, day: dt.date, subjects: List[str]) -> None:
        self.client.rpc("bluebuild_refund", {"p_day": day.isoformat(), "p_subjects": subjects}).execute()

    def used(self, day: dt.date, subjects: List[str]) -> Dict[str, int]:
        rows = (
            self.client.table("bluebuild_usage")
            .select("subject,used")
            .eq("day", day.isoformat())
            .in_("subject", subjects)
            .execute()
            .data
            or []
        )
        return {row["subject"]: int(row["used"]) for row in rows}

    def latest_finished_day(self, day: dt.date) -> Optional[dt.date]:
        rows = (
            self.client.table("bluebuild_snapshot_runs")
            .select("day")
            .lte("day", day.isoformat())
            .not_.is_("finished_at", "null")
            .order("day", desc=True)
            .limit(1)
            .execute()
            .data
            or []
        )
        return dt.date.fromisoformat(rows[0]["day"]) if rows else None

    def snapshot_amount(self, day: dt.date, owner: str) -> float:
        rows = (
            self.client.table("bluebuild_snapshots")
            .select("amount")
            .eq("day", day.isoformat())
            .eq("owner", owner)
            .limit(1)
            .execute()
            .data
            or []
        )
        return float(rows[0]["amount"]) if rows else 0.0

    def claim_snapshot(self, day: dt.date) -> bool:
        stale_before = (dt.datetime.now(dt.timezone.utc) - dt.timedelta(seconds=SNAPSHOT_STALE_SECONDS)).isoformat()
        (
            self.client.table("bluebuild_snapshot_runs")
            .delete()
            .eq("day", day.isoformat())
            .is_("finished_at", "null")
            .lt("started_at", stale_before)
            .execute()
        )
        inserted = (
            self.client.table("bluebuild_snapshot_runs")
            .upsert({"day": day.isoformat()}, on_conflict="day", ignore_duplicates=True)
            .execute()
            .data
        )
        return bool(inserted)

    def release_snapshot(self, day: dt.date) -> None:
        self.client.table("bluebuild_snapshot_runs").delete().eq("day", day.isoformat()).is_("finished_at", "null").execute()

    def finish_snapshot(self, day: dt.date, holders: Dict[str, float]) -> None:
        rows = [{"day": day.isoformat(), "owner": owner, "amount": amount} for owner, amount in holders.items()]
        for start in range(0, len(rows), 500):
            self.client.table("bluebuild_snapshots").upsert(rows[start:start + 500], on_conflict="day,owner").execute()
        (
            self.client.table("bluebuild_snapshot_runs")
            .update({"finished_at": dt.datetime.now(dt.timezone.utc).isoformat(), "holders": len(rows)})
            .eq("day", day.isoformat())
            .execute()
        )


class _SQLiteStore:
    """Local-development storage so the tiers can be tried without Supabase."""

    def __init__(self, path: str) -> None:
        os.makedirs(os.path.dirname(path) or ".", exist_ok=True)
        self.path = path
        self._lock = threading.Lock()
        with self._connect() as db:
            db.executescript(
                """
                create table if not exists bluebuild_usage (day text, subject text, used integer not null default 0,
                    primary key (day, subject));
                create table if not exists bluebuild_snapshots (day text, owner text, amount real,
                    primary key (day, owner));
                create table if not exists bluebuild_snapshot_runs (day text primary key, started_at real,
                    finished_at real, holders integer);
                """
            )

    def _connect(self) -> sqlite3.Connection:
        return sqlite3.connect(self.path, timeout=10, isolation_level=None)

    def consume(self, day: dt.date, subjects: List[str], limits: List[int]) -> Optional[str]:
        with self._lock, self._connect() as db:
            db.execute("begin immediate")
            try:
                for subject, limit in zip(subjects, limits):
                    row = db.execute(
                        "select used from bluebuild_usage where day=? and subject=?", (day.isoformat(), subject)
                    ).fetchone()
                    if (row[0] if row else 0) >= limit:
                        db.execute("rollback")
                        return subject
                for subject in subjects:
                    db.execute(
                        "insert into bluebuild_usage (day, subject, used) values (?, ?, 1) "
                        "on conflict(day, subject) do update set used = used + 1",
                        (day.isoformat(), subject),
                    )
                db.execute("commit")
                return None
            except Exception:
                db.execute("rollback")
                raise

    def refund(self, day: dt.date, subjects: List[str]) -> None:
        with self._lock, self._connect() as db:
            for subject in subjects:
                db.execute(
                    "update bluebuild_usage set used = max(used - 1, 0) where day=? and subject=?",
                    (day.isoformat(), subject),
                )

    def used(self, day: dt.date, subjects: List[str]) -> Dict[str, int]:
        with self._connect() as db:
            marks = ",".join("?" for _ in subjects)
            rows = db.execute(
                f"select subject, used from bluebuild_usage where day=? and subject in ({marks})",
                (day.isoformat(), *subjects),
            ).fetchall()
        return {subject: int(used) for subject, used in rows}

    def latest_finished_day(self, day: dt.date) -> Optional[dt.date]:
        with self._connect() as db:
            row = db.execute(
                "select day from bluebuild_snapshot_runs where day<=? and finished_at is not null "
                "order by day desc limit 1",
                (day.isoformat(),),
            ).fetchone()
        return dt.date.fromisoformat(row[0]) if row else None

    def snapshot_amount(self, day: dt.date, owner: str) -> float:
        with self._connect() as db:
            row = db.execute(
                "select amount from bluebuild_snapshots where day=? and owner=?", (day.isoformat(), owner)
            ).fetchone()
        return float(row[0]) if row else 0.0

    def claim_snapshot(self, day: dt.date) -> bool:
        with self._lock, self._connect() as db:
            db.execute(
                "delete from bluebuild_snapshot_runs where day=? and finished_at is null and started_at<?",
                (day.isoformat(), time.time() - SNAPSHOT_STALE_SECONDS),
            )
            cursor = db.execute(
                "insert or ignore into bluebuild_snapshot_runs (day, started_at) values (?, ?)",
                (day.isoformat(), time.time()),
            )
            return cursor.rowcount == 1

    def release_snapshot(self, day: dt.date) -> None:
        with self._lock, self._connect() as db:
            db.execute("delete from bluebuild_snapshot_runs where day=? and finished_at is null", (day.isoformat(),))

    def finish_snapshot(self, day: dt.date, holders: Dict[str, float]) -> None:
        with self._lock, self._connect() as db:
            db.executemany(
                "insert or replace into bluebuild_snapshots (day, owner, amount) values (?, ?, ?)",
                [(day.isoformat(), owner, amount) for owner, amount in holders.items()],
            )
            db.execute(
                "update bluebuild_snapshot_runs set finished_at=?, holders=? where day=?",
                (time.time(), len(holders), day.isoformat()),
            )


_STORE: Any = None
_STORE_LOCK = threading.Lock()


def store() -> Any:
    global _STORE
    with _STORE_LOCK:
        if _STORE is None:
            from forma_core import database

            if database.DATABASE_BACKEND == "supabase":
                _STORE = _SupabaseStore(database.get_supabase_client())
            else:
                _STORE = _SQLiteStore(_env("BLUEBUILD_SQLITE_PATH", os.path.join(".forma", "bluebuild.db")))
        return _STORE


# ---------------------------------------------------------------- snapshots + holdings

def ensure_snapshot(day: dt.date) -> None:
    """Take today's holder snapshot once. Safe to call from many requests."""
    if not token_mint():
        return
    db = store()
    if _CACHE.get(f"snapshot-done:{day}", 60, lambda: db.latest_finished_day(day) == day):
        return
    if not db.claim_snapshot(day):
        return  # someone else is taking it; yesterday's is used meanwhile
    try:
        holders = fetch_all_holders()
        db.finish_snapshot(day, holders)
        logger.info("Bluebuild snapshot for %s stored: %d holders", day, len(holders))
    except Exception:
        logger.exception("Bluebuild snapshot failed; it will be retried")
        db.release_snapshot(day)


def holding_for(owner: str, day: dt.date) -> float:
    if not token_mint():
        return 0.0
    ensure_snapshot(day)
    db = store()
    snapshot_day = db.latest_finished_day(day)
    snapshot = db.snapshot_amount(snapshot_day, owner) if snapshot_day else 0.0
    if snapshot <= 0:
        return 0.0
    return min(snapshot, live_balance(owner))


# ---------------------------------------------------------------- quota planning

@dataclass
class QuotaPlan:
    day: dt.date
    wallet: Optional[str]
    holding: float
    tier: str
    personal_limit: int
    is_free: bool
    subjects: List[str] = field(default_factory=list)
    limits: List[int] = field(default_factory=list)


def _client_ip_hash(request: Request) -> str:
    forwarded = request.headers.get("x-forwarded-for", "").split(",", 1)[0].strip()
    ip = forwarded or (request.client.host if request.client else "unknown")
    salt = _env("BLUEBUILD_IP_SALT") or _clerk_secret_key() or "bluebuild"
    return hashlib.sha256(f"{salt}:{ip}".encode("utf-8")).hexdigest()[:32]


def plan_for(user: UserContext, request: Request) -> QuotaPlan:
    day = today()
    wallet = wallet_for_user(user.owner_user_id)
    holding = holding_for(wallet, day) if wallet else 0.0
    tier, per_day = tier_for(holding)
    if per_day > 0:
        return QuotaPlan(
            day=day, wallet=wallet, holding=holding, tier=tier, personal_limit=per_day, is_free=False,
            subjects=["all", f"wallet:{wallet}"], limits=[total_per_day(), per_day],
        )
    identity = f"wallet:{wallet}" if wallet else f"user:{user.owner_user_id}"
    free = free_per_day()
    return QuotaPlan(
        day=day, wallet=wallet, holding=holding, tier="free", personal_limit=free, is_free=True,
        subjects=["all", "free", identity, f"ip:{_client_ip_hash(request)}"],
        limits=[total_per_day(), free_pool_per_day(), free, free],
    )


def _limit_message(plan: QuotaPlan, blocked: str) -> str:
    if blocked == "all":
        return "Bluebuild has reached its design capacity for today. It resets at 00:00 UTC."
    if blocked == "free":
        return ("Today's free designs are all used up. $BLUEBUILD holders still have access. "
                "Free designs reset at 00:00 UTC.")
    if plan.is_free:
        return (f"You've used your {plan.personal_limit} free designs for today. "
                "Hold $BLUEBUILD for a bigger daily allowance, or come back after 00:00 UTC.")
    return (f"You've used all {plan.personal_limit} designs for your tier today. "
            "Hold more $BLUEBUILD for a higher tier, or come back after 00:00 UTC.")


def _json_error(status_code: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"detail": {"code": code, "message": message}})


class BluebuildQuotaMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: Any) -> Any:
        if request.method != "POST" or not gating_enabled() or not GATED_PATH_RE.match(request.url.path):
            return await call_next(request)
        try:
            user = await optional_user_context(request)
        except Exception:
            return await call_next(request)  # the endpoint reports the sign-in problem itself
        if not user.is_authenticated or user.is_admin:
            return await call_next(request)

        db = store()
        try:
            plan = await run_in_threadpool(plan_for, user, request)
            blocked = await run_in_threadpool(db.consume, plan.day, plan.subjects, plan.limits)
        except Exception:
            logger.exception("Bluebuild quota check failed")
            return _json_error(
                503, "bluebuild_quota_unavailable",
                "Couldn't check your design allowance right now. Please try again in a minute.",
            )
        if blocked:
            response = _json_error(429, "bluebuild_daily_limit", _limit_message(plan, blocked))
            response.headers["Retry-After"] = str(
                int((dt.datetime.fromisoformat(next_reset_iso()) - dt.datetime.now(dt.timezone.utc)).total_seconds())
            )
            return response

        try:
            response = await call_next(request)
        except Exception:
            await run_in_threadpool(db.refund, plan.day, plan.subjects)
            raise
        if response.status_code >= 400:
            await run_in_threadpool(db.refund, plan.day, plan.subjects)
        return response


# ---------------------------------------------------------------- status endpoint

router = APIRouter()


def _public_tiers() -> List[Dict[str, Any]]:
    return [{"min_tokens": minimum, "per_day": per_day} for minimum, per_day in sorted(tiers())]


@router.get("/bluebuild/status")
async def bluebuild_status(request: Request, user: UserContext = Depends(optional_user_context)) -> Dict[str, Any]:
    if not gating_enabled():
        return {"gating": False}
    base = {
        "gating": True,
        "token_live": bool(token_mint()),
        "free_per_day": free_per_day(),
        "tiers": _public_tiers(),
        "resets_at": next_reset_iso(),
    }
    if not user.is_authenticated:
        return {**base, "signed_in": False}
    if user.is_admin:
        return {**base, "signed_in": True, "owner": True}
    try:
        plan = await run_in_threadpool(plan_for, user, request)
        used = await run_in_threadpool(store().used, plan.day, plan.subjects)
    except Exception:
        logger.exception("Bluebuild status failed")
        return {**base, "signed_in": True, "error": "unavailable"}
    remaining = min(max(limit - used.get(subject, 0), 0) for subject, limit in zip(plan.subjects, plan.limits))
    return {
        **base,
        "signed_in": True,
        "wallet": plan.wallet,
        "holding": plan.holding,
        "tier": plan.tier,
        "limit": plan.personal_limit,
        "remaining": remaining,
        "free_pool_empty": plan.is_free and used.get("free", 0) >= free_pool_per_day(),
    }


__all__ = ["BluebuildQuotaMiddleware", "router", "tier_for", "tiers"]
