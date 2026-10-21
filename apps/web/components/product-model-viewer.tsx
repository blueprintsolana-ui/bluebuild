"use client";

import { ContactShadows, Edges, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Minus, Plus } from "lucide-react";
import * as THREE from "three";

import { halfExtents, type ProductFinish, type ProductPart, type ResolvedProductModel, type Vec3 } from "../lib/product-model";

/** Scene units across the model's largest dimension. */
const SCENE_SIZE = 4;
const CAMERA_FOV = 36;
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));

const FINISH_LOOK: Record<ProductFinish, { metalness: number; roughness: number; opacity?: number; emissive?: number }> = {
  metal: { metalness: 0.45, roughness: 0.34 },
  matte: { metalness: 0.05, roughness: 0.82 },
  gloss: { metalness: 0.1, roughness: 0.22 },
  glass: { metalness: 0, roughness: 0.05, opacity: 0.38 },
  screen: { metalness: 0.2, roughness: 0.18, emissive: 0.18 },
  pcb: { metalness: 0.15, roughness: 0.6 },
  rubber: { metalness: 0, roughness: 0.95 },
};

const HIGHLIGHT = "#ffb547";

/** Camera directions for the Mechanical tab's view buttons (design: ISO / FRONT / TOP). */
const VIEWS = {
  iso: new THREE.Vector3(1, 0.42, 1.15).normalize(),
  front: new THREE.Vector3(0, 0.04, 1).normalize(),
  top: new THREE.Vector3(0.02, 1, 0.05).normalize(),
} as const;
type ViewKey = keyof typeof VIEWS;

type OrbitControlsHandle = { object: THREE.Camera; target: THREE.Vector3; update: () => void };

type ViewerProps = {
  model: ResolvedProductModel;
  className?: string;
  /** "card" sits in the Overview grid; "full" fills the Mechanical tab with explode, views and labels. */
  variant?: "card" | "full";
  /** Full variant: the project title shown over the model. */
  title?: string;
  /** Full variant: extra control in the top-right corner (e.g. the engineering layout switch). */
  headerAction?: ReactNode;
};

/** Converts millimeters with Z up into scene units with Y up. */
function toScene([x, y, z]: Vec3, scale: number): Vec3 {
  return [x * scale, z * scale, -y * scale];
}

function toSceneRotation([x, y, z]: Vec3): Vec3 {
  const radians = Math.PI / 180;
  return [x * radians, z * radians, -y * radians];
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

function PartGeometry({ part, scale }: { part: ProductPart; scale: number }) {
  const [x, y, z] = part.size.map((value) => value * scale);
  switch (part.shape) {
    case "rounded_box":
      return null;
    case "cylinder":
    case "tube":
      return <cylinderGeometry args={[x / 2, x / 2, z, 48]} />;
    case "cone":
      return <coneGeometry args={[x / 2, z, 48]} />;
    case "sphere":
      return <sphereGeometry args={[x / 2, 40, 24]} />;
    case "capsule":
      return <capsuleGeometry args={[x / 2, Math.max(z - x, 0), 12, 32]} />;
    case "torus":
      return <torusGeometry args={[Math.max((x - y) / 2, y / 2), y / 2, 20, 56]} />;
    default:
      return <boxGeometry args={[x, z, y]} />;
  }
}

function PartMaterial({ part, xray, selected }: { part: ProductPart; xray: boolean; selected: boolean }) {
  const look = FINISH_LOOK[part.finish];
  const seeThrough = xray && part.isCasing;
  const opacity = seeThrough ? 0.12 : look.opacity ?? 1;
  return (
    <meshStandardMaterial
      color={part.color}
      metalness={look.metalness}
      roughness={look.roughness}
      transparent={opacity < 1}
      opacity={opacity}
      depthWrite={opacity >= 1}
      side={opacity < 1 ? THREE.DoubleSide : THREE.FrontSide}
      emissive={selected ? HIGHLIGHT : part.color}
      emissiveIntensity={selected ? 0.45 : look.emissive ?? 0}
    />
  );
}

function PartMesh({
  part,
  scale,
  xray,
  selected,
  onSelect,
}: {
  part: ProductPart;
  scale: number;
  xray: boolean;
  selected: boolean;
  onSelect: (part: ProductPart) => void;
}) {
  const position = toScene(part.position, scale);
  const rotation = toSceneRotation(part.rotationDeg);
  if (part.shape === "torus") rotation[0] += Math.PI / 2;
  const seeThrough = xray && part.isCasing;
  const edges = seeThrough ? <Edges threshold={20} color={selected ? HIGHLIGHT : "#9fb3d1"} /> : null;
  const handleClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    onSelect(part);
  };

  if (part.shape === "rounded_box") {
    const [x, y, z] = part.size.map((value) => value * scale);
    return (
      <RoundedBox
        args={[x, z, y]}
        radius={Math.min(x, y, z) * 0.12}
        smoothness={4}
        position={position}
        rotation={rotation}
        onClick={handleClick}
        // Casing must not swallow clicks meant for internals in the X-ray view.
        raycast={seeThrough ? () => null : undefined}
      >
        <PartMaterial part={part} xray={xray} selected={selected} />
        {edges}
      </RoundedBox>
    );
  }
  return (
    <mesh position={position} rotation={rotation} onClick={handleClick} raycast={seeThrough ? () => null : undefined}>
      <PartGeometry part={part} scale={scale} />
      <PartMaterial part={part} xray={xray} selected={selected} />
      {edges}
    </mesh>
  );
}

