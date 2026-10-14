from __future__ import annotations

import unittest
from unittest.mock import patch

from forma_core.agents import orchestrator
from forma_core.agents.orchestrator import HardwarePipelineOrchestrator, simulated_generation_allowed
from forma_core.llm_providers import LLMProviderConfigError


class UnconfiguredProvider:
    """A provider with no API key, like a local copy without ANTHROPIC_API_KEY."""

    provider_name = "anthropic"
    model_name = "claude-test"
    is_configured = False

    def validate_configured_model(self, *, raise_on_strict: bool = True):
        return None


def local_orchestrator(**kwargs) -> HardwarePipelineOrchestrator:
    with patch.object(orchestrator, "build_llm_provider", return_value=UnconfiguredProvider()):
        instance = HardwarePipelineOrchestrator(persist_project=False, **kwargs)
    instance.validate_configured_model = lambda *args, **kwargs: None
    instance.get_debug_config = lambda *args, **kwargs: {"provider": "anthropic", "requested_model": "claude-test"}
    return instance


class SimulationGateTests(unittest.TestCase):
    def setUp(self) -> None:
        patcher = patch.object(orchestrator, "deployment_mode_enabled", return_value=False)
        patcher.start()
        self.addCleanup(patcher.stop)

    def test_a_missing_key_is_an_error_not_a_canned_design(self) -> None:
        with patch.object(orchestrator, "_env_bool", return_value=False):
            with self.assertRaises(LLMProviderConfigError):
                local_orchestrator().generate_project("a fridge magnet that you can set timers on")

    def test_demo_designs_need_an_explicit_opt_in(self) -> None:
        with patch.object(orchestrator, "_env_bool", side_effect=lambda name: name == "FORMA_ALLOW_SIMULATED_GENERATION"):
            self.assertTrue(simulated_generation_allowed())
        with patch.object(orchestrator, "_env_bool", return_value=False):
            self.assertFalse(simulated_generation_allowed())
        with patch.object(orchestrator, "_env_bool", return_value=True):
            # The strict switches still win over the opt-in.
            self.assertFalse(simulated_generation_allowed())

    def test_explicitly_requested_simulation_still_works(self) -> None:
        with patch.object(orchestrator, "_env_bool", return_value=False), \
                patch.object(HardwarePipelineOrchestrator, "_generate_simulated_project", return_value="simulated") as simulated:
            result = local_orchestrator(use_simulation=True).generate_project("a lamp")

        self.assertEqual("simulated", result)
        simulated.assert_called_once()


if __name__ == "__main__":
    unittest.main()
