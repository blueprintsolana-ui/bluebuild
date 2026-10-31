from __future__ import annotations

import base64
import json
import time
import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from apps.api import bluebuild_launchpad as launchpad
from apps.api import main
from forma_core.persistence import images


def _record(project_id: str, title: str, category: str, created_at: str, **extra):
    return {
        "project_id": project_id,
        "title": title,
        "description": f"{title} description",
        "prompt": "",
        "category": category,
        "creator_display": "maker",
        "created_at": created_at,
        "updated_at": None,
        "parts_count": 4,
        **extra,
    }


RECORDS = [
    _record("p1", "Plant pinger", "Home", "2026-10-01T00:00:00Z"),
    _record("p2", "Bike light", "Outdoor", "2026-10-05T00:00:00Z"),
    _record("p3", "Smart lock", "Home", "2026-10-03T00:00:00Z"),
    _record("p4", "Failed build", "Home", "2026-10-06T00:00:00Z", parts_count=0),
]
REMIXES = {"p1": {"remix_count": 1}, "p2": {"remix_count": 9}, "p3": {"remix_count": 4}}


class CommunityProjectsTests(unittest.TestCase):
    def setUp(self) -> None:
        self.client = TestClient(main.app)
        patches = [
            patch.object(main, "_public_gallery_records", lambda: [dict(record) for record in RECORDS]),
            patch.object(main, "project_engagement_for_ids", lambda ids, _user=None: {i: REMIXES.get(i, {}) for i in ids}),
            patch.object(main, "launched_coins_for_projects", lambda ids: {"p2": {"symbol": "BRAKE", "mint": "m"}} if "p2" in ids else {}),
        ]
        for item in patches:
            item.start()
            self.addCleanup(item.stop)

    def get(self, **params):
        response = self.client.get("/community/projects", params=params)
        self.assertEqual(200, response.status_code, response.text)
        return response.json()

    def test_trending_keeps_gallery_order_and_counts_categories(self) -> None:
        page = self.get()
        self.assertEqual(["p1", "p2", "p3"], [item["project_id"] for item in page["items"]])
        self.assertEqual(3, page["all_total"])
        self.assertEqual([{"name": "Home", "count": 2}, {"name": "Outdoor", "count": 1}], page["categories"])

    def test_filters_and_sorts(self) -> None:
        self.assertEqual(["p1", "p3"], [item["project_id"] for item in self.get(category="home")["items"]])
        self.assertEqual(["p2"], [item["project_id"] for item in self.get(coin="true")["items"]])
        self.assertEqual(["p3"], [item["project_id"] for item in self.get(q="lock")["items"]])
        self.assertEqual(["p2", "p3", "p1"], [item["project_id"] for item in self.get(sort="newest")["items"]])
        self.assertEqual(["p2", "p3", "p1"], [item["project_id"] for item in self.get(sort="remixed")["items"]])

    def test_pages(self) -> None:
        first = self.get(limit=2)
        second = self.get(limit=2, offset=2)
        self.assertTrue(first["has_more"])
        self.assertFalse(second["has_more"])
        self.assertEqual(["p3"], [item["project_id"] for item in second["items"]])

    def test_items_carry_their_coin(self) -> None:
        items = {item["project_id"]: item for item in self.get()["items"]}
        self.assertEqual("BRAKE", items["p2"]["coin"]["symbol"])
        self.assertIsNone(items["p1"]["coin"])


    def test_builds_without_parts_are_left_out(self) -> None:
        page = self.get()
        self.assertNotIn("p4", [item["project_id"] for item in page["items"]])
        self.assertEqual(3, page["all_total"])


def _signed_url(key: str, exp: float) -> str:
    payload = base64.urlsafe_b64encode(json.dumps({"exp": exp}).encode()).decode().rstrip("=")
    return f"https://x.supabase.co/storage/v1/object/sign/contents/{key}?token=h.{payload}.s"


class RefreshSignedImageUrlTests(unittest.TestCase):
    def setUp(self) -> None:
        images._REFRESHED_URLS.clear()

    def test_expired_links_are_re_signed(self) -> None:
        fresh = _signed_url("images/a/product-1.png", time.time() + 86400)
        with patch.object(images, "create_signed_image_url", return_value=fresh) as sign:
            self.assertEqual(fresh, images.refresh_signed_image_url(_signed_url("images/a/product-1.png", time.time() - 10)))
            sign.assert_called_once_with("contents", "images/a/product-1.png")

    def test_live_and_other_links_are_left_alone(self) -> None:
        live = _signed_url("images/a/product-1.png", time.time() + 86400)
        with patch.object(images, "create_signed_image_url") as sign:
            self.assertEqual(live, images.refresh_signed_image_url(live))
            self.assertEqual("data:image/png;base64,AA", images.refresh_signed_image_url("data:image/png;base64,AA"))
            sign.assert_not_called()


class LaunchedCoinsTests(unittest.TestCase):
    def test_nothing_when_the_launchpad_is_off(self) -> None:
        with patch.object(launchpad, "launchpad_enabled", return_value=False):
            self.assertEqual({}, launchpad.launched_coins_for_projects(["p1"]))


if __name__ == "__main__":
    unittest.main()
