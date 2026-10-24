"""Draw the saved 3D product model to PNG images on the server.

The project's interactive 3D view (apps/web/components/product-model-viewer.tsx) is built
from simple solids in ``assembly_metadata.product_model`` (or, for older designs, from the
mechanical render envelope and component placements). The product renders used to come from
an image model working from a text description, so they never matched that 3D model. These
drawings are made from exactly the same solids, with the same axes and camera directions as
the viewer, and are handed to the image model as the reference picture to restyle.

Only Pillow is used (no GPU, no numpy): triangles are depth-sorted and painted back to front,
with faces subdivided so the sort stays correct where parts touch.
"""

from __future__ import annotations

import base64
import io
import math
import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from PIL import Image, ImageDraw, ImageFilter

Vec = Tuple[float, float, float]

SHAPES = {"box", "rounded_box", "cylinder", "tube", "cone", "sphere", "capsule", "torus"}
FINISHES = {"metal", "matte", "gloss", "glass", "screen", "pcb", "rubber"}
MAX_PARTS = 40
INTERNAL_INSET_MM = 2.0

CATEGORY_LOOK: Dict[str, Tuple[str, str]] = {
    "microcontroller": ("#1f6f43", "pcb"),
    "mcu": ("#1f6f43", "pcb"),
    "display": ("#11161f", "screen"),
    "sensor": ("#2f5f9e", "pcb"),
    "power": ("#c9a227", "matte"),
    "battery": ("#c9a227", "matte"),
    "actuator": ("#b5652b", "metal"),
    "communication": ("#5b4a9e", "pcb"),
    "passives": ("#6b7280", "matte"),
    "connector": ("#30343b", "matte"),
}

# Camera directions in scene space (Y up), matching the viewer's ISO button. The rear view
# turns the same direction 135 degrees around the vertical axis.
ISO_DIRECTION: Vec = (1.0, 0.42, 1.15)
CAMERA_FOV_DEG = 36.0

BACKGROUND = (233, 236, 240)
XRAY_EDGE = (120, 140, 170)


@dataclass
class ModelPart:
    label: str
    shape: str
    size: Vec  # millimetres, model axes (Z up)
    position: Vec
    rotation_deg: Vec
    color: str
    finish: str
    is_casing: bool
    is_internal: bool = False


@dataclass
class ModelView:
    view_id: str
    label: str
    png: bytes

    @property
    def data_url(self) -> str:
        return "data:image/png;base64," + base64.b64encode(self.png).decode("ascii")


# ---------------------------------------------------------------------------
# Resolving the model (mirrors apps/web/lib/product-model.ts)
# ---------------------------------------------------------------------------


def _number(value: Any, fallback: float) -> float:
    try:
        parsed = float(value)
    except (TypeError, ValueError):
        return fallback
    return parsed if math.isfinite(parsed) else fallback


def _vector(value: Any, fallback: Vec, keys: Tuple[str, str, str] = ("x_mm", "y_mm", "z_mm")) -> Vec:
    if isinstance(value, (list, tuple)):
        items = list(value) + [None, None, None]
        return (_number(items[0], fallback[0]), _number(items[1], fallback[1]), _number(items[2], fallback[2]))
    if isinstance(value, dict):
        return (
            _number(value.get(keys[0], value.get("x")), fallback[0]),
            _number(value.get(keys[1], value.get("y")), fallback[1]),
            _number(value.get(keys[2], value.get("z")), fallback[2]),
        )
    return fallback


def _positive(size: Vec, fallback: float = 10.0) -> Vec:
    return tuple(min(value, 5000.0) if value > 0 else fallback for value in size)  # type: ignore[return-value]


def _hex(value: Any, fallback: str) -> str:
    if isinstance(value, str) and re.fullmatch(r"#[0-9a-fA-F]{6}", value.strip()):
        return value.strip()
    return fallback