function PartLabel({
  part,
  scale,
  selected,
  named,
  onSelect,
}: {
  part: ProductPart;
  scale: number;
  selected: boolean;
  named: boolean;
  onSelect: (part: ProductPart) => void;
}) {
  // Spread labels around each part's surface so concentric parts do not stack their badges.
  const angle = part.number * GOLDEN_ANGLE;
  const [halfX, halfY] = halfExtents(part);
  const anchor: Vec3 = [
    part.position[0] + Math.cos(angle) * halfX,
    part.position[1] + Math.sin(angle) * halfY,
    part.position[2],
  ];
  return (
    <Html position={toScene(anchor, scale)} center zIndexRange={[20, 0]}>
      <button type="button" onClick={() => onSelect(part)} title={part.label} className={`bb-pin ${named ? "is-named" : ""} ${selected ? "is-selected" : ""}`}>
        <span className="bb-pin__n">{part.number}</span>
        {named && <span className="bb-pin__name">{part.label}</span>}
      </button>
    </Html>
  );
}

/**
 * One part and its label, moved together: slides out along its offset from the model centre as
 * `explode` rises, and grows in on first show (the draw-in), staggered by part number.
 */
function PartAssembly({
  part,
  index,
  scale,
  offset,
  explode,
  xray,
  selected,
  showLabel,
  named,
  onSelect,
}: {
  part: ProductPart;
  index: number;
  scale: number;
  offset: THREE.Vector3;
  explode: number;
  xray: boolean;
  selected: boolean;
  showLabel: boolean;
  named: boolean;
  onSelect: (part: ProductPart) => void;
}) {
  const group = useRef<THREE.Group>(null);
  const born = useRef<number | null>(null);
  const still = useMemo(prefersReducedMotion, []);
  const target = useMemo(() => new THREE.Vector3(), []);
  useFrame((state, delta) => {
    const g = group.current;
    if (!g) return;
    target.copy(offset).multiplyScalar(explode);
    if (still) g.position.copy(target);
    else g.position.lerp(target, 1 - Math.pow(0.0005, delta));
    if (born.current === null) born.current = state.clock.elapsedTime;
    const t = still ? 1 : Math.min(1, Math.max(0, (state.clock.elapsedTime - born.current - index * 0.09) / 0.55));
    const eased = 1 - Math.pow(1 - t, 3);
    g.scale.setScalar(Math.max(0.001, eased));
  });
  return (
    <group ref={group}>
      <PartMesh part={part} scale={scale} xray={xray} selected={selected} onSelect={onSelect} />
      {showLabel && <PartLabel part={part} scale={scale} selected={selected} named={named} onSelect={onSelect} />}
    </group>
  );
}

/**
 * Eases the camera to the chosen view direction, and pulls it back as the model explodes so the
 * separated parts stay in frame (the design's camera does the same).
 */
