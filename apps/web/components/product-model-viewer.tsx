"use client";

import { ContactShadows, Edges, Html, OrbitControls, RoundedBox } from "@react-three/drei";
import { Canvas } from "@react-three/fiber";
import { useMemo, useRef, useState } from "react";
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

type OrbitControlsHandle = { object: THREE.Camera; target: THREE.Vector3; update: () => void };

type ViewerProps = {
  model: ResolvedProductModel;
  className?: string;
};

/** Converts millimeters with Z up into scene units with Y up. */
function toScene([x, y, z]: Vec3, scale: number): Vec3 {
  return [x * scale, z * scale, -y * scale];
}

function toSceneRotation([x, y, z]: Vec3): Vec3 {
  const radians = Math.PI / 180;
  return [x * radians, z * radians, -y * radians];
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
  onSelect,
}: {
  part: ProductPart;
  scale: number;
  selected: boolean;
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
      <button
        type="button"
        onClick={() => onSelect(part)}
        title={part.label}
        className={`flex h-6 min-w-6 items-center justify-center rounded-full border px-1.5 text-[11px] font-semibold shadow-md transition ${
          selected
            ? "border-[#ffb547] bg-[#ffb547] text-[#1a1300]"
            : "border-white/70 bg-[rgb(14_42_87/0.88)] text-white hover:border-[#ffb547]"
        }`}
      >
        {part.number}
      </button>
    </Html>
  );
}