def half_extents(part: ModelPart) -> Vec:
    x, y, z = part.size
    if part.shape in {"cylinder", "tube", "cone", "capsule"}:
        return (x / 2, x / 2, z / 2)
    if part.shape == "sphere":
        return (x / 2, x / 2, x / 2)
    if part.shape == "torus":
        return (x / 2, x / 2, y / 2)
    return (x / 2, y / 2, z / 2)


def _inside_casing(part: ModelPart, casing: Sequence[ModelPart]) -> bool:
    half = half_extents(part)
    for shell in casing:
        shell_half = half_extents(shell)
        if all(
            part.position[axis] - half[axis] >= shell.position[axis] - shell_half[axis] + INTERNAL_INSET_MM
            and part.position[axis] + half[axis] <= shell.position[axis] + shell_half[axis] - INTERNAL_INSET_MM
            for axis in range(3)
        ):
            return True
    return False


def _finalize(parts: List[ModelPart]) -> Optional[List[ModelPart]]:
    parts = parts[:MAX_PARTS]
    if not parts:
        return None
    casing = [part for part in parts if part.is_casing]
    for part in parts:
        part.is_internal = not part.is_casing and _inside_casing(part, casing)
    return parts


def _from_product_model(model: Any) -> Optional[List[ModelPart]]:
    raw_parts = model.get("parts") if isinstance(model, dict) else None
    if not isinstance(raw_parts, list):
        return None
    parts: List[ModelPart] = []
    for raw in raw_parts:
        if not isinstance(raw, dict):
            continue
        shape = str(raw.get("shape") or "")
        if shape not in SHAPES:
            continue
        finish = str(raw.get("finish") or "matte")
        parts.append(
            ModelPart(
                label=str(raw.get("label") or "Part")[:60],
                shape=shape,
                size=_positive(_vector(raw.get("size_mm"), (10.0, 10.0, 10.0))),
                position=_vector(raw.get("position_mm"), (0.0, 0.0, 0.0)),
                rotation_deg=_vector(raw.get("rotation_deg"), (0.0, 0.0, 0.0), ("x_deg", "y_deg", "z_deg")),
                color=_hex(raw.get("color_hex"), "#9aa4b2"),
                finish=finish if finish in FINISHES else "matte",
                is_casing=raw.get("is_casing") is True,
            )
        )
    return _finalize(parts)


def _as_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    dump = getattr(value, "model_dump", None)
    if callable(dump):
        try:
            dumped = dump(mode="json")
        except Exception:
            return {}
        return dumped if isinstance(dumped, dict) else {}
    return {}


def _is_enclosure_placement(placement: Dict[str, Any]) -> bool:
    text = f"{placement.get('layer') or ''} {placement.get('category') or ''} {placement.get('label') or ''}".lower()
    return bool(re.search(r"\benclosure\b|\bhousing\b|\bcase\b|\bchassis\b|\bshell\b", text))


