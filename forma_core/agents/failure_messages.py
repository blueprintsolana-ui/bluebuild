"""Plain-language explanations for generations that stopped at a required stage."""

from __future__ import annotations

from typing import Any, Dict, Iterable, Mapping, Optional

# (substrings looked for in the provider error, explanation shown to the person)
_KNOWN_CAUSES = (
    (
        ("credit balance is too low", "insufficient_quota", "exceeded your current quota", "billing"),
        "Bluebuild's AI service is out of credit, so this design couldn't be made. Please try again later.",
    ),
    (
        ("rate limit", "rate_limit", "http 429", "too many requests"),
        "Bluebuild's AI service is busy right now. Wait a minute, then try again.",
    ),
    (
        ("overloaded", "http 529", "http 503", "service unavailable"),
        "Bluebuild's AI service is overloaded right now. Wait a minute, then try again.",
    ),
    (
        ("timed out", "timeout", "deadline"),
        "The AI took too long to answer, so this design couldn't be made. Please try again.",
    ),
    (
        ("invalid x-api-key", "authentication_error", "http 401", "invalid api key", "incorrect api key"),
        "Bluebuild's AI service isn't set up correctly right now, so this design couldn't be made. Please try again later.",
    ),
)

_STAGE_NAMES = {
    "web_architect": "planning",
    "external_research": "research",
    "web_component_sourcing": "parts selection",
}


def _failed_stages(response: Mapping[str, Any]) -> Iterable[Dict[str, Any]]:
    project_ir = response.get("project_ir") if isinstance(response, Mapping) else None
    metadata = project_ir.get("assembly_metadata") if isinstance(project_ir, Mapping) else None
    failures = metadata.get("generation_stage_failures") if isinstance(metadata, Mapping) else None
    if not isinstance(failures, list):
        return []
    # "blocked" stages only waited on the one that failed; the failed one carries the cause.
    return [item for item in failures if isinstance(item, dict) and item.get("status") == "failed"]


def generation_failure_message(response: Mapping[str, Any]) -> str:
    """Explain why a generation stopped, without exposing provider error text."""
    failed = list(_failed_stages(response))
    first: Optional[Dict[str, Any]] = failed[0] if failed else None
    error = first.get("error") if first else None
    detail = str((error or {}).get("message") or "").lower() if isinstance(error, dict) else ""
    for needles, explanation in _KNOWN_CAUSES:
        if any(needle in detail for needle in needles):
            return explanation
    stage_name = _STAGE_NAMES.get(str((first or {}).get("stage_id") or ""), "")
    step = f"the {stage_name} step" if stage_name else "a required step"
    return f"This design couldn't be made because {step} failed. Please try again."
