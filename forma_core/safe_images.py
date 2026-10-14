"""Validation and re-encoding for images that come from users.

Every user-supplied image is treated as hostile until it has been:

* decoded from an inline data URL (or fetched from a trusted storage host only),
* identified from its bytes rather than from the declared MIME type,
* limited in byte size and pixel count (decompression bombs included), and
* re-encoded by Pillow, so appended payloads, polyglot files and metadata
  such as EXIF/GPS never reach storage, the browser or a model provider.

SVG, HTML and anything Pillow can't decode as PNG, JPEG, WebP or GIF are refused.
"""

from __future__ import annotations

import base64
import binascii
import io
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from typing import Iterable, Optional
from urllib.parse import urlparse

from forma_core.config import config


ALLOWED_FORMATS = {"PNG", "JPEG", "WEBP", "GIF"}
DEFAULT_MAX_BYTES = 6 * 1024 * 1024
DEFAULT_MAX_DIMENSION = 4096
DEFAULT_MAX_PIXELS = 25_000_000
REMOTE_TIMEOUT_SECONDS = 15
DATA_URL_RE = re.compile(r"^data:([a-z0-9.+/-]+)?(;[a-z0-9=._-]+)*;base64,", re.IGNORECASE)


class UnsafeImageError(ValueError):
    """Raised when an uploaded image is refused. The message is safe to show to users."""


@dataclass(frozen=True)
class SafeImage:
    content: bytes
    content_type: str
    width: int
    height: int

    @property
    def data_url(self) -> str:
        return f"data:{self.content_type};base64,{base64.b64encode(self.content).decode('ascii')}"


def _int_setting(name: str, default: int) -> int:
    try:
        return max(1, int(str(config.get(name) or default)))
    except ValueError:
        return default


def decode_inline_image(data: str, *, max_bytes: Optional[int] = None) -> bytes:
    """Decode a data URL or bare base64 string. Remote URLs are refused here."""
    limit = max_bytes or _int_setting("FORMA_MAX_IMAGE_BYTES", DEFAULT_MAX_BYTES)
    text = (data or "").strip()
    if not text:
        raise UnsafeImageError("The image is empty.")
    if text.lower().startswith(("http://", "https://")):
        raise UnsafeImageError("Image links aren't accepted here. Please upload the image file instead.")
    match = DATA_URL_RE.match(text)
    if match:
        text = text[match.end():]
    elif text.lower().startswith("data:"):
        raise UnsafeImageError("The image must be base64-encoded.")
    # Reject oversized payloads before decoding them into memory.
    if len(text) > (limit * 4) // 3 + 8:
        raise UnsafeImageError("The image is too large.")
    try:
        content = base64.b64decode(re.sub(r"\s+", "", text), validate=True)
    except (binascii.Error, ValueError) as exc:
        raise UnsafeImageError("The image couldn't be read.") from exc
    if not content:
        raise UnsafeImageError("The image is empty.")
    if len(content) > limit:
        raise UnsafeImageError("The image is too large.")
    return content


def sanitize_image_bytes(
    content: bytes,
    *,
    max_bytes: Optional[int] = None,
    max_dimension: Optional[int] = None,
    max_pixels: int = DEFAULT_MAX_PIXELS,
    resize_to: Optional[int] = None,
) -> SafeImage:
    """Verify an image's real format and dimensions, then re-encode it from decoded pixels.

    resize_to shrinks the longest side to at most that many pixels (never enlarges).
    """
    try:
        from PIL import Image, ImageOps
    except ImportError as exc:  # pragma: no cover - Pillow is a declared dependency
        raise UnsafeImageError("Image processing is unavailable.") from exc

    limit = max_bytes or _int_setting("FORMA_MAX_IMAGE_BYTES", DEFAULT_MAX_BYTES)
    dimension_limit = max_dimension or _int_setting("FORMA_MAX_IMAGE_DIMENSION", DEFAULT_MAX_DIMENSION)
    if len(content) > limit:
        raise UnsafeImageError("The image is too large.")

    try:
        with Image.open(io.BytesIO(content)) as probe:
            source_format = (probe.format or "").upper()
            width, height = probe.size
            probe.verify()
    except Exception as exc:
        raise UnsafeImageError("The file isn't a valid PNG, JPEG, WebP or GIF image.") from exc
    if source_format not in ALLOWED_FORMATS:
        raise UnsafeImageError("Only PNG, JPEG, WebP or GIF images are accepted.")
    if width < 1 or height < 1 or width > dimension_limit or height > dimension_limit or width * height > max_pixels:
        raise UnsafeImageError(f"The image must be at most {dimension_limit}×{dimension_limit} pixels.")

    try:
        with Image.open(io.BytesIO(content)) as image:
            image.seek(0)  # animated images keep only their first frame
            frame = ImageOps.exif_transpose(image)
            if resize_to:
                frame.thumbnail((resize_to, resize_to))
            has_alpha = frame.mode in {"RGBA", "LA", "PA"} or (frame.mode == "P" and "transparency" in frame.info)
            output = io.BytesIO()
            if has_alpha:
                frame.convert("RGBA").save(output, format="PNG", optimize=True)
                content_type = "image/png"
            else:
                frame.convert("RGB").save(output, format="JPEG", quality=90, optimize=True)
                content_type = "image/jpeg"
            final_width, final_height = frame.size
    except UnsafeImageError:
        raise
    except Exception as exc:
        raise UnsafeImageError("The image couldn't be processed.") from exc

    cleaned = output.getvalue()
    if len(cleaned) > limit:
        raise UnsafeImageError("The image is too large.")
    return SafeImage(content=cleaned, content_type=content_type, width=final_width, height=final_height)