def _from_mechanical(mechanical: Any, components: Iterable[Any]) -> Optional[List[ModelPart]]:
    notes = _as_dict(mechanical)
    placements = [item for item in (notes.get("component_placements") or []) if isinstance(item, dict)]
    dimensions = _positive(_vector(notes.get("render_dimensions"), (0.0, 0.0, 0.0)), 0.0) if notes.get("render_dimensions") else None
    if not placements and not dimensions:
        return None
    by_ref: Dict[str, Dict[str, Any]] = {}
    for component in components or []:
        record = _as_dict(component)
        if isinstance(record.get("ref_des"), str):
            by_ref[record["ref_des"]] = record
    envelope: Vec = dimensions if dimensions and all(value > 0 for value in dimensions) else (100.0, 60.0, 40.0)
    form = f"{notes.get('physical_form') or ''} {notes.get('enclosure_type') or ''}".lower()
    round_form = bool(re.search(r"cylind|bottle|tube|round|can\b|cup|jar|flask|tumbler|puck|disc|disk", form))
    width = max(envelope[0], envelope[1])
    parts = [
        ModelPart(
            label="Body" if round_form else "Enclosure",
            shape="cylinder" if round_form else "rounded_box",
            size=(width, width, envelope[2]) if round_form else envelope,
            position=(0.0, 0.0, envelope[2] / 2),
            rotation_deg=(0.0, 0.0, 0.0),
            color="#aeb6c2",
            finish="metal",
            is_casing=True,
        )
    ]
    for placement in placements:
        if _is_enclosure_placement(placement):
            continue
        ref = placement.get("ref_des") if isinstance(placement.get("ref_des"), str) else None
        component = by_ref.get(ref or "", {})
        category = str(placement.get("category") or component.get("category") or "").lower()
        color, finish = CATEGORY_LOOK.get(category, ("#6b7280", "matte"))
        center = _vector(placement.get("position"), (0.0, 0.0, 0.0))
        parts.append(
            ModelPart(
                label=str(placement.get("label") or component.get("name") or ref or "Part")[:60],
                shape="box",
                size=_positive(_vector(placement.get("size"), (12.0, 12.0, 4.0))),
                position=(center[0], center[1], center[2] + envelope[2] / 2),
                rotation_deg=_vector(placement.get("orientation_deg"), (0.0, 0.0, 0.0), ("x_deg", "y_deg", "z_deg")),
                color=color,
                finish=finish,
                is_casing=False,
            )
        )
    return _finalize(parts)


def resolve_model_parts(ir: Any) -> Optional[List[ModelPart]]:
    """The same solids the 3D viewer shows, or None when the design has no model."""
    metadata = getattr(ir, "assembly_metadata", None) or {}
    parts = _from_product_model(metadata.get("product_model") if isinstance(metadata, dict) else None)
    if parts:
        return parts
    return _from_mechanical(getattr(ir, "mechanical", None), getattr(ir, "components", None) or [])


# ---------------------------------------------------------------------------
# Geometry (scene space: Y up, as in three.js; model Z becomes scene Y)
# ---------------------------------------------------------------------------

Tri = Tuple[Vec, Vec, Vec]


def _sub(a: Vec, b: Vec) -> Vec:
    return (a[0] - b[0], a[1] - b[1], a[2] - b[2])


def _add(a: Vec, b: Vec) -> Vec:
    return (a[0] + b[0], a[1] + b[1], a[2] + b[2])


def _scale(a: Vec, s: float) -> Vec:
    return (a[0] * s, a[1] * s, a[2] * s)


def _dot(a: Vec, b: Vec) -> float:
    return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]


def _cross(a: Vec, b: Vec) -> Vec:
    return (a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0])


def _norm(a: Vec) -> Vec:
    length = math.sqrt(_dot(a, a)) or 1.0
    return (a[0] / length, a[1] / length, a[2] / length)


def _quad(a: Vec, b: Vec, c: Vec, d: Vec) -> List[Tri]:
    return [(a, b, c), (a, c, d)]


def _grid(origin: Vec, u: Vec, v: Vec, nu: int, nv: int) -> List[Tri]:
    tris: List[Tri] = []
    for i in range(nu):
        for j in range(nv):
            p00 = _add(origin, _add(_scale(u, i / nu), _scale(v, j / nv)))
            p10 = _add(origin, _add(_scale(u, (i + 1) / nu), _scale(v, j / nv)))
            p11 = _add(origin, _add(_scale(u, (i + 1) / nu), _scale(v, (j + 1) / nv)))
            p01 = _add(origin, _add(_scale(u, i / nu), _scale(v, (j + 1) / nv)))
            tris.extend(_quad(p00, p10, p11, p01))
    return tris


def _steps(length: float, cell: float, cap: int = 30) -> int:
    return max(1, min(cap, int(math.ceil(length / max(cell, 1e-6)))))


