import type * as Three from "three";

type ThreeModule = typeof Three;

/** One separable part of the example bottle, with where its callout line points. */
export type BottlePart = { group: Three.Group; restY: number; explodeBy: number; anchor: Three.Vector3 };

export type BottleModel = {
  root: Three.Group;
  gears: Three.Group;
  parts: BottlePart[];
  /** 0 → 1: edges draw themselves in, one piece after another. */
  setDraw: (t: number) => void;
  /** 0 → 1: the solid fill fades so the inside shows. */
  setXray: (x: number) => void;
  /** 0 → 1: pulls the parts apart vertically. */
  setExplode: (e: number) => void;
  setGearOpacity: (a: number) => void;
  updateGears: (theta: number) => void;
  dispose: () => void;
};

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

/** Extruded spur gear outline (same tooth shape as the app's gear train). */
function gearGeometry(T: ThreeModule, teeth: number, toothModule: number, depth: number) {
  const r = (toothModule * teeth) / 2;
  const tip = r + toothModule;
  const root = r - 1.25 * toothModule;
  const step = (Math.PI * 2) / teeth;
  const shape = new T.Shape();
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    const points: [number, number][] = [
      [root, a - step * 0.27],
      [tip, a - step * 0.12],
      [tip, a + step * 0.12],
      [root, a + step * 0.27],
    ];
    points.forEach(([radius, angle], j) => {
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (i === 0 && j === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();
  const hub = new T.Path();
  hub.absarc(0, 0, r * 0.16, 0, Math.PI * 2, true);
  shape.holes.push(hub);
  if (teeth >= 18) {
    for (let k = 0; k < 5; k += 1) {
      const b = (k * Math.PI * 2) / 5;
      const hole = new T.Path();
      hole.absarc(Math.cos(b) * r * 0.55, Math.sin(b) * r * 0.55, r * 0.18, 0, Math.PI * 2, true);
      shape.holes.push(hole);
    }
  }
  const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 18 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

/**
 * The landing page's example product, a 1 L bottle with a temperature display, drawn as blueprint
 * lines over a navy fill, plus a meshing gear train behind it. Units are millimetres.
 */
export function buildBottleModel(T: ThreeModule): BottleModel {
  const ink = new T.Color("#f4f7fb");
  const fill = new T.Color("#14366e");
  const lineMat = new T.LineBasicMaterial({ color: ink, transparent: true });
  const accentMat = new T.LineBasicMaterial({ color: new T.Color("#ffb547"), transparent: true });
  const gearMat = new T.LineBasicMaterial({ color: ink, transparent: true, opacity: 0.55 });
  const brassMat = new T.LineBasicMaterial({ color: new T.Color("#c9a15a"), transparent: true, opacity: 0.9 });
  const fillMat = new T.MeshLambertMaterial({
    color: fill,
    transparent: true,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1,
  });
  const gearFill = fillMat.clone();
  gearFill.opacity = 0.85;

  const lines: Three.LineSegments[] = [];
  const geometries: Three.BufferGeometry[] = [];
  const root = new T.Group();
  const gears = new T.Group();
  const parts: BottlePart[] = [];

  function piece(parent: Three.Object3D, geometry: Three.BufferGeometry, mat: Three.LineBasicMaterial = lineMat, threshold = 12, x = 0, y = 0, z = 0) {
    const group = new T.Group();
    group.add(new T.Mesh(geometry, mat === gearMat || mat === brassMat ? gearFill : fillMat));
    const edges = new T.EdgesGeometry(geometry, threshold);
    const edgeLines = new T.LineSegments(edges, mat);
    edgeLines.userData.count = edges.attributes.position.count;
    group.add(edgeLines);
    lines.push(edgeLines);
    geometries.push(geometry, edges);
    group.position.set(x, y, z);
    parent.add(group);
    return group;
  }

  function part(restY: number, explodeBy: number, draw: (group: Three.Group) => void) {
    const group = new T.Group();
    group.position.y = restY;
    root.add(group);
    draw(group);
    parts.push({ group, restY, explodeBy, anchor: new T.Vector3() });
  }

  // 1 OLED
  part(274, 360, (g) => {
    piece(g, new T.BoxGeometry(30, 3, 18));
    piece(g, new T.BoxGeometry(24, 0.6, 12), accentMat, 12, 0, 1.8, 0);
  });
  // 2 Lid
  part(264, 300, (g) => {
    piece(g, new T.CylinderGeometry(35, 35, 18, 24), lineMat, 10);
    piece(g, new T.CylinderGeometry(27, 27, 2, 24), lineMat, 10, 0, 10, 0);
  });
  // 3 Controller board
  part(249, 245, (g) => {
    piece(g, new T.BoxGeometry(40, 1.6, 30));
    piece(g, new T.BoxGeometry(13, 2.2, 13), lineMat, 12, 4, 1.9, 0);
    piece(g, new T.BoxGeometry(9, 3.2, 7), accentMat, 12, -17, 2.4, 0);
    piece(g, new T.BoxGeometry(5, 1.5, 3), lineMat, 12, 13, 1.5, -10);
    piece(g, new T.BoxGeometry(5, 1.5, 3), lineMat, 12, 13, 1.5, 10);
  });
  // 4 Battery
  part(236, 200, (g) => {
    piece(g, new T.BoxGeometry(34, 7, 22));
    piece(g, new T.BoxGeometry(6, 1, 5), accentMat, 12, 19, 0, 0);
  });
  // 5 Temperature probe
  part(170, 160, (g) => {
    piece(g, new T.CylinderGeometry(3, 3, 120, 12), lineMat, 20);
    piece(g, new T.ConeGeometry(3, 10, 12), accentMat, 20, 0, -65, 0).rotation.x = Math.PI;
  });
  // 6 Bottle body
  part(0, 0, (g) => {
    const profile = [[0, 0], [34, 0], [38, 5], [38, 215], [36, 232], [31, 244], [31, 255]].map(([x, y]) => new T.Vector2(x, y));
    piece(g, new T.LatheGeometry(profile, 24), lineMat, 10);
  });
  parts[5].anchor.set(0, 130, 0);

  const centreGeometry = new T.BufferGeometry().setFromPoints([new T.Vector3(0, -40, 0), new T.Vector3(0, 700, 0)]);
  const centreMat = new T.LineDashedMaterial({ color: new T.Color("#ffb547"), dashSize: 12, gapSize: 7, transparent: true, opacity: 0 });
  const centre = new T.Line(centreGeometry, centreMat);
  centre.computeLineDistances();
  root.add(centre);
  geometries.push(centreGeometry);

  const gearTrain: { group: Three.Group; ratio: number; phase: number }[] = [];
  ([
    [28, 0, 0],
    [14, Math.PI / 6, 84],
    [20, Math.PI * 1.1, 96],
  ] as const).forEach(([teeth, angle, distance], i) => {
    const holder = new T.Group();
    holder.position.set(Math.cos(angle) * distance, Math.sin(angle) * distance, i * 4);
    const group = piece(holder, gearGeometry(T, teeth, 4, i === 0 ? 10 : 8), i === 2 ? brassMat : gearMat, 20);
    gears.add(holder);
    gearTrain.push({ group, ratio: i === 0 ? 1 : -28 / teeth, phase: i === 0 ? 0 : Math.PI / teeth });
  });

  return {
    root,
    gears,
    parts,
    setDraw(t) {
      const count = lines.length;
      lines.forEach((line, i) => {
        const start = (i / count) * 0.55;
        const local = clamp01((t - start) / 0.45);
        line.geometry.setDrawRange(0, Math.floor((line.userData.count * local) / 2) * 2);
      });
    },
    setXray(x) {
      fillMat.opacity = 1 - x * 0.92;
      fillMat.depthWrite = x < 0.5;
    },
    setExplode(e) {
      parts.forEach((p) => {
        p.group.position.y = p.restY + p.explodeBy * e;
      });
      centreMat.opacity = e * 0.85;
    },
    setGearOpacity(a) {
      brassMat.opacity = 0.9 * a;
      gearMat.opacity = 0.55 * a;
      gearFill.opacity = 0.85 * a;
    },
    updateGears(theta) {
      gearTrain.forEach((g) => {
        g.group.rotation.z = theta * g.ratio + g.phase;
      });
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
      [lineMat, accentMat, gearMat, brassMat, fillMat, gearFill, centreMat].forEach((m) => m.dispose());
    },
  };
}
