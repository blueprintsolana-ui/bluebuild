import assert from "node:assert/strict";
import { test } from "node:test";

import { gearPath, placeGears, type GearSpec } from "../lib/gear-math.ts";

const wrap = (value: number, size: number) => ((((value + size / 2) % size) + size) % size) - size / 2;

/**
 * At each contact, the arc offsets from the contact line to the nearest tooth of each gear must add
 * up to half a tooth pitch: a tooth always faces a gap. Checked while the train turns.
 */
function worstMeshError(gears: GearSpec[], module = 6) {
  const placed = placeGears(gears, module);
  const circularPitch = Math.PI * module;
  let worst = 0;
  for (let step = 0; step < 240; step += 1) {
    const turned = step * 0.41;
    for (let index = 1; index < placed.length; index += 1) {
      const a = placed[index - 1];
      const b = placed[index];
      const contact = gears[index].angle ?? 0;
      const rotA = a.phase + a.direction * turned * a.speedRatio;
      const rotB = b.phase + b.direction * turned * b.speedRatio;
      const arcA = (wrap(contact - rotA, 360 / a.teeth) * Math.PI * a.pitchRadius) / 180;
      const arcB = (wrap(contact + 180 - rotB, 360 / b.teeth) * Math.PI * b.pitchRadius) / 180;
      worst = Math.max(worst, Math.abs(wrap(arcA + arcB - circularPitch / 2, circularPitch)));
    }
  }
  return worst;
}

test("neighbouring gears touch at their pitch circles and alternate direction", () => {
  const placed = placeGears([{ teeth: 24 }, { teeth: 12, angle: 20 }, { teeth: 18, angle: -40 }], 6);
  for (let index = 1; index < placed.length; index += 1) {
    const distance = Math.hypot(placed[index].cx - placed[index - 1].cx, placed[index].cy - placed[index - 1].cy);
    assert.ok(Math.abs(distance - (placed[index].pitchRadius + placed[index - 1].pitchRadius)) < 1e-9);
    assert.equal(placed[index].direction, -placed[index - 1].direction);
  }
});

test("speeds follow the tooth ratio", () => {
  const [big, small] = placeGears([{ teeth: 24 }, { teeth: 12 }], 6);
  assert.equal(big.speedRatio, 1);
  assert.equal(small.speedRatio, 2, "a 12-tooth gear turns twice as fast as a 24-tooth one");
});

test("teeth stay interlocked while the train turns, for even and odd tooth counts", () => {
  const trains: GearSpec[][] = [
    [{ teeth: 24 }, { teeth: 12, angle: 20 }, { teeth: 18, angle: -40 }, { teeth: 10, angle: 35 }],
    [{ teeth: 12 }, { teeth: 8 }, { teeth: 12 }],
    [{ teeth: 17 }, { teeth: 11, angle: 73 }, { teeth: 31, angle: 200 }],
  ];
  for (const gears of trains) {
    assert.ok(worstMeshError(gears) < 1e-6, JSON.stringify(gears));
  }
});

test("gear outlines have one tooth per tooth", () => {
  const path = gearPath(16, 40);
  assert.equal((path.match(/ A /g) || []).length, 32, "a tip arc and a root arc per tooth");
  assert.ok(path.startsWith("M ") && path.endsWith(" Z"));
});
