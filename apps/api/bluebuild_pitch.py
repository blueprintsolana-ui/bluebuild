"""Product pages for launched coins.

When a coin launches, the design is snapshotted into a "pitch": the product
images (re-encoded and copied to public storage so links never expire), key
specs, parts, materials, the 3D product model and short marketing copy written
by the configured LLM. The public page at /coin/<mint> renders that snapshot,
and it is the coin's website link on pump.fun unless the creator chose another.

The snapshot is frozen at launch so the page keeps matching the coin even if
the design is edited or deleted later.
"""

from __future__ import annotations

import datetime as dt
import json
import logging
from typing import Any, Callable, Dict, List, Optional

from pydantic import BaseModel, Field

from forma_core.safe_images import UnsafeImageError, fetch_trusted_image, sanitize_inline_image


logger = logging.getLogger(__name__)

MAX_PITCH_IMAGES = 4
PITCH_IMAGE_SIZE = 1600


class PitchUseCase(BaseModel):
    title: str = Field(..., description="Two to five words")
    detail: str = Field(..., description="One sentence on how someone uses the product in this situation")


class PitchCopy(BaseModel):
    tagline: str = Field(..., description="One punchy line under 90 characters")
    pitch: str = Field(..., description="Two or three plain-English sentences on what it is and why it's useful")
    highlights: List[str] = Field(default_factory=list, description="Three to six short key features")
    use_cases: List[PitchUseCase] = Field(default_factory=list, description="Three to five realistic use cases")
    audience: str = Field("", description="Who it's for, in one sentence")
    materials: List[str] = Field(default_factory=list, description="Main materials and finishes, short phrases")


def _dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _list(value: Any) -> List[Any]:
    return value if isinstance(value, list) else []


def _text(value: Any, limit: int = 400) -> str:
    return " ".join(str(value or "").split())[:limit]


def _dimensions_label(dimensions: Any) -> Optional[str]:
    values = _dict(dimensions)
    try:
        x, y, z = (float(values[key]) for key in ("x_mm", "y_mm", "z_mm"))
    except (KeyError, TypeError, ValueError):
        return None
    if min(x, y, z) <= 0:
        return None
    return f"{x:g} × {y:g} × {z:g} mm"


def _parts_summary(components: List[Any]) -> List[Dict[str, Any]]:
    grouped: Dict[str, Dict[str, Any]] = {}
    for component in components:
        item = _dict(component)
        name = _text(item.get("name") or item.get("part_number"), 80)
        if not name:
            continue
        entry = grouped.setdefault(name, {"name": name, "category": _text(item.get("category"), 40), "count": 0})
        entry["count"] += 1  # components are already expanded to one entry per physical part
    return sorted(grouped.values(), key=lambda entry: (-entry["count"], entry["name"]))[:16]


def snapshot_design(ir: Dict[str, Any], project_id: str) -> Dict[str, Any]:
    """Deterministic, model-free summary of a design for its product page."""
    overview = _dict(ir.get("overview"))
    requirements = _dict(ir.get("requirements"))
    mechanical = _dict(ir.get("mechanical"))
    metadata = _dict(ir.get("assembly_metadata"))
    components = _list(ir.get("components"))
    specs = [
        {"label": "Size", "value": _dimensions_label(mechanical.get("render_dimensions"))},
        {"label": "Form", "value": _text(mechanical.get("physical_form"), 120)},
        {"label": "Enclosure", "value": _text(mechanical.get("enclosure_type"), 120)},
        {"label": "Power", "value": _text(requirements.get("power_needs"), 160)},
        {"label": "Operating voltage", "value": f"{requirements['operating_voltage']:g} V"
            if isinstance(requirements.get("operating_voltage"), (int, float)) and requirements["operating_voltage"] > 0 else None},
        {"label": "Parts", "value": str(len(components)) if components else None},
        {"label": "Build steps", "value": str(len(_list(ir.get("assembly")))) if ir.get("assembly") else None},
        {"label": "Difficulty", "value": _text(overview.get("difficulty"), 40)},
    ]
    estimated_cost = overview.get("estimated_cost")
    return {
        "project_id": project_id,
        "title": _text(overview.get("title"), 120),
        "description": _text(overview.get("description"), 1500),
        "category": _text(overview.get("category"), 60),
        "estimated_cost_usd": round(float(estimated_cost), 2) if isinstance(estimated_cost, (int, float)) and estimated_cost > 0 else None,
        "features": [_text(item, 160) for item in _list(requirements.get("requirements"))[:8] if _text(item)],
        "specs": [spec for spec in specs if spec["value"]],
        "parts": _parts_summary(components),
        "fabrication": [_text(item, 200) for item in _list(mechanical.get("fabrication_details"))[:6] if _text(item)],
        "product_model": metadata.get("product_model") if isinstance(metadata.get("product_model"), dict) else None,
        "mechanical": {
            key: mechanical.get(key)
            for key in ("physical_form", "enclosure_type", "render_dimensions", "component_placements")
            if mechanical.get(key) is not None
        },
        "components": [
            {"ref_des": _dict(item).get("ref_des"), "name": _dict(item).get("name"), "category": _dict(item).get("category")}
            for item in components[:60]
        ],
    }