function CameraRig({
  view,
  explode,
  controlsRef,
}: {
  view: ViewKey;
  explode: number;
  controlsRef: React.MutableRefObject<OrbitControlsHandle | null>;
}) {
  const pending = useRef<ViewKey | null>(null);
  const first = useRef(true);
  const pullBack = useRef(1 + explode * 0.9);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    pending.current = view;
  }, [view]);
  useFrame(() => {
    const controls = controlsRef.current;
    if (!controls) return;
    const wanted = 1 + explode * 0.9;
    if (Math.abs(wanted - pullBack.current) > 0.001) {
      const next = prefersReducedMotion() ? wanted : pullBack.current + (wanted - pullBack.current) * 0.1;
      const offset = controls.object.position.clone().sub(controls.target).multiplyScalar(next / pullBack.current);
      pullBack.current = next;
      controls.object.position.copy(controls.target).add(offset);
      controls.update();
    }
    if (!pending.current) return;
    const offset = controls.object.position.clone().sub(controls.target);
    const goal = VIEWS[pending.current].clone().multiplyScalar(offset.length());
    offset.lerp(goal, prefersReducedMotion() ? 1 : 0.12);
    controls.object.position.copy(controls.target).add(offset);
    controls.update();
    if (offset.distanceTo(goal) < 0.002) pending.current = null;
  });
  return null;
}