def sanitize_inline_image(data: str, **limits: int) -> SafeImage:
    return sanitize_image_bytes(decode_inline_image(data, max_bytes=limits.get("max_bytes")), **limits)


def trusted_image_hosts() -> set[str]:
    """Hosts a server may fetch user-referenced images from: our own storage, plus any configured extras."""
    hosts: set[str] = set()
    for key in ("SUPABASE_URL", "SUPABASE_STORAGE_PUBLIC_BASE_URL"):
        host = urlparse(str(config.get(key) or "")).hostname
        if host:
            hosts.add(host.lower())
            if host.endswith(".supabase.co"):
                hosts.add(host.lower().replace(".supabase.co", ".storage.supabase.co"))
    for extra in str(config.get("FORMA_TRUSTED_IMAGE_HOSTS") or "").split(","):
        if extra.strip():
            hosts.add(extra.strip().lower())
    return hosts


class _NoRedirects(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):  # type: ignore[override]
        return None


def fetch_trusted_image(
    url: str,
    *,
    allowed_hosts: Optional[Iterable[str]] = None,
    max_bytes: Optional[int] = None,
    resize_to: Optional[int] = None,
) -> SafeImage:
    """Fetch an image only from an allow-listed HTTPS host, without redirects, then sanitize it."""
    parsed = urlparse((url or "").strip())
    host = (parsed.hostname or "").lower()
    hosts = {item.lower() for item in (allowed_hosts if allowed_hosts is not None else trusted_image_hosts())}
    if parsed.scheme != "https" or not host or host not in hosts or parsed.username or parsed.password:
        raise UnsafeImageError("Image links are only accepted from Bluebuild's own storage. Please upload the file instead.")
    limit = max_bytes or _int_setting("FORMA_MAX_IMAGE_BYTES", DEFAULT_MAX_BYTES)
    opener = urllib.request.build_opener(_NoRedirects)
    request = urllib.request.Request(parsed.geturl(), headers={"User-Agent": "Bluebuild/1.0", "Accept": "image/*"})
    try:
        with opener.open(request, timeout=REMOTE_TIMEOUT_SECONDS) as response:
            if response.status != 200:
                raise UnsafeImageError("The image link couldn't be loaded.")
            content = response.read(limit + 1)
    except UnsafeImageError:
        raise
    except (urllib.error.URLError, OSError, ValueError) as exc:
        raise UnsafeImageError("The image link couldn't be loaded.") from exc
    if len(content) > limit:
        raise UnsafeImageError("The image is too large.")
    return sanitize_image_bytes(content, max_bytes=limit, resize_to=resize_to)


def sanitize_user_image(data: str, *, allow_trusted_urls: bool = False, **limits: int) -> SafeImage:
    """Sanitize an inline image, or (when allowed) an image on a trusted storage host."""
    text = (data or "").strip()
    if allow_trusted_urls and text.lower().startswith(("http://", "https://")):
        return fetch_trusted_image(text, max_bytes=limits.get("max_bytes"))
    return sanitize_inline_image(text, **limits)
