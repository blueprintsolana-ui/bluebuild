"""Simple primitive-shape description of the finished product for the 3D overview viewer.

This is a visual model, not manufacturing CAD: the product is approximated by a
handful of boxes, cylinders and similar solids that the web app renders with
three.js, with numbered labels and an X-ray view of the internals.
"""

from __future__ import annotations

import json
from typing import Any, Iterable, List, Literal, Optional

from pydantic import BaseModel, Field

from forma_core.agents.system_architecture import compact_component_context
from forma_core.workspaces.projects.models import (
    ComponentInstance,
    MechanicalNotes,
    MechanicalRotation3,
    MechanicalVector3,
    ProjectOverview,
)


ProductShape = Literal["box", "rounded_box", "cylinder", "tube", "cone", "sphere", "capsule", "torus"]
ProductFinish = Literal["metal", "matte", "gloss", "glass", "screen", "pcb", "rubber"]


class ProductModelPart(BaseModel):
    label: str = Field(..., description="Short legend name, e.g. 'Bottle body', 'Lid', 'OLED screen', 'Battery'")
    shape: ProductShape = Field(..., description="Primitive solid used to draw this part")
    size_mm: MechanicalVector3 = Field(
        ...,
        description=(
            "Part size in millimeters. box/rounded_box: width x, depth y, height z. cylinder/tube/cone/capsule: "
            "x is the diameter and z the height. sphere: x is the diameter. torus: x is the outer diameter and "
            "y the ring thickness."
        ),
    )
    position_mm: MechanicalVector3 = Field(
        ...,
        description="Center of the part in millimeters. Origin is the center of the product footprint on the ground; Z is up.",
    )
    rotation_deg: MechanicalRotation3 = Field(default_factory=MechanicalRotation3, description="Rotation in degrees")
    color_hex: str = Field("#9aa4b2", description="Realistic display color as #RRGGBB")
    finish: ProductFinish = Field("matte", description="Surface look used for shading")
    is_casing: bool = Field(
        False,
        description="True for outer shell parts (body, lid, housing). The X-ray view makes these see-through.",
    )
    wall_thickness_mm: Optional[float] = Field(None, description="Wall thickness for tube shapes")
    ref_des: Optional[str] = Field(None, description="BOM reference designator when the part is a listed component")


class ProductModel(BaseModel):
    overall_size_mm: Optional[MechanicalVector3] = Field(None, description="Overall product envelope in millimeters")
    parts: List[ProductModelPart] = Field(default_factory=list)


def product_model_prompt(
    overview: ProjectOverview,
    components: Iterable[ComponentInstance],
    mechanical: Optional[MechanicalNotes],
) -> str:
    mechanical_context: dict[str, Any] = {}
    if mechanical is not None:
        mechanical_context = mechanical.model_dump(
            mode="json",
            include={"physical_form", "enclosure_type", "render_dimensions", "component_placements"},
        )
    return f"""
    You are a Product Visualization Agent. Describe the finished, assembled product as 6 to 20 simple solid
    shapes so the web app can draw a recognizable 3D model of it. This is a visual model, not manufacturing CAD.

    Project:
    {overview.model_dump_json()}

    Components:
    {json.dumps(compact_component_context(components), indent=2)}

    Mechanical guide (follow its form, dimensions and placements when present):
    {json.dumps(mechanical_context, indent=2)}

    Rules:
    - Model the outer product first with realistic proportions and real-world sizes (for example a 1 L bottle is
      roughly 75 mm wide and 270 mm tall). Mark every outer shell part with is_casing true.
    - Then place the important internal electronics (controller board, battery, sensors, actuators) inside the
      casing, each with its ref_des. They must fit inside the casing envelope.
    - Visible user-facing parts such as screens, buttons, LEDs and ports sit on the outer surface, facing out,
      with is_casing false so they stay visible in the X-ray view.
    - Use believable colors: brushed metal greys, black plastics, green circuit boards, dark glass screens.
    - Origin is the center of the footprint on the ground; Z points up, so the lowest part has a center Z of half
      its height.
    - Use a short, distinct label for every part.

    Return ProductModel.
    """
