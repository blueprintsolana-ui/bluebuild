from __future__ import annotations

import base64
import io
import tempfile
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from fastapi.testclient import TestClient
from PIL import Image

from apps.api import bluebuild_launchpad as launchpad
from apps.api import bluebuild_pitch as pitch
from apps.api import main
from apps.api.auth import UserContext, optional_user_context, require_user_context


def _png() -> bytes:
    buffer = io.BytesIO()
    Image.new("RGBA", (16, 16), (255, 181, 71, 255)).save(buffer, format="PNG")
    return buffer.getvalue()


PNG = _png()
PNG_DATA_URL = "data:image/png;base64," + base64.b64encode(PNG).decode("ascii")
CREATOR = "7Np41oeYqPefeNQEHSv1UDhYrehxin3NStELsSKCT4K2"
MINT = "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R"
SIGNATURE = "5" * 88
_B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz"


def b58encode(data: bytes) -> str:
    number = int.from_bytes(data, "big")
    encoded = ""
    while number:
        number, remainder = divmod(number, 58)
        encoded = _B58[remainder] + encoded
    return "1" * (len(data) - len(data.lstrip(b"\x00"))) + encoded


def launch_payload(**overrides):
    payload = {
        "name": "Smart Bottle",
        "symbol": "sip",
        "description": "A 1 L bottle that shows the water temperature.",
        "website": "bluebuild.example/project/abc",
        "twitter": "@smartbottle",
        "telegram": "smartbottlechat",
        "mint": MINT,
        "creator_wallet": CREATOR,
        "initial_buy_sol": "0.5",
        "image_data": PNG_DATA_URL,
    }
    payload.update(overrides)
    return payload


def create_transaction(metadata_uri: str, *, payer: str = CREATOR, err=None):
    data = b"\x01create" + len(metadata_uri).to_bytes(4, "little") + metadata_uri.encode("utf-8")
    return {
        "meta": {"err": err, "loadedAddresses": {"writable": [], "readonly": []}},
        "transaction": {
            "message": {
                "accountKeys": [payer, MINT, launchpad.PUMP_PROGRAM_ID],
                "instructions": [{"programIdIndex": 2, "data": b58encode(data)}],
            }
        },
    }


class LaunchValidationTests(unittest.TestCase):
    def test_details_are_normalized(self) -> None:
        details = launchpad.normalize_launch(launch_payload())

        self.assertEqual("SIP", details.symbol)
        self.assertIsNone(details.website, "the website is always set to the pitch deck, never taken from the request")
        self.assertEqual("https://x.com/smartbottle", details.twitter)
        self.assertEqual("https://t.me/smartbottlechat", details.telegram)
        self.assertEqual(0.5, details.initial_buy_sol)
        self.assertEqual(("image/png", "png"), (details.image_type, details.image_ext))

    def test_links_are_optional_and_twitter_urls_become_x(self) -> None:
        details = launchpad.normalize_launch(launch_payload(website="", telegram="", twitter="https://twitter.com/bottle"))

        self.assertIsNone(details.website)
        self.assertIsNone(details.telegram)
        self.assertEqual("https://x.com/bottle", details.twitter)

    def test_invalid_details_are_rejected_with_plain_messages(self) -> None:
        cases = {
            "ticker": launch_payload(symbol="TOO-LONG-TICKER"),
            "reserved": launch_payload(name="Bluebuild Official"),
            "url name": launch_payload(name="visit https://scam.example"),
            "twitter host": launch_payload(twitter="https://evil.example/x"),
            "buy cap": launch_payload(initial_buy_sol="500"),
            "image": launch_payload(image_data="data:image/png;base64," + base64.b64encode(b"not an image").decode()),
            "wallet": launch_payload(creator_wallet="not-a-wallet"),
        }
        for label, payload in cases.items():
            with self.subTest(label), self.assertRaises(launchpad.LaunchValidationError):
                launchpad.normalize_launch(payload)

    def test_extra_blocked_terms_come_from_the_environment(self) -> None:
        with patch.object(launchpad, "blocked_terms", return_value=["rugpull"]):
            with self.assertRaises(launchpad.LaunchValidationError):
                launchpad.normalize_launch(launch_payload(description="Definitely not a rugpull"))

    def test_metadata_matches_pump_fun_fields(self) -> None:
        details = launchpad.normalize_launch(launch_payload(telegram=""))
        details.website = "https://bluebuild.example/coin/abc"
        metadata = launchpad.build_metadata(details, "https://cdn.example/logo.png", "https://bluebuild.example")

        self.assertEqual({
            "name": "Smart Bottle",
            "symbol": "SIP",
            "description": "A 1 L bottle that shows the water temperature.",
            "image": "https://cdn.example/logo.png",
            "showName": True,
            "createdOn": "https://bluebuild.example",
            "website": "https://bluebuild.example/coin/abc",
            "twitter": "https://x.com/smartbottle",
        }, metadata)