def _box(w: float, h: float, d: float, cell: float) -> List[Tri]:
    x, y, z = w / 2, h / 2, d / 2
    nw, nh, nd = _steps(w, cell), _steps(h, cell), _steps(d, cell)
    return (
        _grid((-x, -y, z), (w, 0, 0), (0, h, 0), nw, nh)  # front
        + _grid((x, -y, -z), (-w, 0, 0), (0, h, 0), nw, nh)  # back
        + _grid((x, -y, z), (0, 0, -d), (0, h, 0), nd, nh)  # right
        + _grid((-x, -y, -z), (0, 0, d), (0, h, 0), nd, nh)  # left
        + _grid((-x, y, z), (w, 0, 0), (0, 0, -d), nw, nd)  # top
        + _grid((-x, -y, -z), (w, 0, 0), (0, 0, d), nw, nd)  # bottom
    )


def _lathe(profile: Sequence[Tuple[float, float]], segments: int = 32) -> List[Tri]:
    """Revolve (radius, y) points around the Y axis."""
    tris: List[Tri] = []
    for s in range(segments):
        a0 = 2 * math.pi * s / segments
        a1 = 2 * math.pi * (s + 1) / segments
        for (r0, y0), (r1, y1) in zip(profile, profile[1:]):
            p00 = (r0 * math.sin(a0), y0, r0 * math.cos(a0))
            p01 = (r0 * math.sin(a1), y0, r0 * math.cos(a1))
            p10 = (r1 * math.sin(a0), y1, r1 * math.cos(a0))
            p11 = (r1 * math.sin(a1), y1, r1 * math.cos(a1))
            if r0 < 1e-9:
                tris.append((p00, p11, p10))
            elif r1 < 1e-9:
                tris.append((p00, p01, p10))
            else:
                tris.extend(_quad(p00, p01, p11, p10))
    return tris


def _disc_profile(radius: float, y: float, rings: int, outward_up: bool) -> List[Tuple[float, float]]:
    points = [(radius * i / rings, y) for i in range(rings + 1)]
    return points if outward_up else list(reversed(points))


def _cylinder(radius: float, height: float, cell: float) -> List[Tri]:
    rows = _steps(height, cell)
    rings = _steps(radius, cell, 6)
    side = [(radius, -height / 2 + height * i / rows) for i in range(rows + 1)]
    return (
        _lathe(list(reversed(_disc_profile(radius, -height / 2, rings, True))))
        + _lathe(side)
        + _lathe(list(reversed(_disc_profile(radius, height / 2, rings, False))))
    )


def _cone(radius: float, height: float, cell: float) -> List[Tri]:
    rows = _steps(height, cell)
    rings = _steps(radius, cell, 6)
    side = [(radius * (1 - i / rows), -height / 2 + height * i / rows) for i in range(rows + 1)]
    return _lathe(list(reversed(_disc_profile(radius, -height / 2, rings, True)))) + _lathe(side)


def _sphere_profile(radius: float, center_y: float, start: float, end: float, steps: int) -> List[Tuple[float, float]]:
    return [
        (radius * math.sin(start + (end - start) * i / steps), center_y - radius * math.cos(start + (end - start) * i / steps))
        for i in range(steps + 1)
    ]


def _sphere(radius: float) -> List[Tri]:
    return _lathe(_sphere_profile(radius, 0.0, 0.0, math.pi, 14), 28)


def _capsule(radius: float, length: float, cell: float) -> List[Tri]:
    bottom = _sphere_profile(radius, -length / 2, 0.0, math.pi / 2, 7)
    rows = _steps(length, cell)
    side = [(radius, -length / 2 + length * i / rows) for i in range(1, rows + 1)] if length > 0 else []
    top = _sphere_profile(radius, length / 2, math.pi / 2, math.pi, 7)[1:]
    return _lathe(bottom + side + top, 28)


