from __future__ import annotations

import unittest

from forma_core.agents.failure_messages import generation_failure_message


def _response(message: str, stage_id: str = "web_architect") -> dict:
    return {
        "project_ir": {
            "assembly_metadata": {
                "generation_stage_failures": [
                    {"stage_id": "web_component_sourcing", "status": "blocked", "error": {"message": "dependency failed"}},
                    {"stage_id": stage_id, "status": "failed", "error": {"message": message}},
                ]
            }
        }
    }


class GenerationFailureMessageTests(unittest.TestCase):
    def test_known_provider_problems_are_explained_plainly(self) -> None:
        cases = {
            "Your credit balance is too low to access the Anthropic API.": "out of credit",
            "anthropic request failed with HTTP 429: rate_limit_error": "busy",
            "HTTP 529: Overloaded": "overloaded",
            "Request timed out after 120s": "too long",
            "HTTP 401: invalid x-api-key": "isn't set up correctly",
        }
        for provider_error, expected in cases.items():
            with self.subTest(provider_error=provider_error):
                message = generation_failure_message(_response(provider_error))
                self.assertIn(expected, message)
                self.assertNotIn("HTTP", message)

    def test_unknown_problems_name_the_failed_step(self) -> None:
        self.assertEqual(
            "This design couldn't be made because the planning step failed. Please try again.",
            generation_failure_message(_response("something unexpected")),
        )

    def test_missing_details_still_give_a_message(self) -> None:
        self.assertEqual(
            "This design couldn't be made because a required step failed. Please try again.",
            generation_failure_message({}),
        )


if __name__ == "__main__":
    unittest.main()