def design_image_sources(ir: Dict[str, Any]) -> List[Dict[str, str]]:
    """Generated product views (URL or inline data) in display order, without diagrams."""
    metadata = _dict(ir.get("assembly_metadata"))
    sources: List[Dict[str, str]] = []
    for item in _list(metadata.get("product_visual_sequence")):
        record = _dict(item)
        if str(record.get("view_id") or "").lower() == "diagram":
            continue
        source = record.get("url") or record.get("data")
        if isinstance(source, str) and source:
            sources.append({"source": source, "label": _text(record.get("label") or "Product view", 60)})
    if not sources:
        for key in ("product_image_url", "product_image_data"):
            if isinstance(metadata.get(key), str) and metadata[key]:
                sources.append({"source": metadata[key], "label": "Product view"})
                break
    return sources[:MAX_PITCH_IMAGES]


def copy_pitch_images(
    sources: List[Dict[str, str]],
    put_file: Callable[[str, bytes, str], str],
    key_prefix: str,
) -> List[Dict[str, str]]:
    """Re-encode each image and publish it, so the page never depends on expiring signed links."""
    images: List[Dict[str, str]] = []
    for index, item in enumerate(sources):
        source = item["source"]
        try:
            if source.startswith(("http://", "https://")):
                safe = fetch_trusted_image(source, max_bytes=12 * 1024 * 1024, resize_to=PITCH_IMAGE_SIZE)
            else:
                safe = sanitize_inline_image(source, max_bytes=12 * 1024 * 1024, resize_to=PITCH_IMAGE_SIZE)
        except UnsafeImageError as exc:
            logger.warning("Skipping product page image %s: %s", index, exc)
            continue
        extension = "png" if safe.content_type == "image/png" else "jpg"
        url = put_file(f"{key_prefix}-{index + 1}.{extension}", safe.content, safe.content_type)
        images.append({"url": url, "label": item["label"]})
    return images


def write_pitch_copy(snapshot: Dict[str, Any], coin_name: str, generate: Optional[Callable[[str], PitchCopy]] = None) -> Optional[Dict[str, Any]]:
    """Short product-page copy from the snapshot. Returns None when no model is available."""
    facts = {key: snapshot.get(key) for key in ("title", "description", "category", "features", "specs", "parts", "fabrication")}
    prompt = f"""
    You are writing the product page for a hardware product idea that now has a community coin named {coin_name!r}.
    Use only the facts below; do not invent capabilities, certifications, prices, partnerships or launch dates,
    and never promise financial returns or mention the coin's price. Write plainly for a general audience.

    Facts:
    {json.dumps(facts, indent=2, ensure_ascii=False)}

    Return PitchCopy.
    """
    try:
        if generate is None:
            from forma_core.llm import build_llm_provider

            provider = build_llm_provider()
            generate = lambda text: provider.generate_structured(text, PitchCopy)  # noqa: E731
        copy = generate(prompt)
    except Exception as exc:
        logger.warning("Product page copy generation failed; using design facts only: %s", exc)
        return None
    return {
        "tagline": _text(copy.tagline, 120),
        "pitch": _text(copy.pitch, 700),
        "highlights": [_text(item, 140) for item in copy.highlights[:6] if _text(item)],
        "use_cases": [
            {"title": _text(item.title, 60), "detail": _text(item.detail, 240)}
            for item in copy.use_cases[:5]
            if _text(item.title)
        ],
        "audience": _text(copy.audience, 240),
        "materials": [_text(item, 100) for item in copy.materials[:6] if _text(item)],
    }


def build_pitch(
    ir: Dict[str, Any],
    *,
    project_id: str,
    coin_name: str,
    put_file: Callable[[str, bytes, str], str],
    key_prefix: str,
    generate: Optional[Callable[[str], PitchCopy]] = None,
) -> Dict[str, Any]:
    snapshot = snapshot_design(ir, project_id)
    snapshot["images"] = copy_pitch_images(design_image_sources(ir), put_file, key_prefix)
    snapshot["copy"] = write_pitch_copy(snapshot, coin_name, generate)
    snapshot["generated_at"] = dt.datetime.now(dt.timezone.utc).isoformat()
    return snapshot