class LaunchVerificationTests(unittest.TestCase):
    uri = "https://cdn.example/coin-metadata/launch.json"

    def test_successful_create_with_our_metadata_is_accepted(self) -> None:
        self.assertIsNone(launchpad.verify_launch_transaction(
            create_transaction(self.uri), mint=MINT, creator=CREATOR, metadata_uri=self.uri,
        ))

    def test_unconfirmed_failed_or_foreign_transactions_are_rejected(self) -> None:
        verify = launchpad.verify_launch_transaction
        self.assertEqual("pending", verify(None, mint=MINT, creator=CREATOR, metadata_uri=self.uri))
        self.assertIn("failed", verify(create_transaction(self.uri, err={"x": 1}), mint=MINT, creator=CREATOR, metadata_uri=self.uri))
        self.assertIn("wallet", verify(create_transaction(self.uri, payer=MINT), mint=MINT, creator=CREATOR, metadata_uri=self.uri))
        self.assertIn("pump.fun", verify(create_transaction("https://other.example/x.json"), mint=MINT, creator=CREATOR, metadata_uri=self.uri))

    def test_base58_decoding_round_trips(self) -> None:
        for data in (b"", b"\x00\x00abc", bytes(range(40))):
            self.assertEqual(data, launchpad.b58decode(b58encode(data)))


