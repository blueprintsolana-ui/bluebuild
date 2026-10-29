from __future__ import annotations

import unittest
from unittest.mock import patch

from fastapi.testclient import TestClient

from apps.api import bluebuild_launchpad as launchpad
from apps.api import main


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


class LaunchedCoinsTests(unittest.TestCase):
    def test_nothing_when_the_launchpad_is_off(self) -> None:
        with patch.object(launchpad, "launchpad_enabled", return_value=False):
            self.assertEqual({}, launchpad.launched_coins_for_projects(["p1"]))


if __name__ == "__main__":
    unittest.main()