export default function ProductModelViewer({ model, className = "", variant = "card", title, headerAction }: ViewerProps) {
  const full = variant === "full";
  const [xray, setXray] = useState(false);
  const [explode, setExplode] = useState(full ? 0.35 : 0);
  const [view, setView] = useState<ViewKey>("iso");
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const controlsRef = useRef<OrbitControlsHandle | null>(null);

  const scale = SCENE_SIZE / Math.max(...model.extent);
  const centerHeight = (model.extent[2] * scale) / 2;
  const radius = (Math.hypot(...model.extent) * scale) / 2;
  // Distance at which the bounding sphere fits the vertical field of view, with margin.
  // The full viewer starts at 35% explode, so its camera starts pulled back by the same amount.
  const distance = (radius / Math.sin(((CAMERA_FOV / 2) * Math.PI) / 180)) * (full ? 1.25 * (1 + 0.35 * 0.9) : 1.18);
  const cameraPosition: Vec3 = [
    VIEWS.iso.x * distance,
    centerHeight + VIEWS.iso.y * distance,
    VIEWS.iso.z * distance,
  ];
  const hasInternals = model.parts.some((part) => part.isInternal);
  const selectPart = (part: ProductPart) => setSelectedNumber((current) => (current === part.number ? null : part.number));
  const minDistance = radius * 1.1;
  const maxDistance = distance * 4;

  // Explode direction per part: away from the model's centre, plus a vertical spread by height so
  // stacked parts separate the way the design's exploded view does.
  const offsets = useMemo(() => {
    const centre = new THREE.Vector3();
    const scenePositions = model.parts.map((part) => new THREE.Vector3(...toScene(part.position, scale)));
    scenePositions.forEach((position) => centre.add(position));
    centre.divideScalar(Math.max(1, scenePositions.length));
    const byHeight = [...scenePositions].map((position, index) => ({ y: position.y, index })).sort((a, b) => a.y - b.y);
    const rank = new Map(byHeight.map((entry, order) => [entry.index, order]));
    const middle = (scenePositions.length - 1) / 2;
    return scenePositions.map((position, index) => {
      const away = position.clone().sub(centre).multiplyScalar(1.3);
      away.y += ((rank.get(index) ?? middle) - middle) * SCENE_SIZE * 0.16;
      return away;
    });
  }, [model.parts, scale]);

  // Wheel zoom is off on the Overview card so scrolling the page never gets stuck; buttons zoom there.
  const zoom = (factor: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    setAutoRotate(false);
    const offset = controls.object.position.clone().sub(controls.target);
    offset.setLength(Math.min(Math.max(offset.length() * factor, minDistance), maxDistance));
    controls.object.position.copy(controls.target).add(offset);
    controls.update();
  };
  const chooseView = (key: ViewKey) => {
    setView(key);
    setAutoRotate(key === "iso");
  };
  const [w, d, h] = model.extent.map((value) => Math.round(value));

  const canvas = (
    <Canvas camera={{ position: cameraPosition, fov: CAMERA_FOV }} dpr={[1, 2]} onPointerMissed={() => setSelectedNumber(null)}>
      <ambientLight intensity={0.55} />
      <hemisphereLight args={["#dfe9ff", "#20283a", 0.6]} />
      <directionalLight position={[4, 7, 5]} intensity={1.4} />
      <directionalLight position={[-5, 3, -4]} intensity={0.5} />

      {model.parts.map((part, index) => (
        <PartAssembly
          key={part.number}
          part={part}
          index={index}
          scale={scale}
          offset={offsets[index]}
          explode={explode}
          xray={xray}
          selected={part.number === selectedNumber}
          showLabel={xray || !part.isInternal}
          named={full}
          onSelect={selectPart}
        />
      ))}

      <ContactShadows position={[0, 0, 0]} opacity={0.45} scale={SCENE_SIZE * 2.2} blur={2.4} far={SCENE_SIZE} />
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        target={[0, centerHeight, 0]}
        enableDamping
        enablePan={false}
        enableZoom={full}
        minDistance={minDistance}
        maxDistance={maxDistance}
        maxPolarAngle={Math.PI * 0.85}
        autoRotate={autoRotate}
        autoRotateSpeed={0.9}
        onStart={() => setAutoRotate(false)}
      />
      <CameraRig view={view} explode={explode} controlsRef={controlsRef} />
    </Canvas>
  );

  if (full) {
    return (
      <div className={`bb-model-full ${className}`}>
        <div className="bb-model-full__stage">
          {canvas}
          <div className="bb-model-full__head">
            <span className="bb-eyebrow is-amber">
              3D model · {model.parts.length} parts · {w} × {d} × {h} mm
            </span>
            {title && <span className="bb-model-full__title">{title}</span>}
          </div>
          <div className="bb-model-full__corner">
            <span className="bb-eyebrow">Drag to rotate · scroll to zoom</span>
            {headerAction}
          </div>
          {model.source === "mechanical" && <span className="bb-model-full__note">Simplified layout from the enclosure plan.</span>}
        </div>
        <div className="bb-model-full__bar">
          <label className="bb-model-full__explode">
            Explode
            <input type="range" min={0} max={100} value={Math.round(explode * 100)} onChange={(event) => setExplode(Number(event.target.value) / 100)} />
            <span>{Math.round(explode * 100)}%</span>
          </label>
          {hasInternals && (
            <button type="button" className={`bb-model-full__xray ${xray ? "is-on" : ""}`} aria-pressed={xray} onClick={() => setXray((value) => !value)}>
              X-ray {xray ? "on" : "off"}
            </button>
          )}
          <div className="bb-model-full__views" role="group" aria-label="Camera view">
            {(Object.keys(VIEWS) as ViewKey[]).map((key) => (
              <button key={key} type="button" aria-pressed={view === key} className={view === key ? "is-active" : ""} onClick={() => chooseView(key)}>
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex min-w-0 flex-col gap-2.5 ${className}`}>
      <div className="bb-model-card">
        {canvas}
        <span className="bb-model-card__chip">3D model</span>
        {hasInternals && (
          <div role="group" aria-label="Model view" className="bb-seg bb-model-card__seg">
            {[
              { value: false, label: "Outside" },
              { value: true, label: "Internal" },
            ].map((option) => (
              <button key={option.label} type="button" aria-pressed={xray === option.value} className={xray === option.value ? "is-active" : ""} onClick={() => setXray(option.value)}>
                {option.label}
              </button>
            ))}
          </div>
        )}
        <span className="bb-eyebrow bb-model-card__hint">Drag to rotate</span>
        <div className="bb-model-card__zoom">
          <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom in">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom out">
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ol className="bb-legend" aria-label="Model parts">
        {model.parts.map((part) => {
          const selected = part.number === selectedNumber;
          const hidden = part.isInternal && !xray;
          return (
            <li key={part.number}>
              <button
                type="button"
                onClick={() => {
                  if (hidden) setXray(true);
                  selectPart(part);
                }}
                title={hidden ? "Inside the product: opens the internal view" : part.refDes || part.label}
                className={`bb-legend__item ${selected ? "is-selected" : ""}`}
              >
                <span className="bb-legend__n">{part.number}</span>
                <span className="bb-legend__swatch" style={{ background: part.color }} aria-hidden="true" />
                <span className={`truncate ${hidden ? "opacity-60" : ""}`}>{part.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {model.source === "mechanical" && <p className="bb-note">Simplified layout from the enclosure plan.</p>}
    </div>
  );
}