class LaunchpadEndpointTests(unittest.TestCase):
    def setUp(self) -> None:
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.owner = UserContext(
            provider="clerk", subject="owner", owner_user_id="owner", is_authenticated=True, is_admin=False, claims={},
        )
        main.app.dependency_overrides[require_user_context] = lambda: self.owner
        main.app.dependency_overrides[optional_user_context] = lambda: self.owner
        self.addCleanup(main.app.dependency_overrides.clear)
        project = SimpleNamespace(project_id="project-1", owner_user_id="owner", visibility="public")
        self.real_build_pitch_deck = launchpad._build_pitch_deck
        for target, value in (
            ("_STORE", launchpad._SQLiteLaunchStore(self.temp.name, "http://testserver")),
            ("launchpad_enabled", lambda: True),
            ("deployed_auth_required", lambda: False),
            ("_resolve_owner", lambda project_id, user: project),
            ("_resolve_reader", lambda project_id, user: project),
            ("_build_pitch_deck", lambda project_id, user, launch_id, coin_name: {"title": "Stub deck"}),
        ):
            patcher = patch.object(launchpad, target, value)
            patcher.start()
            self.addCleanup(patcher.stop)
        self.client = TestClient(main.app, headers={"Origin": "https://bluebuild.example"})

    def test_prepare_confirm_then_show_the_coin_on_the_design(self) -> None:
        before = self.client.get("/launchpad/projects/project-1").json()
        self.assertTrue(before["can_launch"])
        self.assertIsNone(before["launch"])

        prepared = self.client.post("/launchpad/projects/project-1/prepare", json=launch_payload())
        self.assertEqual(200, prepared.status_code, prepared.text)
        launch = prepared.json()
        metadata = self.client.get(launch["metadata_uri"].removeprefix("http://testserver")).json()
        self.assertEqual("SIP", metadata["symbol"])
        self.assertEqual(200, self.client.get(metadata["image"].removeprefix("http://testserver")).status_code)

        with patch.object(launchpad, "fetch_transaction", return_value=None):
            pending = self.client.post(f"/launchpad/launches/{launch['launch_id']}/confirm", json={"signature": SIGNATURE})
        self.assertEqual({"status": "pending"}, pending.json())

        with patch.object(launchpad, "fetch_transaction", return_value=create_transaction(launch["metadata_uri"])):
            confirmed = self.client.post(f"/launchpad/launches/{launch['launch_id']}/confirm", json={"signature": SIGNATURE})
        self.assertEqual("launched", confirmed.json()["status"], confirmed.text)

        after = self.client.get("/launchpad/projects/project-1").json()
        self.assertFalse(after["can_launch"])
        self.assertEqual(f"https://pump.fun/coin/{MINT}", after["launch"]["pump_url"])

        again = self.client.post(
            "/launchpad/projects/project-1/prepare",
            json=launch_payload(mint="9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin"),
        )
        self.assertEqual(409, again.status_code)

    def test_product_page_is_the_default_website_and_is_published_at_launch(self) -> None:
        design = {
            "overview": {"title": "Smart Bottle", "description": "Shows water temperature.", "estimated_cost": 24.5},
            "requirements": {"requirements": ["Show temperature"], "power_needs": "LiPo battery", "operating_voltage": 3.3},
            "mechanical": {"render_dimensions": {"x_mm": 75, "y_mm": 75, "z_mm": 270}, "enclosure_type": "Aluminium"},
            "components": [{"ref_des": "U1", "name": "ESP32", "category": "Microcontroller"}],
            "assembly": [{"step_num": 1}],
            "assembly_metadata": {"product_visual_sequence": [{"view_id": "case", "label": "Front", "data": PNG_DATA_URL}]},
        }
        with patch("apps.api.main.get_project_endpoint", return_value={"project_ir": design}), \
                patch("apps.api.bluebuild_pitch.write_pitch_copy", return_value={"tagline": "Know your water."}), \
                patch.object(launchpad, "_build_pitch_deck", self.real_build_pitch_deck):
            prepared = self.client.post(
                "/launchpad/projects/project-1/prepare",
                json=launch_payload(website="https://someone-else.example"),
            ).json()
            metadata = self.client.get(prepared["metadata_uri"].removeprefix("http://testserver")).json()
            self.assertEqual(f"https://bluebuild.example/coin/{MINT}", metadata["website"])
            with patch.object(launchpad, "fetch_transaction", return_value=create_transaction(prepared["metadata_uri"])):
                self.client.post(f"/launchpad/launches/{prepared['launch_id']}/confirm", json={"signature": SIGNATURE})

        page = self.client.get(f"/launchpad/coins/{MINT}")
        self.assertEqual(200, page.status_code, page.text)
        pitch = page.json()["pitch"]
        self.assertEqual("Smart Bottle", pitch["title"])
        self.assertEqual("Know your water.", pitch["copy"]["tagline"])
        self.assertIn({"label": "Size", "value": "75 × 75 × 270 mm"}, pitch["specs"])
        self.assertEqual(1, len(pitch["images"]))
        self.assertEqual(200, self.client.get(pitch["images"][0]["url"].removeprefix("http://testserver")).status_code)
        self.assertEqual(404, self.client.get("/launchpad/coins/9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin").status_code)

    def test_a_failed_pitch_deck_stops_the_launch_before_the_wallet_step(self) -> None:
        with patch.object(launchpad, "_build_pitch_deck", side_effect=RuntimeError("storage down")):
            refused = self.client.post("/launchpad/projects/project-1/prepare", json=launch_payload())

        self.assertEqual(503, refused.status_code)
        self.assertEqual("pitch_deck_failed", refused.json()["detail"]["code"])

    def test_disabled_launchpad_hides_the_button_and_refuses_launches(self) -> None:
        with patch.object(launchpad, "launchpad_enabled", return_value=False):
            status = self.client.get("/launchpad/projects/project-1").json()
            refused = self.client.post("/launchpad/projects/project-1/prepare", json=launch_payload())

        self.assertFalse(status["can_launch"])
        self.assertEqual(503, refused.status_code)

    def test_signed_in_wallet_must_match_the_launching_wallet(self) -> None:
        with patch.object(launchpad, "deployed_auth_required", return_value=True), \
                patch.object(launchpad, "wallet_for_user", return_value=MINT):
            refused = self.client.post("/launchpad/projects/project-1/prepare", json=launch_payload())

        self.assertEqual(400, refused.status_code)
        self.assertIn("same wallet", refused.json()["detail"]["message"])

    def test_rpc_relay_only_allows_launch_methods(self) -> None:
        with patch.object(launchpad, "rpc_url", return_value="https://rpc.example"):
            refused = self.client.post("/launchpad/rpc", json={"jsonrpc": "2.0", "id": 1, "method": "requestAirdrop"})

        self.assertEqual(403, refused.status_code)


