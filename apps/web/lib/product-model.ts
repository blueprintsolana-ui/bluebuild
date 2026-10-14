/**
 * Normalizes the simple-solid product model used by the 3D overview viewer.
 *
 * New designs carry `assembly_metadata.product_model` (primitive shapes written by
 * the Product Visualization Agent). Older designs, or designs where that step was
 * skipped, fall back to the mechanical render envelope and component placements.
 * All sizes and positions are millimeters with Z up and the origin at the center
 * of the product footprint on the ground.
 */

export type ProductShape = "box" | "rounded_box" | "cylinder" | "tube" | "cone" | "sphere" | "capsule" | "torus";
export type ProductFinish = "metal" | "matte" | "gloss" | "glass" | "screen" | "pcb" | "rubber";

export type Vec3 = [number, number, number];

export type ProductPart = {
  number: number;
  label: string;
  shape: ProductShape;
  size: Vec3;
  position: Vec3;
  rotationDeg: Vec3;
  color: string;
  finish: ProductFinish;
  isCasing: boolean;
  /** Fully enclosed by a casing part, so only shown in the X-ray view. */
  isInternal: boolean;
  refDes: string | null;
};

export type ResolvedProductModel = {
  parts: ProductPart[];
  /** Overall envelope in millimeters. */
  extent: Vec3;
  source: "product_model" | "mechanical";
};

const SHAPES = new Set<ProductShape>(["box", "rounded_box", "cylinder", "tube", "cone", "sphere", "capsule", "torus"]);
const FINISHES = new Set<ProductFinish>(["metal", "matte", "gloss", "glass", "screen", "pcb", "rubber"]);
const MAX_PARTS = 40;
const INTERNAL_INSET_MM = 2;

const CATEGORY_LOOK: Record<string, { color: string; finish: ProductFinish }> = {
  microcontroller: { color: "#1f6f43", finish: "pcb" },
  mcu: { color: "#1f6f43", finish: "pcb" },
  display: { color: "#11161f", finish: "screen" },
  sensor: { color: "#2f5f9e", finish: "pcb" },
  power: { color: "#c9a227", finish: "matte" },
  battery: { color: "#c9a227", finish: "matte" },
  actuator: { color: "#b5652b", finish: "metal" },
  communication: { color: "#5b4a9e", finish: "pcb" },
  passives: { color: "#6b7280", finish: "matte" },
  connector: { color: "#30343b", finish: "matte" },
};

function finiteNumber(value: unknown, fallback: number): number {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function vector(value: unknown, fallback: Vec3, keys: [string, string, string] = ["x_mm", "y_mm", "z_mm"]): Vec3 {
  if (Array.isArray(value)) {
    return [finiteNumber(value[0], fallback[0]), finiteNumber(value[1], fallback[1]), finiteNumber(value[2], fallback[2])];
  }
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return [
      finiteNumber(record[keys[0]] ?? record.x, fallback[0]),
      finiteNumber(record[keys[1]] ?? record.y, fallback[1]),
      finiteNumber(record[keys[2]] ?? record.z, fallback[2]),
    ];
  }
  return fallback;
}

function positiveSize(size: Vec3, fallback = 10): Vec3 {
  return size.map((value) => (value > 0 ? Math.min(value, 5000) : fallback)) as Vec3;
}

function hexColor(value: unknown, fallback: string): string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value.trim()) ? value.trim() : fallback;
}

/** Axis-aligned half extents in X, Y, Z (millimeters), ignoring rotation. */
export function halfExtents(part: Pick<ProductPart, "shape" | "size">): Vec3 {
  const [x, y, z] = part.size;
  switch (part.shape) {
    case "cylinder":
    case "tube":
    case "cone":
    case "capsule":
      return [x / 2, x / 2, z / 2];
    case "sphere":
      return [x / 2, x / 2, x / 2];
    case "torus":
      return [x / 2, x / 2, y / 2];
    default:
      return [x / 2, y / 2, z / 2];
  }
}

function insideCasing(part: ProductPart, casing: ProductPart[]): boolean {
  const half = halfExtents(part);
  return casing.some((shell) => {
    const shellHalf = halfExtents(shell);
    return [0, 1, 2].every((axis) => {
      const low = part.position[axis] - half[axis];
      const high = part.position[axis] + half[axis];
      return (
        low >= shell.position[axis] - shellHalf[axis] + INTERNAL_INSET_MM &&
        high <= shell.position[axis] + shellHalf[axis] - INTERNAL_INSET_MM
      );
    });
  });
}

