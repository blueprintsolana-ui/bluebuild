from __future__ import annotations

import datetime as dt
import unittest

from apps.api import bluebuild_tiers as tiers


def free_plan() -> tiers.QuotaPlan:
    return tiers.QuotaPlan(
        day=dt.date(2026, 10, 15),
        wallet="WalletTwo",
        holding=0,
        tier="free",
        personal_limit=5,
        is_free=True,
        subjects=["all", "free", "wallet:WalletTwo", "ip:abc"],
        limits=[2000, 500, 5, 5],
    )


class LimitMessageTests(unittest.TestCase):
    def test_connection_limit_explains_why_a_new_wallet_does_not_help(self) -> None:
        message = tiers._limit_message(free_plan(), "ip:abc")
        self.assertIn("this internet connection", message)
        self.assertIn("even with a new wallet", message)

    def test_wallet_limit_keeps_the_personal_message(self) -> None:
        message = tiers._limit_message(free_plan(), "wallet:WalletTwo")
        self.assertIn("You've used your 5 free designs", message)

    def test_site_and_pool_limits(self) -> None:
        self.assertIn("design capacity", tiers._limit_message(free_plan(), "all"))
        self.assertIn("free designs are all used up", tiers._limit_message(free_plan(), "free"))


if __name__ == "__main__":
    unittest.main()