def _torus(major: float, minor: float) -> List[Tri]:
    """Ring around the Z axis (three.js TorusGeometry); the viewer then turns it flat."""
    tris: List[Tri] = []
    seg_u, seg_v = 40, 14

    def point(u: float, v: float) -> Vec:
        return ((major + minor * math.cos(v)) * math.cos(u), (major + minor * math.cos(v)) * math.sin(u), minor * math.sin(v))

    for i in range(seg_u):
        for j in range(seg_v):
            u0, u1 = 2 * math.pi * i / seg_u, 2 * math.pi * (i + 1) / seg_u
            v0, v1 = 2 * math.pi * j / seg_v, 2 * math.pi * (j + 1) / seg_v
            tris.extend(_quad(point(u0, v0), point(u1, v0), point(u1, v1), point(u0, v1)))
    return tris


def _local_triangles(part: ModelPart, cell: float) -> Tuple[List[Tri], str]:
    x, y, z = part.size
    if part.shape in {"box", "rounded_box"}:
        return _box(x, z, y, cell), "convex"
    if part.shape in {"cylinder", "tube"}:
        return _cylinder(x / 2, z, cell), "convex"
    if part.shape == "cone":
        return _cone(x / 2, z, cell), "convex"
    if part.shape == "sphere":
        return _sphere(x / 2), "convex"
    if part.shape == "capsule":
        return _capsule(x / 2, max(z - x, 0.0), cell), "convex"
    major = max((x - y) / 2, y / 2)
    return _torus(major, y / 2), "torus"


def _rotation(rx: float, ry: float, rz: float):
    cx, sx = math.cos(rx), math.sin(rx)
    cy, sy = math.cos(ry), math.sin(ry)
    cz, sz = math.cos(rz), math.sin(rz)
    # three.js Euler order "XYZ": R = Rx * Ry * Rz.
    return (
        (cy * cz, -cy * sz, sy),
        (cx * sz + sx * sy * cz, cx * cz - sx * sy * sz, -sx * cy),
        (sx * sz - cx * sy * cz, sx * cz + cx * sy * sz, cx * cy),
    )


def _apply(matrix, v: Vec) -> Vec:
    return (_dot(matrix[0], v), _dot(matrix[1], v), _dot(matrix[2], v))


def _orient_outward(tris: List[Tri], kind: str, major: float = 0.0) -> List[Tri]:
    """Make every triangle wind counter-clockwise when seen from outside the solid."""
    oriented: List[Tri] = []
    for a, b, c in tris:
        normal = _cross(_sub(b, a), _sub(c, a))
        centroid = _scale(_add(_add(a, b), c), 1 / 3)
        if kind == "torus":
            ring = math.hypot(centroid[0], centroid[1]) or 1.0
            inside = (centroid[0] / ring * major, centroid[1] / ring * major, 0.0)
        else:
            inside = (0.0, 0.0, 0.0)
        oriented.append((a, b, c) if _dot(normal, _sub(centroid, inside)) >= 0 else (a, c, b))
    return oriented


@dataclass
class _Mesh:
    part: ModelPart
    tris: List[Tri]


CONVEX_SHAPES = {"box", "rounded_box", "cylinder", "tube", "cone", "sphere", "capsule"}
Plane = Tuple[Vec, float]


def _planes(mesh: _Mesh) -> List[Plane]:
    """Outward face planes of a convex shell (n . p = d)."""
    seen: Dict[Tuple[int, int, int, int], Plane] = {}
    for a, b, c in mesh.tris:
        normal = _norm(_cross(_sub(b, a), _sub(c, a)))
        offset = _dot(normal, a)
        key = (round(normal[0] * 1000), round(normal[1] * 1000), round(normal[2] * 1000), round(offset * 10))
        seen.setdefault(key, (normal, offset))
    return list(seen.values())


def _clip(polygon: List[Vec], plane: Plane, keep_outside: bool) -> List[Vec]:
    """Sutherland-Hodgman: the part of `polygon` on one side of `plane`."""
    normal, offset = plane

    def side(point: Vec) -> float:
        value = _dot(normal, point) - offset
        return value if keep_outside else -value

    kept: List[Vec] = []
    for index, current in enumerate(polygon):
        previous = polygon[index - 1]
        current_side, previous_side = side(current), side(previous)
        if current_side >= 0:
            if previous_side < 0:
                t = previous_side / (previous_side - current_side)
                kept.append(_add(previous, _scale(_sub(current, previous), t)))
            kept.append(current)
        elif previous_side >= 0:
            t = previous_side / (previous_side - current_side)
            kept.append(_add(previous, _scale(_sub(current, previous), t)))
    return kept