class ProductPageSnapshotTests(unittest.TestCase):
    def test_snapshot_keeps_useful_facts_and_skips_empty_ones(self) -> None:
        snapshot = pitch.snapshot_design({
            "overview": {"title": "Lamp", "description": "A desk lamp.", "difficulty": "Easy"},
            "requirements": {"requirements": ["Dimmable"], "operating_voltage": 0},
            "components": [{"name": "LED"}, {"name": "LED"}, {"name": "ESP32", "category": "Microcontroller"}],
        }, "p1")

        self.assertEqual("Lamp", snapshot["title"])
        self.assertEqual([{"name": "LED", "category": "", "count": 2}, {"name": "ESP32", "category": "Microcontroller", "count": 1}], snapshot["parts"])
        self.assertNotIn("Operating voltage", [spec["label"] for spec in snapshot["specs"]])
        self.assertIn({"label": "Parts", "value": "3"}, snapshot["specs"])

    def test_images_are_re_encoded_and_bad_ones_skipped(self) -> None:
        stored = {}

        def put_file(key, content, content_type):
            stored[key] = (content, content_type)
            return f"https://cdn.example/{key}"

        images = pitch.copy_pitch_images(
            [{"source": PNG_DATA_URL, "label": "Front"},
             {"source": "data:image/png;base64," + base64.b64encode(b"<html>").decode(), "label": "Bad"},
             {"source": "https://evil.example/x.png", "label": "Remote"}],
            put_file,
            "launch-image",
        )

        self.assertEqual([{"url": "https://cdn.example/launch-image-1.png", "label": "Front"}], images)
        self.assertEqual(["launch-image-1.png"], list(stored))

    def test_copy_falls_back_to_none_when_the_model_fails(self) -> None:
        def failing(prompt):
            raise RuntimeError("no model")

        self.assertIsNone(pitch.write_pitch_copy({"title": "Lamp"}, "LAMP", failing))

    def test_copy_is_trimmed_from_the_model_output(self) -> None:
        copy = pitch.write_pitch_copy({"title": "Lamp"}, "LAMP", lambda prompt: pitch.PitchCopy(
            tagline="Light that follows you", pitch="A lamp.", highlights=["a"] * 9,
            use_cases=[pitch.PitchUseCase(title="Reading", detail="At night.")],
        ))
        self.assertEqual(6, len(copy["highlights"]))
        self.assertEqual([{"title": "Reading", "detail": "At night."}], copy["use_cases"])


if __name__ == "__main__":
    unittest.main()