export default function ProductModelViewer({ model, className = "" }: ViewerProps) {
  const [xray, setXray] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState<number | null>(null);
  const [autoRotate, setAutoRotate] = useState(true);
  const controlsRef = useRef<OrbitControlsHandle | null>(null);

  const scale = SCENE_SIZE / Math.max(...model.extent);
  const centerHeight = (model.extent[2] * scale) / 2;
  const radius = (Math.hypot(...model.extent) * scale) / 2;
  // Distance at which the bounding sphere fits the vertical field of view, with margin.
  const distance = (radius / Math.sin(((CAMERA_FOV / 2) * Math.PI) / 180)) * 1.18;
  const viewDirection = new THREE.Vector3(1, 0.42, 1.15).normalize();
  const cameraPosition: Vec3 = [
    viewDirection.x * distance,
    centerHeight + viewDirection.y * distance,
    viewDirection.z * distance,
  ];
  const hasInternals = model.parts.some((part) => part.isInternal);
  const visibleLabels = useMemo(
    () => model.parts.filter((part) => xray || !part.isInternal),
    [model.parts, xray],
  );
  const selectPart = (part: ProductPart) => setSelectedNumber((current) => (current === part.number ? null : part.number));
  const minDistance = radius * 1.1;
  const maxDistance = distance * 3;
  // Wheel zoom is off so scrolling the page never gets stuck on the model; these buttons zoom instead.
  const zoom = (factor: number) => {
    const controls = controlsRef.current;
    if (!controls) return;
    setAutoRotate(false);
    const offset = controls.object.position.clone().sub(controls.target);
    offset.setLength(Math.min(Math.max(offset.length() * factor, minDistance), maxDistance));
    controls.object.position.copy(controls.target).add(offset);
    controls.update();
  };

  return (
    <div className={`flex min-w-0 flex-col ${className}`}>
      <div className="relative h-[280px] overflow-hidden rounded-xl border border-[var(--forma-border)] bg-[radial-gradient(circle_at_50%_35%,rgb(var(--forma-cyan-rgb)/0.10),transparent_70%),var(--forma-surface-muted)] sm:h-[380px]">
        <Canvas
          camera={{ position: cameraPosition, fov: CAMERA_FOV }}
          dpr={[1, 2]}
          onPointerMissed={() => setSelectedNumber(null)}
        >
          <ambientLight intensity={0.55} />
          <hemisphereLight args={["#dfe9ff", "#20283a", 0.6]} />
          <directionalLight position={[4, 7, 5]} intensity={1.4} />
          <directionalLight position={[-5, 3, -4]} intensity={0.5} />

          {model.parts.map((part) => (
            <PartMesh
              key={part.number}
              part={part}
              scale={scale}
              xray={xray}
              selected={part.number === selectedNumber}
              onSelect={selectPart}
            />
          ))}
          {visibleLabels.map((part) => (
            <PartLabel
              key={part.number}
              part={part}
              scale={scale}
              selected={part.number === selectedNumber}
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
            enableZoom={false}
            minDistance={minDistance}
            maxDistance={maxDistance}
            maxPolarAngle={Math.PI * 0.85}
            autoRotate={autoRotate}
            autoRotateSpeed={0.9}
            onStart={() => setAutoRotate(false)}
          />
        </Canvas>

        <div className="pointer-events-none absolute inset-x-3 top-3 z-30 flex items-start justify-between gap-2">
          <span className="rounded-md border border-[var(--forma-border)] bg-[rgb(var(--forma-chrome-rgb)/0.92)] px-2.5 py-1.5 text-[11px] font-medium text-[var(--forma-text-strong)] shadow-sm backdrop-blur-sm">
            3D model
          </span>
          {hasInternals && (
            <div
              role="group"
              aria-label="Model view"
              className="pointer-events-auto flex rounded-md border border-[var(--forma-border)] bg-[rgb(var(--forma-chrome-rgb)/0.92)] p-0.5 text-[11px] font-medium shadow-sm backdrop-blur-sm"
            >
              {[
                { value: false, label: "Outside" },
                { value: true, label: "Internal" },
              ].map((option) => (
                <button
                  key={option.label}
                  type="button"
                  aria-pressed={xray === option.value}
                  onClick={() => setXray(option.value)}
                  className={`rounded px-2.5 py-1 transition ${
                    xray === option.value
                      ? "bg-[var(--forma-text-strong)] text-[var(--forma-page)]"
                      : "text-[var(--forma-text-muted)] hover:text-[var(--forma-text-strong)]"
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pointer-events-none absolute bottom-3 left-3 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--forma-text-muted)]">
          Drag to rotate
        </div>
        <div className="absolute bottom-3 right-3 z-30 flex overflow-hidden rounded-md border border-[var(--forma-border)] bg-[rgb(var(--forma-chrome-rgb)/0.92)] shadow-sm backdrop-blur-sm">
          <button type="button" onClick={() => zoom(0.8)} aria-label="Zoom in" className="flex h-8 w-8 items-center justify-center text-[var(--forma-text-strong)] hover:bg-white/10">
            <Plus className="h-4 w-4" />
          </button>
          <button type="button" onClick={() => zoom(1.25)} aria-label="Zoom out" className="flex h-8 w-8 items-center justify-center border-l border-[var(--forma-border)] text-[var(--forma-text-strong)] hover:bg-white/10">
            <Minus className="h-4 w-4" />
          </button>
        </div>
      </div>

      <ol className="mt-3 flex flex-wrap gap-1.5" aria-label="Model parts">
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
                className={`inline-flex max-w-[220px] items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] transition ${
                  selected
                    ? "border-[#ffb547] bg-[rgb(255_181_71/0.12)] text-[var(--forma-text-strong)]"
                    : "border-[var(--forma-border)] bg-[var(--forma-surface)] text-[var(--forma-text-secondary)] hover:border-[var(--forma-text-muted)]"
                }`}
              >
                <span
                  className={`flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    selected ? "bg-[#ffb547] text-[#1a1300]" : "bg-[rgb(var(--forma-cyan-rgb)/0.18)] text-[var(--forma-text-strong)]"
                  }`}
                >
                  {part.number}
                </span>
                <span className="h-2.5 w-2.5 shrink-0 rounded-sm border border-white/20" style={{ background: part.color }} aria-hidden="true" />
                <span className={`truncate ${hidden ? "opacity-60" : ""}`}>{part.label}</span>
              </button>
            </li>
          );
        })}
      </ol>
      {model.source === "mechanical" && (
        <p className="mt-2 text-[11px] text-[var(--forma-text-muted)]">Simplified layout from the enclosure plan.</p>
      )}
    </div>
  );
}