def _outside_shell(tri: Tri, planes: Sequence[Plane]) -> List[Tri]:
    """The pieces of a triangle that lie outside a convex shell."""
    for normal, offset in planes:
        if all(_dot(normal, v) - offset >= -1e-6 for v in tri):
            return [tri]  # wholly outside one face plane
    pieces: List[List[Vec]] = []
    remaining: List[Vec] = list(tri)
    for plane in planes:
        outside = _clip(remaining, plane, keep_outside=True)
        if len(outside) >= 3:
            pieces.append(outside)
        remaining = _clip(remaining, plane, keep_outside=False)
        if len(remaining) < 3:
            break
    return [(polygon[0], polygon[i], polygon[i + 1]) for polygon in pieces for i in range(1, len(polygon) - 1)]


def _cut_away_inside_shells(meshes: List[_Mesh]) -> List[_Mesh]:
    """Remove the parts of non-shell solids that sit inside a shell (they cannot be seen from outside)."""
    shells = [_planes(mesh) for mesh in meshes if mesh.part.is_casing and mesh.part.shape in CONVEX_SHAPES]
    if not shells:
        return meshes
    trimmed: List[_Mesh] = []
    for mesh in meshes:
        if mesh.part.is_casing:
            trimmed.append(mesh)
            continue
        tris = mesh.tris
        for planes in shells:
            tris = [piece for tri in tris for piece in _outside_shell(tri, planes)]
        trimmed.append(_Mesh(mesh.part, tris))
    return trimmed


def _scene_meshes(parts: Sequence[ModelPart]) -> List[_Mesh]:
    largest = max(max(part.size) for part in parts)
    cell = max(largest / 24.0, 0.5)
    meshes: List[_Mesh] = []
    for part in parts:
        local, kind = _local_triangles(part, cell)
        major = max((part.size[0] - part.size[1]) / 2, part.size[1] / 2) if kind == "torus" else 0.0
        local = _orient_outward(local, kind, major)
        rx, ry, rz = (math.radians(value) for value in (part.rotation_deg[0], part.rotation_deg[2], -part.rotation_deg[1]))
        if part.shape == "torus":
            rx += math.pi / 2
        matrix = _rotation(rx, ry, rz)
        offset: Vec = (part.position[0], part.position[2], -part.position[1])
        meshes.append(_Mesh(part, [tuple(_add(_apply(matrix, v), offset) for v in tri) for tri in local]))  # type: ignore[misc]
    return meshes


# ---------------------------------------------------------------------------
# Rendering
# ---------------------------------------------------------------------------

KEY_LIGHT = _norm((4.0, 7.0, 5.0))
FILL_LIGHT = _norm((-5.0, 3.0, -4.0))


def _rgb(hex_color: str) -> Tuple[int, int, int]:
    value = hex_color.lstrip("#")
    return (int(value[0:2], 16), int(value[2:4], 16), int(value[4:6], 16))


def _shade(
    color: Tuple[int, int, int],
    normal: Vec,
    finish: str,
    to_camera: Vec,
    key: Vec = KEY_LIGHT,
    fill: Vec = FILL_LIGHT,
) -> Tuple[int, int, int]:
    diffuse = 0.42 + 0.62 * max(0.0, _dot(normal, key)) + 0.22 * max(0.0, _dot(normal, fill))
    highlight = 0.0
    if finish in {"metal", "gloss", "glass", "screen"}:
        half = _norm(_add(key, to_camera))
        highlight = (0.35 if finish == "metal" else 0.25) * max(0.0, _dot(normal, half)) ** 24
    return tuple(max(0, min(255, int(channel * diffuse + 255 * highlight))) for channel in color)  # type: ignore[return-value]


