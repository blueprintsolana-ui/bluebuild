from __future__ import annotations

import base64
import io
import unittest
from unittest.mock import patch

from PIL import Image

from forma_core import safe_images
from forma_core.safe_images import UnsafeImageError, fetch_trusted_image, sanitize_inline_image, sanitize_user_image


def image_bytes(fmt: str = "PNG", size=(8, 8), mode: str = "RGB", **save) -> bytes:
    buffer = io.BytesIO()
    Image.new(mode, size, (200, 30, 30) if mode == "RGB" else (200, 30, 30, 128)).save(buffer, format=fmt, **save)
    return buffer.getvalue()


def data_url(content: bytes, mime: str = "image/png") -> str:
    return f"data:{mime};base64,{base64.b64encode(content).decode('ascii')}"


class SanitizeImageTests(unittest.TestCase):
    def test_real_images_are_re_encoded_to_png_or_jpeg(self) -> None:
        for fmt, mode, expected in (("PNG", "RGB", "image/jpeg"), ("PNG", "RGBA", "image/png"), ("JPEG", "RGB", "image/jpeg"),
                                    ("WEBP", "RGB", "image/jpeg"), ("GIF", "RGB", "image/jpeg")):
            with self.subTest(fmt=fmt, mode=mode):
                safe = sanitize_inline_image(data_url(image_bytes(fmt, mode=mode)))
                self.assertEqual(expected, safe.content_type)
                self.assertTrue(safe.data_url.startswith(f"data:{expected};base64,"))

    def test_declared_type_is_ignored_in_favour_of_the_real_bytes(self) -> None:
        safe = sanitize_inline_image(data_url(image_bytes("PNG", mode="RGBA"), "image/gif"))
        self.assertEqual("image/png", safe.content_type)

    def test_non_images_and_scriptable_formats_are_refused(self) -> None:
        payloads = {
            "html": data_url(b"<html><script>alert(1)</script></html>", "image/png"),
            "svg": data_url(b'<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>', "image/svg+xml"),
            "bmp": data_url(image_bytes("BMP"), "image/png"),
            "garbage base64": "data:image/png;base64,not*base64",
            "empty": "",
        }
        for label, payload in payloads.items():
            with self.subTest(label), self.assertRaises(UnsafeImageError):
                sanitize_inline_image(payload)

    def test_appended_payloads_and_metadata_do_not_survive(self) -> None:
        exif = Image.Exif()
        exif[0x8825] = {2: (52.0, 13.0, 0.0)}  # GPS info
        buffer = io.BytesIO()
        Image.new("RGB", (8, 8), (10, 20, 30)).save(buffer, format="JPEG", exif=exif.tobytes())
        polyglot = buffer.getvalue() + b"<script>alert('owned')</script>"

        safe = sanitize_inline_image(data_url(polyglot, "image/jpeg"))

        self.assertNotIn(b"<script>", safe.content)
        with Image.open(io.BytesIO(safe.content)) as cleaned:
            self.assertFalse(cleaned.getexif())

    def test_size_and_dimension_limits(self) -> None:
        with self.assertRaises(UnsafeImageError):
            sanitize_inline_image(data_url(image_bytes(size=(64, 64))), max_dimension=32)
        with self.assertRaises(UnsafeImageError):
            sanitize_inline_image(data_url(image_bytes()), max_bytes=10)
        with self.assertRaises(UnsafeImageError):
            sanitize_inline_image(data_url(image_bytes(size=(4000, 4000))), max_pixels=1_000_000)

    def test_inline_decoder_refuses_links(self) -> None:
        with self.assertRaises(UnsafeImageError):
            sanitize_inline_image("https://example.com/image.png")


class TrustedFetchTests(unittest.TestCase):
    def test_links_outside_our_storage_are_refused_before_any_request(self) -> None:
        refused = [
            "http://abc.supabase.co/storage/v1/object/public/x.png",  # not https
            "https://169.254.169.254/latest/meta-data/",  # cloud metadata
            "https://localhost/admin.png",
            "https://evil.example/x.png",
            "https://user:pass@abc.supabase.co/x.png",
        ]
        with patch("urllib.request.OpenerDirector.open") as opened:
            for url in refused:
                with self.subTest(url), self.assertRaises(UnsafeImageError):
                    fetch_trusted_image(url, allowed_hosts={"abc.supabase.co"})
        opened.assert_not_called()

    def test_trusted_storage_images_are_fetched_and_sanitized(self) -> None:
        class Response(io.BytesIO):
            status = 200

            def __enter__(self):
                return self

            def __exit__(self, *args):
                return False

        with patch("urllib.request.OpenerDirector.open", return_value=Response(image_bytes())):
            safe = fetch_trusted_image("https://abc.supabase.co/storage/v1/object/sign/x.png", allowed_hosts={"abc.supabase.co"})
        self.assertEqual("image/jpeg", safe.content_type)

    def test_trusted_hosts_come_from_supabase_settings(self) -> None:
        settings = {"SUPABASE_URL": "https://abc.supabase.co", "FORMA_TRUSTED_IMAGE_HOSTS": "cdn.example.com"}
        with patch.object(safe_images.config, "get", side_effect=lambda key, default=None: settings.get(key, default)):
            self.assertEqual({"abc.supabase.co", "abc.storage.supabase.co", "cdn.example.com"}, safe_images.trusted_image_hosts())

    def test_user_images_only_follow_links_when_allowed(self) -> None:
        with self.assertRaises(UnsafeImageError):
            sanitize_user_image("https://abc.supabase.co/x.png")


if __name__ == "__main__":
    unittest.main()
