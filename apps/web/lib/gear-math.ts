/**
 * Gear geometry for the craft kit, kept free of React so it can be unit tested.
 *
 * Every gear in a train shares one tooth size (the "module"), so a gear's pitch radius is
 * proportional to its tooth count. Neighbours sit exactly one pitch radius apart, start with a
 * tooth of one gear in a gap of the next, turn in opposite directions, and spin at speeds in the
 * inverse ratio of their teeth: a 12-tooth gear turns twice as fast as a 24-tooth one.
 */

export type GearMode = "spin" | "scroll" | "step" | "wobble" | "still";

export type GearSpec = {
  teeth: number;
  /** Direction from the previous gear's centre to this one, in degrees (0 = right, 90 = down). */
  angle?: number;
  /** Stroke colour; defaults to the train colour. */
  color?: string;
  /** Optional fill behind the strokes. */
  fill?: string;
};

export type PlacedGear = GearSpec & {
  cx: number;
  cy: number;
  pitchRadius: number;
  outerRadius: number;
  phase: number;
  direction: 1 | -1;
  /** Turning speed relative to the first gear. */
  speedRatio: number;
};

export const round = (value: number) => Math.round(value * 100) / 100;
const mod = (value: number, size: number) => ((value % size) + size) % size;

/** Outline of a gear centred on (0, 0) with tooth 0 pointing along +x. */
export function gearPath(teeth: number, pitchRadius: number): string {
  const toothModule = (2 * pitchRadius) / teeth;
  const outer = pitchRadius + toothModule;
  const root = pitchRadius - 1.25 * toothModule;
  const pitch = (Math.PI * 2) / teeth;
  const at = (radius: number, angle: number) => `${round(radius * Math.cos(angle))} ${round(radius * Math.sin(angle))}`;
  let path = `M ${at(root, -pitch / 2)}`;
  for (let tooth = 0; tooth < teeth; tooth += 1) {
    const centre = tooth * pitch;
    path += ` L ${at(root, centre - pitch * 0.29)}`;
    path += ` L ${at(outer, centre - pitch * 0.16)}`;
    path += ` A ${round(outer)} ${round(outer)} 0 0 1 ${at(outer, centre + pitch * 0.16)}`;
    path += ` L ${at(root, centre + pitch * 0.29)}`;
    path += ` A ${round(root)} ${round(root)} 0 0 1 ${at(root, centre + pitch / 2)}`;
  }
  return `${path} Z`;
}

/** Lay out a train so each gear meshes with the one before it. */
export function placeGears(gears: GearSpec[], toothModule: number, direction: 1 | -1 = 1): PlacedGear[] {
  const placed: PlacedGear[] = [];
  gears.forEach((gear, index) => {
    const pitchRadius = (toothModule * gear.teeth) / 2;
    const outerRadius = pitchRadius + toothModule;
    if (index === 0) {
      placed.push({ ...gear, cx: 0, cy: 0, pitchRadius, outerRadius, phase: 0, direction, speedRatio: 1 });
      return;
    }
    const previous = placed[index - 1];
    const angle = gear.angle ?? 0;
    const radians = (angle * Math.PI) / 180;
    const distance = previous.pitchRadius + pitchRadius;
    const previousPitch = 360 / previous.teeth;
    const pitch = 360 / gear.teeth;
    // How far the contact direction sits past the previous gear's nearest tooth centre.
    const offset = mod(angle - previous.phase, previousPitch);
    // Put a gap of this gear on the contact line, then counter-rotate for the offset.
    const phase = angle + 180 - pitch / 2 + offset * (previous.teeth / gear.teeth);
    placed.push({
      ...gear,
      cx: previous.cx + distance * Math.cos(radians),
      cy: previous.cy + distance * Math.sin(radians),
      pitchRadius,
      outerRadius,
      phase,
      direction: (previous.direction * -1) as 1 | -1,
      speedRatio: previous.speedRatio * (previous.teeth / gear.teeth),
    });
  });
  return placed;
}