def _rotate_y(v: Vec, degrees: float) -> Vec:
    angle = math.radians(degrees)
    return (v[0] * math.cos(angle) + v[2] * math.sin(angle), v[1], -v[0] * math.sin(angle) + v[2] * math.cos(angle))


def _feature_edges(tris: Sequence[Tri], threshold_deg: float = 20.0) -> List[Tuple[Vec, Vec]]:
    def key(v: Vec) -> Tuple[int, int, int]:
        return (round(v[0] * 100), round(v[1] * 100), round(v[2] * 100))

    faces: Dict[Tuple[Tuple[int, int, int], Tuple[int, int, int]], List[Vec]] = {}
    points: Dict[Tuple[int, int, int], Vec] = {}
    for a, b, c in tris:
        normal = _norm(_cross(_sub(b, a), _sub(c, a)))
        for p, q in ((a, b), (b, c), (c, a)):
            kp, kq = key(p), key(q)
            points[kp], points[kq] = p, q
            faces.setdefault((min(kp, kq), max(kp, kq)), []).append(normal)
    limit = math.cos(math.radians(threshold_deg))
    edges: List[Tuple[Vec, Vec]] = []
    for (kp, kq), normals in faces.items():
        if len(normals) == 1 or (len(normals) >= 2 and _dot(normals[0], normals[1]) < limit):
            edges.append((points[kp], points[kq]))
    return edges