function finalize(parts: Omit<ProductPart, "number" | "isInternal">[], source: ResolvedProductModel["source"]): ResolvedProductModel | null {
  if (!parts.length) return null;
  const numbered: ProductPart[] = parts.slice(0, MAX_PARTS).map((part, index) => ({ ...part, number: index + 1, isInternal: false }));
  const casing = numbered.filter((part) => part.isCasing);
  for (const part of numbered) {
    part.isInternal = !part.isCasing && insideCasing(part, casing);
  }
  const low: Vec3 = [Infinity, Infinity, Infinity];
  const high: Vec3 = [-Infinity, -Infinity, -Infinity];
  for (const part of numbered) {
    const half = halfExtents(part);
    for (const axis of [0, 1, 2]) {
      low[axis] = Math.min(low[axis], part.position[axis] - half[axis]);
      high[axis] = Math.max(high[axis], part.position[axis] + half[axis]);
    }
  }
  const extent = [0, 1, 2].map((axis) => Math.max(high[axis] - low[axis], 1)) as Vec3;
  return { parts: numbered, extent, source };
}

function fromProductModel(model: unknown): ResolvedProductModel | null {
  const rawParts = model && typeof model === "object" ? (model as Record<string, unknown>).parts : null;
  if (!Array.isArray(rawParts)) return null;
  const parts = rawParts.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const record = raw as Record<string, unknown>;
    const shape = String(record.shape || "") as ProductShape;
    if (!SHAPES.has(shape)) return [];
    const finish = String(record.finish || "matte") as ProductFinish;
    return [{
      label: String(record.label || "Part").slice(0, 60),
      shape,
      size: positiveSize(vector(record.size_mm, [10, 10, 10])),
      position: vector(record.position_mm, [0, 0, 0]),
      rotationDeg: vector(record.rotation_deg, [0, 0, 0], ["x_deg", "y_deg", "z_deg"]),
      color: hexColor(record.color_hex, "#9aa4b2"),
      finish: FINISHES.has(finish) ? finish : "matte",
      isCasing: record.is_casing === true,
      refDes: typeof record.ref_des === "string" && record.ref_des ? record.ref_des : null,
    }];
  });
  return finalize(parts, "product_model");
}

function isRoundForm(text: string) {
  return /cylind|bottle|tube|round|can\b|cup|jar|flask|tumbler|puck|disc|disk/.test(text.toLowerCase());
}

function isEnclosurePlacement(placement: Record<string, unknown>) {
  const text = `${placement.layer || ""} ${placement.category || ""} ${placement.label || ""}`.toLowerCase();
  return /\benclosure\b|\bhousing\b|\bcase\b|\bchassis\b|\bshell\b/.test(text);
}

function fromMechanical(mechanical: unknown, components: unknown[]): ResolvedProductModel | null {
  const notes = mechanical && typeof mechanical === "object" ? (mechanical as Record<string, unknown>) : {};
  const placements = Array.isArray(notes.component_placements) ? (notes.component_placements as Record<string, unknown>[]) : [];
  const dimensions = notes.render_dimensions ? positiveSize(vector(notes.render_dimensions, [0, 0, 0]), 0) : null;
  if (!placements.length && !dimensions) return null;

  const componentsByRef = new Map<string, Record<string, unknown>>();
  for (const component of components) {
    if (component && typeof component === "object") {
      const record = component as Record<string, unknown>;
      if (typeof record.ref_des === "string") componentsByRef.set(record.ref_des, record);
    }
  }

  const envelope: Vec3 = dimensions && dimensions.every((value) => value > 0) ? dimensions : [100, 60, 40];
  const round = isRoundForm(`${notes.physical_form || ""} ${notes.enclosure_type || ""}`);
  const parts: Omit<ProductPart, "number" | "isInternal">[] = [{
    label: round ? "Body" : "Enclosure",
    shape: round ? "cylinder" : "rounded_box",
    size: round ? [Math.max(envelope[0], envelope[1]), Math.max(envelope[0], envelope[1]), envelope[2]] : envelope,
    position: [0, 0, envelope[2] / 2],
    rotationDeg: [0, 0, 0],
    color: "#aeb6c2",
    finish: "metal",
    isCasing: true,
    refDes: null,
  }];

  for (const placement of placements) {
    if (isEnclosurePlacement(placement)) continue;
    const refDes = typeof placement.ref_des === "string" ? placement.ref_des : null;
    const component = refDes ? componentsByRef.get(refDes) : undefined;
    const category = String(placement.category || component?.category || "").toLowerCase();
    const look = CATEGORY_LOOK[category] || { color: "#6b7280", finish: "matte" as ProductFinish };
    const center = vector(placement.position, [0, 0, 0]);
    parts.push({
      label: String(placement.label || component?.name || refDes || "Part").slice(0, 60),
      shape: "box",
      size: positiveSize(vector(placement.size, [12, 12, 4])),
      // Mechanical placements are relative to the enclosure center.
      position: [center[0], center[1], center[2] + envelope[2] / 2],
      rotationDeg: vector(placement.orientation_deg, [0, 0, 0], ["x_deg", "y_deg", "z_deg"]),
      color: look.color,
      finish: look.finish,
      isCasing: false,
      refDes,
    });
  }
  return finalize(parts, "mechanical");
}

export function resolveProductModel(
  productModel: unknown,
  mechanical: unknown,
  components: unknown[] = [],
): ResolvedProductModel | null {
  return fromProductModel(productModel) || fromMechanical(mechanical, components);
}
