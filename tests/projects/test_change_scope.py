from __future__ import annotations

import unittest

from forma_core.workspaces.projects.iteration import (
    ChangeScope,
    ProjectIterator,
    _preserve_output_metadata,
    change_scope_prompt,
)
from forma_core.workspaces.projects.models import HardwareIntermediateRepresentation, ProjectOverview


def deadbolt() -> HardwareIntermediateRepresentation:
    return HardwareIntermediateRepresentation(
        overview=ProjectOverview(
            title="Bluetooth Smart Deadbolt",
            description="A keyless door lock.",
            difficulty="Intermediate",
            category="Security",
        ),
    )


class ScopeProvider:
    is_configured = True
    provider_name = "test"
    model_name = "test-model"

    def __init__(self, result=None, error=None):
        self.result = result
        self.error = error
        self.prompts = []

    def generate_structured(self, prompt, schema):
        self.prompts.append(prompt)
        if self.error:
            raise self.error
        return self.result


def iterator(provider) -> ProjectIterator:
    instance = ProjectIterator.__new__(ProjectIterator)
    instance.llm_provider = provider
    instance.use_simulation = False
    return instance


class ChangeScopeTests(unittest.TestCase):
    def test_a_different_product_is_flagged(self) -> None:
        provider = ScopeProvider(ChangeScope(scope="new_product", reason="A fridge magnet timer is not a lock."))

        scope = iterator(provider).classify_change_scope(deadbolt(), "a fridge magnet that you can set timers on")

        self.assertEqual("new_product", scope.scope)
        self.assertIn("Bluetooth Smart Deadbolt", provider.prompts[0])
        self.assertIn("fridge magnet", provider.prompts[0])

    def test_the_check_fails_open_as_a_change(self) -> None:
        scope = iterator(ScopeProvider(error=RuntimeError("provider down"))).classify_change_scope(deadbolt(), "add a keypad")
        self.assertEqual("change", scope.scope)

    def test_simulation_skips_the_check(self) -> None:
        instance = iterator(ScopeProvider(error=AssertionError("should not be called")))
        instance.use_simulation = True
        self.assertEqual("change", instance.classify_change_scope(deadbolt(), "add a keypad").scope)

    def test_prompt_handles_designs_without_an_overview(self) -> None:
        prompt = change_scope_prompt(HardwareIntermediateRepresentation(), "make it blue")
        self.assertIn("make it blue", prompt)


class IterationMetadataTests(unittest.TestCase):
    def test_edits_keep_the_3d_product_model_with_the_renders(self) -> None:
        model = {"parts": [{"label": "Body", "shape": "box"}]}
        kept = _preserve_output_metadata({"revision": 2}, {"product_model": model, "product_visual_sequence": [1]})
        self.assertEqual(model, kept["product_model"])
        self.assertEqual([1], kept["product_visual_sequence"])


if __name__ == "__main__":
    unittest.main()