def render_view(
    parts: Sequence[ModelPart],
    *,
    direction: Vec = ISO_DIRECTION,
    light_yaw_deg: float = 0.0,
    xray: bool = False,
    size: int = 1024,
    supersample: int = 2,
) -> bytes:
    """Draw the model from `direction` (scene space). X-ray ghosts the casing and shows internals."""
    meshes = _scene_meshes([part for part in parts if xray or not part.is_internal])
    if not xray:
        meshes = _cut_away_inside_shells(meshes)
    largest_part = max((max(part.size) for part in parts), default=1.0)
    if not meshes:
        raise ValueError("The product model has no drawable parts.")
    points = [v for mesh in meshes for tri in mesh.tris for v in tri]
    low = tuple(min(p[axis] for p in points) for axis in range(3))
    high = tuple(max(p[axis] for p in points) for axis in range(3))
    target: Vec = tuple((low[axis] + high[axis]) / 2 for axis in range(3))  # type: ignore[assignment]
    radius = max(math.dist(low, high) / 2, 1.0)
    view_dir = _norm(direction)
    distance = radius / math.sin(math.radians(CAMERA_FOV_DEG) / 2) * 1.1
    camera = _add(target, _scale(view_dir, distance))
    forward = _scale(view_dir, -1.0)
    right = _norm(_cross(forward, (0.0, 1.0, 0.0)))
    up = _cross(right, forward)

    width = size * supersample

    def project(v: Vec) -> Tuple[float, float, float]:
        rel = _sub(v, camera)
        depth = max(_dot(rel, forward), 1e-6)
        return (_dot(rel, right) / depth, _dot(rel, up) / depth, depth)

    # Lights turn with the camera so every view is lit like the front one.
    key_light = _rotate_y(KEY_LIGHT, light_yaw_deg)
    fill_light = _rotate_y(FILL_LIGHT, light_yaw_deg)
    # Parts mounted on a shell sit a hair in front of it; favour them when depths are this close.
    surface_bias = max(largest_part / 24.0, 0.5) * 0.9

    projected = [project(v) for v in points]
    min_x, max_x = min(p[0] for p in projected), max(p[0] for p in projected)
    min_y, max_y = min(p[1] for p in projected), max(p[1] for p in projected)
    fit = 0.74 * width / max(max_x - min_x, max_y - min_y, 1e-6)
    center_x, center_y = (min_x + max_x) / 2, (min_y + max_y) / 2

    def to_pixel(p: Tuple[float, float, float]) -> Tuple[float, float]:
        return (width / 2 + (p[0] - center_x) * fit, width * 0.52 - (p[1] - center_y) * fit)

    image = Image.new("RGB", (width, width), BACKGROUND)

    # Soft contact shadow under the footprint.
    ground = [project(v) for v in points if v[1] <= low[1] + (high[1] - low[1]) * 0.05]
    if ground:
        gx = [to_pixel(p)[0] for p in ground]
        gy = [to_pixel(p)[1] for p in ground]
        shadow = Image.new("L", (width, width), 0)
        pad = width * 0.02
        ImageDraw.Draw(shadow).ellipse((min(gx) - pad, min(gy) - pad * 0.6, max(gx) + pad, max(gy) + pad * 1.6), fill=110)
        shadow = shadow.filter(ImageFilter.GaussianBlur(width * 0.018))
        image.paste((150, 156, 166), mask=shadow)

    def faces(selected: Iterable[_Mesh]) -> List[Tuple[float, List[Tuple[float, float]], Tuple[int, int, int], _Mesh]]:
        drawn = []
        for mesh in selected:
            base = _rgb(mesh.part.color)
            for a, b, c in mesh.tris:
                normal = _norm(_cross(_sub(b, a), _sub(c, a)))
                centroid = _scale(_add(_add(a, b), c), 1 / 3)
                to_camera = _norm(_sub(camera, centroid))
                if _dot(normal, to_camera) <= 0:
                    continue
                tri_projected = [project(v) for v in (a, b, c)]
                depth = sum(p[2] for p in tri_projected) / 3
                if not mesh.part.is_casing:
                    depth -= surface_bias
                shaded = _shade(base, normal, mesh.part.finish, to_camera, key_light, fill_light)
                drawn.append((depth, [to_pixel(p) for p in tri_projected], shaded, mesh))
        drawn.sort(key=lambda item: -item[0])
        return drawn

    draw = ImageDraw.Draw(image)
    solid = [mesh for mesh in meshes if not (xray and mesh.part.is_casing)]
    for _, polygon, color, _mesh in faces(solid):
        draw.polygon(polygon, fill=color, outline=color)

    if xray:
        overlay = Image.new("RGBA", (width, width), (0, 0, 0, 0))
        ghost = ImageDraw.Draw(overlay, "RGBA")
        shells = [mesh for mesh in meshes if mesh.part.is_casing]
        for _, polygon, color, _mesh in faces(shells):
            ghost.polygon(polygon, fill=(*color, 34))
        line_width = max(2, supersample * 2)
        for mesh in shells:
            for p, q in _feature_edges(mesh.tris):
                ghost.line([to_pixel(project(p)), to_pixel(project(q))], fill=(*XRAY_EDGE, 210), width=line_width)
        image = Image.alpha_composite(image.convert("RGBA"), overlay).convert("RGB")

    if supersample > 1:
        image = image.resize((size, size), Image.LANCZOS)
    buffer = io.BytesIO()
    image.save(buffer, format="PNG", optimize=True)
    return buffer.getvalue()


def render_model_views(ir: Any, *, size: int = 1024) -> List[ModelView]:
    """Exterior, rear and X-ray drawings of the design's 3D model ([] when there is no model)."""
    parts = resolve_model_parts(ir)
    if not parts:
        return []
    has_casing = any(part.is_casing for part in parts)
    has_inside = has_casing and any(part.is_internal for part in parts)
    views = [
        ModelView("case", "Product exterior", render_view(parts, size=size)),
        ModelView(
            "rear",
            "Rear view",
            render_view(parts, direction=_rotate_y(ISO_DIRECTION, 135.0), light_yaw_deg=135.0, size=size),
        ),
    ]
    if has_inside:
        views.append(ModelView("inside", "Cut-away inside", render_view(parts, xray=True, size=size)))
    return views
