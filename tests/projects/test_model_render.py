from __future__ import annotations

import base64
import io
import types
import unittest

from PIL import Image

from forma_core.image_providers import GeneratedImage, ImageProvider, build_model_view_prompt
from forma_core.model_render import render_model_views, resolve_model_parts
from forma_core.workspaces.projects.models import HardwareIntermediateRepresentation, ProjectOverview
from forma_core.workspaces.projects.output import attach_product_image


def _part(label, shape, size, position, color="#9aa4b2", casing=False):
    return {
        "label": label,
        "shape": shape,
        "size_mm": {"x_mm": size[0], "y_mm": size[1], "z_mm": size[2]},
        "position_mm": {"x_mm": position[0], "y_mm": position[1], "z_mm": position[2]},
        "color_hex": color,
        "finish": "matte",
        "is_casing": casing,
    }


BOTTLE = {
    "parts": [
        _part("Bottle body", "cylinder", (76, 76, 250), (0, 0, 125), "#b9c2cc", casing=True),
        _part("Controller board", "box", (40, 30, 2), (0, 0, 200), "#2e7d4f"),
        _part("Display", "box", (30, 18, 2), (0, 0, 251), "#11161f"),
    ]
}


def _png_size(data_url: str) -> tuple[int, int]:
    raw = base64.b64decode(data_url.split(",", 1)[1])
    return Image.open(io.BytesIO(raw)).size


class ModelRenderTests(unittest.TestCase):
    def test_parts_match_the_viewer_rules(self) -> None:
        ir = types.SimpleNamespace(assembly_metadata={"product_model": BOTTLE}, mechanical=None, components=[])
        parts = resolve_model_parts(ir)
        self.assertIsNotNone(parts)
        by_label = {part.label: part for part in parts}
        self.assertTrue(by_label["Bottle body"].is_casing)
        self.assertTrue(by_label["Controller board"].is_internal)
        # Pokes out of the top of the body, so it is a visible surface part.
        self.assertFalse(by_label["Display"].is_internal)

    def test_draws_exterior_rear_and_xray_views(self) -> None:
        ir = types.SimpleNamespace(assembly_metadata={"product_model": BOTTLE}, mechanical=None, components=[])
        views = render_model_views(ir, size=256)
        self.assertEqual(["case", "rear", "inside"], [view.view_id for view in views])
        for view in views:
            self.assertEqual((256, 256), _png_size(view.data_url))

    def test_no_inside_view_without_internal_parts(self) -> None:
        model = {"parts": [_part("Shell", "rounded_box", (80, 40, 30), (0, 0, 15), casing=True)]}
        ir = types.SimpleNamespace(assembly_metadata={"product_model": model}, mechanical=None, components=[])
        self.assertEqual(["case", "rear"], [view.view_id for view in render_model_views(ir, size=128)])

    def test_falls_back_to_the_mechanical_envelope(self) -> None:
        mechanical = {
            "render_dimensions": {"x_mm": 90, "y_mm": 60, "z_mm": 30},
            "component_placements": [{"ref_des": "U1", "label": "MCU", "position": {"x_mm": 0, "y_mm": 0, "z_mm": 0}, "size": {"x_mm": 20, "y_mm": 20, "z_mm": 4}}],
        }
        ir = types.SimpleNamespace(assembly_metadata={}, mechanical=mechanical, components=[])
        parts = resolve_model_parts(ir)
        self.assertEqual(["Enclosure", "MCU"], [part.label for part in parts])
        self.assertTrue(parts[1].is_internal)

    def test_no_model_means_no_views(self) -> None:
        ir = types.SimpleNamespace(assembly_metadata={}, mechanical=None, components=[])
        self.assertEqual([], render_model_views(ir))


class _EditingProvider(ImageProvider):
    provider_name = "openai"
    model_name = "gpt-image-2"
    is_configured = True
    enabled = True

    def __init__(self, fail_on: set[str] | None = None) -> None:
        self.fail_on = fail_on or set()
        self.edits: list[tuple[str, GeneratedImage]] = []

    def get_debug_config(self):
        return {"provider": "openai", "model_name": "gpt-image-2", "enabled": True, "configured": True}

    def generate_project_image_sequence(self, _prompt, _ir):
        raise AssertionError("Designs with a 3D model must not be rendered from text alone.")

    def _edit_image_from_prompt(self, prompt, reference, *, view_id, label, reference_view_id):
        if view_id in self.fail_on:
            raise RuntimeError("edit failed")
        self.edits.append((prompt, reference))
        return GeneratedImage(
            data_url=reference.data_url,
            provider="openai",
            model="gpt-image-2",
            size="1024x1024",
            prompt=prompt,
            view_id=view_id,
            label=label,
            reference_view_id=reference_view_id,
        )


class RendersFollowTheModelTests(unittest.TestCase):
    def _ir(self) -> HardwareIntermediateRepresentation:
        return HardwareIntermediateRepresentation(
            overview=ProjectOverview(title="Smart bottle", description="Shows water temperature.", difficulty="Beginner", category="IoT"),
            assembly_metadata={"project_id": "29f2853c-ba3e-425a-b4c2-60f91cd2398b", "product_model": BOTTLE},
        )

    def _attach(self, provider: ImageProvider) -> dict:
        ir = self._ir()
        attach_product_image(
            "test prompt",
            ir,
            generate_image=True,
            provider_factory=lambda **_kwargs: provider,
            storage_handler=lambda *_args, **_kwargs: {},
        )
        return ir.assembly_metadata

    def test_each_render_restyles_a_drawing_of_the_3d_model(self) -> None:
        provider = _EditingProvider()
        metadata = self._attach(provider)
        self.assertEqual("succeeded", metadata["image_output_status"])
        self.assertEqual("3d_model", metadata["product_visual_source"])
        self.assertEqual(["case", "rear", "inside"], [item["view_id"] for item in metadata["product_visual_sequence"]])
        self.assertEqual(3, len(provider.edits))
        for prompt, reference in provider.edits:
            self.assertEqual("bluebuild", reference.provider)
            self.assertIn("exact 3D model", prompt)

    def test_a_failed_edit_keeps_the_plain_drawing(self) -> None:
        metadata = self._attach(_EditingProvider(fail_on={"rear"}))
        rear = next(item for item in metadata["product_visual_sequence"] if item["view_id"] == "rear")
        self.assertEqual("bluebuild", rear["provider"])

    def test_inside_prompt_asks_for_a_cut_away(self) -> None:
        self.assertIn("cut-away", build_model_view_prompt("x", self._ir(), "inside"))


if __name__ == "__main__":
    unittest.main()
