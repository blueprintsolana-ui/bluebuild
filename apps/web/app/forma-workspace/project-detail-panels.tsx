"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  AlertTriangle,
  Battery,
  Box,
  CheckCircle,
  Cpu,
  Database,
  ExternalLink,
  Film,
  GitBranch,
  Maximize2,
  Monitor,
  Printer,
  ShieldCheck,
  Sliders,
  Volume2,
  Wrench,
} from "lucide-react";

import { Stamp } from "../../components/craft";
import ImageLightbox from "../../components/image-lightbox";
import { isHardwareReferenceCandidate, type ProjectImageCandidate } from "../../lib/project-images";
import { resolveProductModel } from "../../lib/product-model";

const RUNPOD_PARTI_BASE_MODEL = "caid-technologies/parti-base";
const BASETEN_GLM_MODEL = "zai-org/GLM-5.2";

const MechanicalScene = dynamic(() => import("../../components/mechanical-scene"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[420px] items-center justify-center bg-[var(--forma-page)] text-xs font-medium uppercase tracking-[0.14em] text-[var(--forma-text-muted)]">
      Loading mechanical preview...
    </div>
  ),
});

const ProductModelViewer = dynamic(() => import("../../components/product-model-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-[var(--forma-border)] bg-[var(--forma-surface-muted)] text-xs font-medium uppercase tracking-[0.14em] text-[var(--forma-text-muted)] sm:h-[380px]">
      Loading 3D model...
    </div>
  ),
});

const categoryTone: Record<string, { text: string; bg: string; border: string; label: string }> = {
  microcontroller: { text: "text-[rgb(var(--forma-cyan-rgb))]", bg: "bg-[rgb(var(--forma-cyan-rgb)/0.1)]", border: "border-[rgb(var(--forma-cyan-rgb)/0.35)]", label: "MCU" },
  sensor: { text: "text-[rgb(var(--forma-green-rgb))]", bg: "bg-[rgb(var(--forma-green-rgb)/0.1)]", border: "border-[rgb(var(--forma-green-rgb)/0.35)]", label: "SENSOR" },
  actuator: { text: "text-[rgb(var(--forma-yellow-rgb))]", bg: "bg-[rgb(var(--forma-yellow-rgb)/0.1)]", border: "border-[rgb(var(--forma-yellow-rgb)/0.35)]", label: "ACTUATOR" },
  display: { text: "text-[rgb(var(--forma-violet-rgb))]", bg: "bg-[rgb(var(--forma-violet-rgb)/0.1)]", border: "border-[rgb(var(--forma-violet-rgb)/0.35)]", label: "DISPLAY" },
  power: { text: "text-[rgb(var(--forma-yellow-rgb))]", bg: "bg-[rgb(var(--forma-yellow-rgb)/0.1)]", border: "border-[rgb(var(--forma-yellow-rgb)/0.35)]", label: "POWER" },
  passives: { text: "text-[rgb(var(--forma-violet-rgb))]", bg: "bg-[rgb(var(--forma-violet-rgb)/0.1)]", border: "border-[rgb(var(--forma-violet-rgb)/0.35)]", label: "IO" },
  mechanical: { text: "text-[rgb(var(--forma-red-rgb))]", bg: "bg-[rgb(var(--forma-red-rgb)/0.1)]", border: "border-[rgb(var(--forma-red-rgb)/0.35)]", label: "MECH" },
  "3d print": { text: "text-[rgb(var(--forma-cyan-rgb))]", bg: "bg-[rgb(var(--forma-cyan-rgb)/0.1)]", border: "border-[rgb(var(--forma-cyan-rgb)/0.35)]", label: "3D PRINT" },
  default: { text: "text-[var(--forma-text-muted)]", bg: "bg-[var(--forma-surface-muted)]", border: "border-[var(--forma-border)]", label: "PART" },
};

function projectLlmDisplayLabel(provider: string, model: string) {
  if (provider === "runpod-serverless" && model === RUNPOD_PARTI_BASE_MODEL) return RUNPOD_PARTI_BASE_MODEL;
  if (provider === "baseten" && model === BASETEN_GLM_MODEL) return "GLM 5.2";
  return `${provider}/${model}`;
}

export function OverviewPanel({
  title,
  description,
  imageCandidates,
  features,
  metrics,
  metadata,
  systemArchitecture,
  mechanical = null,
  components = [],
  projectId = null,
  showModelName = false,
  showImageSection = true,
  canManageProgressiveReview = false,
  visualDecisionBusy = null,
  visualDecisionError = null,
  onVisualDecision,
}: {
  title: string;
  description: string;
  imageCandidates: ProjectImageCandidate[];
  features: string[];
  metrics: ReturnType<typeof emptyMetrics>;
  metadata: Record<string, any>;
  systemArchitecture?: Record<string, any> | null;
  mechanical?: Record<string, any> | null;
  components?: any[];
  projectId?: string | null;
  showModelName?: boolean;
  showImageSection?: boolean;
  canManageProgressiveReview?: boolean;
  visualDecisionBusy?: "approve" | "revise" | "continue_to_cad" | null;
  visualDecisionError?: string | null;
  onVisualDecision?: (decision: "approve" | "revise" | "continue_to_cad", feedback?: string) => void | Promise<void>;
}) {
  const imageKey = imageCandidates.map((candidate) => candidate.src).join("|");
  const [imageIndex, setImageIndex] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [revisionFeedback, setRevisionFeedback] = useState("");
  const productModel = useMemo(
    () => resolveProductModel(metadata?.product_model, mechanical, components),
    [components, mechanical, metadata?.product_model],
  );

  useEffect(() => {
    setImageIndex(0);
  }, [imageKey]);

  const visualGate = metadata?.design_lifecycle?.visual_gate || {};
  const visualArtifactId = String(visualGate.visual_artifact_id || metadata.system_render_artifact_id || "");
  const visualApprovalStatus = String(visualGate.status || metadata.visual_approval_status || "not_requested");
  const persistedVisualFeedback = String(visualGate.feedback || metadata.visual_approval_feedback || "");
  const progressiveReviewVisible = metadata.generation_mode === "progressive" && Boolean(visualArtifactId);
  const cadStatus = String(metadata?.cad_generation?.status || "");
  const cadComplete = cadStatus === "succeeded" || cadStatus === "provided";

  useEffect(() => {
    setRevisionFeedback(persistedVisualFeedback);
  }, [persistedVisualFeedback, visualArtifactId]);

  const productImages = imageCandidates.filter((candidate) => !isHardwareReferenceCandidate(candidate));
  const referenceImages = imageCandidates.filter(isHardwareReferenceCandidate);
  const heroImages = productImages.length ? productImages : referenceImages;
  const activeImage = heroImages[imageIndex] || null;
  const llmProvider = metadata.runtime_provider || metadata.llm_provider || metadata.requested_provider;
  const llmModel = metadata.runtime_model || metadata.actual_model || metadata.model_name || metadata.requested_model;
  const showProductImage = showImageSection || Boolean(activeImage);
  const showHardwareReference = productImages.length > 0 && referenceImages.length > 0;

  return (
    <div className="bb-sheet h-full min-w-0 overflow-y-auto overflow-x-hidden">
      <div className="bb-sheet__body">
        {(showProductImage || productModel) && (
          <div className="bb-overview-grid">
            {showProductImage && (
              <div className="flex min-w-0 flex-col gap-2.5">
                <div className="bb-render">
                  {activeImage ? (
                    <button
                      type="button"
                      onClick={() => setLightboxIndex(imageIndex)}
                      aria-label={`Open ${activeImage.label} full size`}
                      className="group block h-full w-full cursor-zoom-in"
                    >
                      <Image
                        src={activeImage.src}
                        alt={activeImage.label}
                        width={1}
                        height={1}
                        unoptimized
                        onError={() => setImageIndex((current) => current + 1)}
                        className="h-full w-full object-cover object-center transition duration-300 group-hover:scale-[1.02]"
                      />
                      <span className="bb-render__chip is-bottom">
                        <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
                        View full size
                      </span>
                    </button>
                  ) : (
                    <ImageUnavailableState failed={metadata.image_output_failed === true || metadata.image_output_status === "failed"} />
                  )}
                  {activeImage && <span className="bb-render__chip is-top">{activeImage.label}</span>}
                </div>

                {heroImages.length > 1 && (
                  <div className="bb-thumbs" style={{ gridTemplateColumns: `repeat(${Math.min(heroImages.length, 4)}, minmax(0, 1fr))` }}>
                    {heroImages.slice(0, 4).map((candidate, index) => (
                      <button
                        key={`${candidate.src}-${index}`}
                        type="button"
                        onClick={() => setImageIndex(index)}
                        onDoubleClick={() => setLightboxIndex(index)}
                        className={`bb-thumb ${imageIndex === index ? "is-active" : ""}`}
                      >
                        <Image src={candidate.src} alt={candidate.label} width={1} height={1} unoptimized className="bb-thumb__img" />
                        <span className="bb-thumb__label">{candidate.label}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {productModel && <ProductModelViewer key={`${productModel.parts.length}:${productModel.extent.join(",")}`} model={productModel} />}
          </div>
        )}

        {lightboxIndex !== null && heroImages.length > 0 && (
          <ImageLightbox
            images={heroImages}
            index={Math.min(lightboxIndex, heroImages.length - 1)}
            onIndexChange={(index) => {
              setLightboxIndex(index);
              setImageIndex(index);
            }}
            onClose={() => setLightboxIndex(null)}
          />
        )}

        {progressiveReviewVisible && (
          <section data-testid="progressive-visual-review" className="mt-4 rounded-xl border border-[rgb(var(--forma-cyan-rgb)/0.32)] bg-[rgb(var(--forma-cyan-rgb)/0.06)] p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[rgb(var(--forma-cyan-rgb))]">Progressive concept review</div>
                <h2 className="mt-2 text-sm font-semibold text-[var(--forma-text-strong)]">
                  {visualApprovalStatus === "approved"
                    ? cadComplete ? "Concept approved and CAD is ready" : "Concept approved"
                    : visualApprovalStatus === "rejected"
                      ? "Revision requested"
                      : "Review the whole-system concept before CAD"}
                </h2>
                <p className="mt-2 max-w-2xl text-xs leading-5 text-[var(--forma-text-secondary)]">
                  {visualApprovalStatus === "approved"
                    ? cadComplete
                      ? "The approved concept has continued through the CAD stage."
                      : "The visual is accepted. Continue when you are ready to spend the higher-cost CAD step."
                    : visualApprovalStatus === "rejected"
                      ? "Your feedback is saved. Describe the revision in chat to regenerate only the affected Progressive artifacts."
                      : "Approve the concept, or record what should change before generating component and assembly CAD."}
                </p>
              </div>
              <span className="shrink-0 rounded-md border border-[var(--forma-border)] bg-[var(--forma-surface)] px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--forma-text-muted)]">
                {visualApprovalStatus.replaceAll("_", " ")}
              </span>
            </div>

            {!cadComplete && visualApprovalStatus !== "approved" && (
              <div className="mt-4">
                <label htmlFor="progressive-revision-feedback" className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--forma-text-muted)]">
                  Revision feedback
                </label>
                <textarea
                  id="progressive-revision-feedback"
                  value={revisionFeedback}
                  onChange={(event) => setRevisionFeedback(event.target.value)}
                  disabled={Boolean(visualDecisionBusy) || !canManageProgressiveReview}
                  placeholder="Example: make the enclosure lower, move the power connector to the rear, and keep the drivetrain unchanged."
                  className="mt-2 min-h-[82px] w-full resize-y rounded-lg border border-[var(--forma-border)] bg-[var(--forma-page)] px-3 py-2.5 text-xs leading-5 text-[var(--forma-text-body)] outline-none transition focus:border-[rgb(var(--forma-cyan-rgb)/0.6)] disabled:cursor-not-allowed disabled:opacity-60"
                />
              </div>
            )}

            {persistedVisualFeedback && visualApprovalStatus === "rejected" && (
              <div className="mt-3 rounded-lg border border-[var(--forma-border)] bg-[var(--forma-surface)] px-3 py-2.5 text-xs leading-5 text-[var(--forma-text-secondary)]">
                <span className="font-semibold text-[var(--forma-text-strong)]">Saved feedback:</span> {persistedVisualFeedback}
              </div>
            )}

            {visualDecisionError && (
              <div role="alert" className="mt-3 rounded-lg border border-[rgb(var(--forma-red-rgb)/0.35)] bg-[rgb(var(--forma-red-rgb)/0.08)] px-3 py-2 text-xs text-[rgb(var(--forma-red-rgb))]">
                {visualDecisionError}
              </div>
            )}

            <div className="mt-4 flex flex-wrap gap-2">
              {visualApprovalStatus !== "approved" && (
                <button
                  type="button"
                  onClick={() => void onVisualDecision?.("approve")}
                  disabled={!canManageProgressiveReview || Boolean(visualDecisionBusy)}
                  className="inline-flex items-center gap-2 rounded-md bg-[rgb(var(--forma-cyan-rgb))] px-3 py-2 text-xs font-semibold text-black transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <CheckCircle className="h-4 w-4" />
                  {visualDecisionBusy === "approve" ? "Approving…" : "Approve concept"}
                </button>
              )}
              {visualApprovalStatus !== "approved" && (
                <button
                  type="button"
                  onClick={() => void onVisualDecision?.("revise", revisionFeedback.trim())}
                  disabled={!canManageProgressiveReview || Boolean(visualDecisionBusy) || !revisionFeedback.trim()}
                  className="inline-flex items-center gap-2 rounded-md border border-[var(--forma-border)] bg-[var(--forma-surface)] px-3 py-2 text-xs font-semibold text-[var(--forma-text-strong)] transition hover:border-[var(--forma-text-muted)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Sliders className="h-4 w-4" />
                  {visualDecisionBusy === "revise" ? "Saving…" : "Revise"}
                </button>
              )}
              {visualApprovalStatus === "approved" && !cadComplete && (
                <button
                  type="button"
                  onClick={() => void onVisualDecision?.("continue_to_cad")}
                  disabled={!canManageProgressiveReview || Boolean(visualDecisionBusy)}
                  className="inline-flex items-center gap-2 rounded-md bg-[var(--forma-text-strong)] px-3 py-2 text-xs font-semibold text-[var(--forma-page)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Wrench className="h-4 w-4" />
                  {visualDecisionBusy === "continue_to_cad" ? "Generating CAD…" : "Continue to CAD"}
                </button>
              )}
            </div>
          </section>
        )}

        {showHardwareReference && (
          <section className="mt-4 rounded-xl border border-[var(--forma-border)] bg-[var(--forma-surface)] p-3 sm:p-4">
            <div className="text-[11px] font-medium uppercase tracking-[0.16em] text-[var(--forma-text-muted)]">Hardware reference</div>
            <p className="mt-1 text-xs leading-5 text-[var(--forma-text-secondary)]">The image you shared for this project.</p>
            <div className={`mt-3 grid gap-2 ${referenceImages.length > 1 ? "sm:grid-cols-2" : ""}`}>
              {referenceImages.map((candidate) => (
                <Image
                  key={candidate.src}
                  src={candidate.src}
                  alt={candidate.label}
                  width={1}
                  height={1}
                  unoptimized
                  className="h-44 w-full rounded-lg bg-[var(--forma-surface-muted)] object-cover object-center sm:h-52"
                />
              ))}
            </div>
          </section>
        )}

        <div className="flex min-w-0 flex-col gap-5">
          {(showProductImage || productModel) && <div className="bb-rule" />}
          <h2 className="bb-sheet__title">{title}</h2>
          <div className="flex flex-wrap gap-2">
            {metadata.workflow && <span className="bb-req is-workflow">{String(metadata.workflow).toUpperCase()}</span>}
            {showModelName && llmProvider && llmModel && <span className="bb-req is-workflow">{projectLlmDisplayLabel(llmProvider, llmModel)}</span>}
            {features.slice(0, 12).map((feature, index) => (
              <span key={`${feature}-${index}`} className="bb-req">
                {String(feature).split(":")[0]}
              </span>
            ))}
          </div>

          <div className="flex flex-col gap-2">
            <span className="bb-eyebrow">Technical description</span>
            <p className="bb-sheet__prose">{description}</p>
          </div>

          {systemArchitecture?.root && (
            <section className="mt-6 rounded-xl border border-[var(--forma-border)] bg-[var(--forma-surface)] p-4 sm:p-5">
              <div className="flex items-start gap-3 border-b border-[var(--forma-border)] pb-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-[rgb(var(--forma-cyan-rgb)/0.35)] bg-[rgb(var(--forma-cyan-rgb)/0.1)] text-[rgb(var(--forma-cyan-rgb))]">
                  <GitBranch className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--forma-text-strong)]">System Architecture</h2>
                  <p className="mt-2 break-words text-xs leading-5 text-[var(--forma-text-muted)]">{systemArchitecture.summary}</p>
                </div>
              </div>
              <div className="mt-4">
                <SystemTreeNode node={systemArchitecture.root} depth={0} />
              </div>
            </section>
          )}

          <div className="mt-6 max-w-2xl overflow-hidden rounded-xl border border-[var(--forma-border)] bg-[var(--forma-surface)]">
            <div className="grid grid-cols-3 border-b border-[var(--forma-border)] bg-[var(--forma-surface-muted)] px-4 py-2.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--forma-text-muted)]">
              <span>Category</span>
              <span className="text-center">Parts</span>
              <span className="text-right">Cost</span>
            </div>
            <SummaryRow label="Electrical" parts={metrics.electricalParts} cost={metrics.electricalCost} />
            <SummaryRow label="Mechanical" parts={metrics.mechanicalParts} cost={metrics.mechanicalCost} />
            <SummaryRow label="Total" parts={metrics.totalParts} cost={metrics.totalCost} strong />
          </div>
        </div>
      </div>
    </div>
  );
}

function SystemTreeNode({ node, depth }: { node: Record<string, any>; depth: number }) {
  const reservedSystemIds = new Set([
    "system_id", "name", "domain", "purpose", "responsibilities", "constraints",
    "expected_component_roles", "interfaces", "connects_to", "detail_owner", "children",
  ]);
  const seenChildIds = new Set<string>();
  const children = (Array.isArray(node.children) ? node.children : [])
    .filter((child: unknown): child is Record<string, any> => Boolean(child && typeof child === "object"))
    .filter((child) => {
      const systemId = String(child.system_id || "").trim();
      const normalizedId = systemId.toLowerCase();
      if (!systemId || systemId.length > 100 || reservedSystemIds.has(normalizedId) || seenChildIds.has(normalizedId)) return false;
      seenChildIds.add(normalizedId);
      return true;
    })
    .slice(0, 32);
  const responsibilities = Array.isArray(node.responsibilities) ? node.responsibilities : [];
  const domain = String(node.domain || "system");

  return (
    <div className={depth ? "ml-3 border-l border-[var(--forma-border)] pl-3 sm:ml-5 sm:pl-5" : ""}>
      <article className="mb-3 rounded-lg border border-[var(--forma-border)] bg-[var(--forma-page)] p-3 sm:p-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-[rgb(var(--forma-cyan-rgb)/0.3)] bg-[rgb(var(--forma-cyan-rgb)/0.1)] px-2 py-1 text-[9px] font-medium uppercase tracking-[0.14em] text-[rgb(var(--forma-cyan-rgb))]">
            {domain}
          </span>
          <h3 className="break-words text-sm font-semibold text-[var(--forma-text-strong)]">{node.name || node.system_id}</h3>
        </div>
        <div className="mt-3 text-[9px] font-medium uppercase tracking-[0.16em] text-[var(--forma-text-muted)]">Why needed</div>
        <p className="mt-1.5 break-words text-xs leading-5 text-[var(--forma-text-secondary)]">{node.purpose}</p>
        {responsibilities.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {responsibilities.slice(0, 5).map((responsibility: string, index: number) => (
              <span key={`${node.system_id || node.name}-${index}`} className="max-w-full break-words rounded-md border border-[var(--forma-border)] px-2 py-1 text-[9px] font-medium text-[var(--forma-text-muted)]">
                {responsibility}
              </span>
            ))}
          </div>
        )}
      </article>
      {children.map((child: Record<string, any>, index: number) => (
        <SystemTreeNode key={`${node.system_id || "system"}-${child.system_id || "child"}-${index}`} node={child} depth={depth + 1} />
      ))}
    </div>
  );
}

function imageFormat(src: string): string {
  const match = /\.(png|jpe?g|webp|gif)(?:[?#]|$)/i.exec(src);
  if (match) return match[1].toUpperCase().replace("JPEG", "JPG");
  const data = /^data:image\/(png|jpe?g|webp)/i.exec(src);
  return data ? data[1].toUpperCase().replace("JPEG", "JPG") : "IMAGE";
}

/**
 * Media tab (design: render tiles + an ALPHA turntable note). The real video tools render below
 * when video generation is switched on, or when this project already has saved videos.
 */
export function MediaPanel({
  images,
  videoAvailable,
  unavailableReason = null,
  children,
}: {
  images: ProjectImageCandidate[];
  videoAvailable: boolean;
  unavailableReason?: string | null;
  children?: ReactNode;
}) {
  const renders = images.filter((candidate) => !isHardwareReferenceCandidate(candidate));
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  return (
    <div className="bb-sheet h-full min-w-0 overflow-y-auto overflow-x-hidden">
      <div className="bb-sheet__body gap-3.5">
        <div className="flex items-center gap-3">
          <span className="bb-icon-box"><Film className="h-4 w-4" /></span>
          <span className="flex flex-col gap-0.5">
            <span className="bb-eyebrow">Media</span>
            <span className="text-lg font-semibold">Renders &amp; video</span>
          </span>
        </div>
        {renders.length ? (
          <div className="grid gap-2.5" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 180px), 1fr))" }}>
            {renders.map((candidate, index) => (
              <button key={`${candidate.src}-${index}`} type="button" className="bb-media-tile" onClick={() => setLightboxIndex(index)} aria-label={`Open ${candidate.label} full size`}>
                <Image src={candidate.src} alt={candidate.label} width={1} height={1} unoptimized className="bb-media-tile__img" />
                <span className="bb-media-tile__label">
                  <span className="truncate">{candidate.label}</span>
                  <span className="bb-media-tile__fmt">{imageFormat(candidate.src)}</span>
                </span>
              </button>
            ))}
          </div>
        ) : (
          <div className="bb-hatch grid aspect-[16/6] place-items-center rounded-[10px] border border-[rgba(120,160,230,0.35)]">
            <span className="font-[family-name:var(--craft-mono)] text-[11px] font-medium uppercase tracking-[0.14em] text-[#4a6fa8]">No renders for this revision</span>
          </div>
        )}
        {!videoAvailable && (
          <div className="bb-card is-amber">
            <span className="font-[family-name:var(--craft-mono)] text-[11px] font-bold tracking-[0.14em] text-[#ffb547]">✦ ALPHA</span>
            <span className="text-[15px] text-[#f4f7fb]">Turntable video generation is coming soon.</span>
            <span className="text-[13px] text-[#a9bedd]">It will render a short 360° spin from the same 3D model.</span>
            {unavailableReason && <span className="text-xs text-[#7f9ccc]">{unavailableReason}</span>}
          </div>
        )}
        {children}
      </div>
      {lightboxIndex !== null && renders.length > 0 && (
        <ImageLightbox
          images={renders}
          index={Math.min(lightboxIndex, renders.length - 1)}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

/** Production runs for the parts list's quantity switch (design: 1 UNIT / 1K / 10K). */
const BOM_RUNS = [
  { key: "1", label: "1 unit", quantity: 1 },
  { key: "1K", label: "1K units", quantity: 1000 },
  { key: "10K", label: "10K units", quantity: 10000 },
] as const;

export function BomPanel({
  components,
  metrics,
  cadSources = [],
  fabricationCost = 0,
  canDownloadAssets = false,
}: {
  components: any[];
  metrics: ReturnType<typeof emptyMetrics>;
  cadSources?: any[];
  fabricationCost?: number;
  canDownloadAssets?: boolean;
}) {
  const [run, setRun] = useState<(typeof BOM_RUNS)[number]>(BOM_RUNS[0]);
  const unitCost = metrics.totalCost;
  return (
    <div className="bb-sheet h-full min-w-0 overflow-y-auto overflow-x-hidden">
      <div className="bb-sheet__body is-tight">
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="flex flex-col gap-1">
            <span className="bb-eyebrow is-amber">Parts list · {components.length} items</span>
            <span className="bb-sheet__h">Bill of materials</span>
          </div>
          <span className="flex-1" />
          <div className="bb-units" role="group" aria-label="Production run">
            {BOM_RUNS.map((option) => (
              <button key={option.key} type="button" aria-pressed={run.key === option.key} className={run.key === option.key ? "is-active" : ""} onClick={() => setRun(option)}>
                {option.key === "1" ? "1 unit" : option.key}
              </button>
            ))}
          </div>
        </div>

        {components.length > 0 ? (
          <div className="bb-bom" role="table" aria-label="Bill of materials">
            <div className="bb-bom__row is-head" role="row">
              <span role="columnheader">#</span>
              <span role="columnheader">Part</span>
              <span role="columnheader">Spec</span>
              <span role="columnheader">Source</span>
              <span role="columnheader" className="text-right">Unit</span>
            </div>
            {components.map((component, index) => {
              const quantity = Number(component.quantity || 1);
              const refs = Array.isArray(component.instance_refs) ? component.instance_refs.join(", ") : "";
              return (
                <div key={component.line_id || component.ref_des || component.part_definition_id || index} className="bb-bom__row" role="row">
                  <span className="bb-bom__n" role="cell">{String(index + 1).padStart(2, "0")}</span>
                  <span className="bb-bom__part" role="cell">
                    <span>
                      {component.name}
                      {quantity > 1 && <span className="bb-bom__qty"> × {quantity}</span>}
                    </span>
                    {component.rationale && <span className="bb-bom__why">{component.rationale}</span>}
                  </span>
                  <span className="bb-bom__spec" role="cell">{[component.category, refs].filter(Boolean).join(" · ")}</span>
                  <span className="bb-bom__src" role="cell">
                    {getSourcesForComponent(component).map((source) => (
                      <ComponentSourceAction key={`${source.label}-${source.href}`} source={source} component={component} canDownloadAssets={canDownloadAssets} />
                    ))}
                  </span>
                  <span className="bb-bom__unit" role="cell">~${Number(component.unit_price || 0).toFixed(2)}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="bb-note">No parts were generated for this revision.</p>
        )}

        <div className="bb-totals">
          <div className="bb-total">
            <span className="bb-eyebrow">Unit cost @ {run.label}</span>
            <span className="bb-total__value">~${unitCost.toFixed(2)}</span>
          </div>
          <div className="bb-total">
            <span className="bb-eyebrow">Run total</span>
            <span className="bb-total__value">~${Math.round(unitCost * run.quantity).toLocaleString("en-US")}</span>
          </div>
          <div className="bb-total is-note">
            Single-unit retail estimates from the sourcing agent. Volume pricing and tooling aren&apos;t included, so large runs usually cost less per unit.
          </div>
        </div>

        <section className="bb-card">
          <div className="flex items-start justify-between gap-4 border-b border-[var(--forma-border)] pb-4">
            <div className="min-w-0">
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--forma-text-strong)]">CAD Sources</h2>
              <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--forma-text-muted)]">3D Printed</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-[11px] font-medium uppercase tracking-[0.14em] text-[var(--forma-text-muted)]">Mech Cost</div>
              <div className="mt-1 text-lg font-semibold tracking-tight text-[var(--forma-text-strong)]">~${fabricationCost.toFixed(2)}</div>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {!canDownloadAssets ? (
              <div className="rounded-lg border border-[var(--forma-border)] bg-[var(--forma-surface-muted)] px-3 py-3 text-xs leading-6 text-[var(--forma-text-secondary)]">
                Files are available only on projects you generated.
              </div>
            ) : cadSources.length ? cadSources.slice(0, 3).map((source: any) => (
              <a
                key={`${source.name}-${source.url}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="block rounded-lg border border-[var(--forma-border)] bg-[var(--forma-surface-muted)] p-3 transition hover:border-[rgb(var(--forma-cyan-rgb)/0.45)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="break-words text-xs font-semibold text-[var(--forma-text-strong)]">{source.name}</div>
                    <div className="mt-1.5 break-words text-[11px] font-medium uppercase tracking-[0.12em] text-[rgb(var(--forma-cyan-rgb))]">{source.source_type || "CAD"} / ${(Number(source.estimated_unit_price_usd || 0)).toFixed(2)}</div>
                  </div>
                  <ExternalLink className="mt-0.5 h-4 w-4 shrink-0 text-[var(--forma-text-muted)]" />
                </div>
                {source.file_formats?.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {source.file_formats.map((format: string) => (
                      <span key={format} className="rounded-md border border-[var(--forma-border)] px-2 py-1 text-[10px] font-medium uppercase tracking-[0.12em] text-[var(--forma-text-muted)]">{format}</span>
                    ))}
                  </div>
                )}
              </a>
            )) : (
              <div className="rounded-lg border border-[var(--forma-border)] bg-[var(--forma-surface-muted)] px-3 py-3 text-xs leading-6 text-[var(--forma-text-secondary)]">
                No CAD source records attached.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function ComponentSourceAction({
  source,
  component,
  canDownloadAssets,
  className = "",
}: {
  source: { label: string; className: string; href: string; title: string };
  component: any;
  canDownloadAssets: boolean;
  className?: string;
}) {
  const isFabricationAsset = source.label.toLowerCase() === "fabricate";
  const baseClass = `${className} rounded-md font-medium transition focus:outline-none focus:ring-2 focus:ring-[rgb(var(--forma-cyan-rgb)/0.45)]`;
  if (isFabricationAsset && !canDownloadAssets) {
    return (
      <span
        title="Files are available only on projects you generated."
        className={`${baseClass} cursor-not-allowed border border-[var(--forma-border)] bg-[var(--forma-surface-muted)] text-[var(--forma-text-muted)]`}
      >
        {source.label}
      </span>
    );
  }

  return (
    <a
      href={source.href}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${source.label} source for ${component.name || component.part_number || "component"}`}
      title={source.title}
      className={`${baseClass} ${source.className} text-black hover:-translate-y-0.5 hover:brightness-110`}
    >
      {source.label}
    </a>
  );
}

export function MechanicalPanel({
  toggles,
  setToggles,
  electricalActive,
  setElectricalActive,
  components,
  features,
  metadata,
  mechanical,
  cadModel,
  systemArchitecture,
  title,
}: {
  title?: string;
  toggles: Record<string, boolean>;
  setToggles: (value: any) => void;
  electricalActive: boolean;
  setElectricalActive: (value: boolean) => void;
  components: any[];
  features: string[];
  metadata: Record<string, any>;
  mechanical: Record<string, any>;
  cadModel?: Record<string, any> | null;
  systemArchitecture?: Record<string, unknown> | null;
}) {
  const visualSpec = metadata.product_visual_spec || {};
  const dimensions = mechanical.render_dimensions || visualSpec.external_dimensions_mm || metadata.render_dimensions || { x_mm: 100, y_mm: 60, z_mm: 36 };
  const placements = mechanical.component_placements || metadata.component_placements || [];
  const relationships = mechanical.spatial_relationships || metadata.spatial_relationships || [];
  const kinematics = cadModel && typeof cadModel === "object" ? cadModel.kinematics : null;
  const compliantPreview = cadModel && typeof cadModel === "object" ? cadModel.compliant_preview : null;
  // The 3D product model is the same one shown on Overview and used for the renders, so it leads here too.
  const productModel = useMemo(
    () => resolveProductModel(metadata?.product_model, mechanical, components),
    [components, mechanical, metadata?.product_model],
  );
  const hasProductModel = productModel?.source === "product_model";
  const [view, setView] = useState<"product" | "layout">(hasProductModel ? "product" : "layout");
  const showProduct = view === "product" && productModel;

  const viewSwitch = productModel ? (
    <div role="group" aria-label="Mechanical view" className="bb-seg">
      {[
        { value: "product" as const, label: "3D product" },
        { value: "layout" as const, label: "Engineering layout" },
      ].map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={view === option.value}
          className={view === option.value ? "is-active" : ""}
          onClick={() => setView(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  ) : null;

  if (showProduct) {
    return (
      <div className="relative h-full min-h-[420px] w-full">
        <ProductModelViewer
          key={`${productModel.parts.length}:${productModel.extent.join(",")}`}
          model={productModel}
          variant="full"
          title={title}
          headerAction={viewSwitch}
        />
      </div>
    );
  }

  return (
    <div className="relative flex h-full min-h-[420px] w-full flex-col overflow-hidden bg-[var(--forma-page)]">
      {viewSwitch && (
        <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[#3a70c4] bg-[#0e2a57] px-4 py-2">
          {viewSwitch}
          <span className="bb-eyebrow hidden sm:block">Part placements and clearances from the enclosure plan</span>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <MechanicalScene
          systemArchitecture={systemArchitecture}
          dimensions={dimensions}
          components={components}
          placements={placements}
          relationships={relationships}
          kinematics={kinematics}
          articulatedBodies={cadModel?.articulated_bodies}
          compliantPreview={compliantPreview}
          features={features}
          toggles={toggles}
          setToggles={setToggles}
          electricalActive={electricalActive}
          setElectricalActive={setElectricalActive}
        />
      </div>
    </div>
  );
}

function isCriticalIssue(issue: any) {
  const key = String(issue?.severity || "").toLowerCase();
  return key === "critical" || key === "error";
}

/** Audit card tag per severity (design: REPAIRED / PASS / NOTE cards). */
function auditTag(issue: any): { tag: string; tone: "red" | "amber" | "muted" } {
  const key = String(issue?.severity || "").toLowerCase();
  if (key === "critical" || key === "error") return { tag: "Revise", tone: "red" };
  if (key === "warning") return { tag: "Check", tone: "amber" };
  return { tag: "Note", tone: "muted" };
}

export function AssemblyPanel({
  assembly,
  issues,
}: {
  assembly: any[];
  issues: any[];
}) {
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const doneCount = assembly.filter((step, index) => checked[step.step_num ?? index]).length;
  const allDone = assembly.length > 0 && doneCount === assembly.length;
  const critical = issues.some(isCriticalIssue);
  return (
    <div className="bb-sheet h-full min-w-0 overflow-y-auto overflow-x-hidden">
      <div className="bb-sheet__body is-tight">
        <div className="flex flex-wrap items-end gap-3.5">
          <div className="flex flex-col gap-1">
            <span className="bb-eyebrow is-amber">
              Build guide · {assembly.length} steps · {doneCount} / {assembly.length} done
            </span>
            <span className="bb-sheet__h">Assembly, in order</span>
          </div>
          {allDone && (
            <Stamp tone="amber" rotate={-12} className="ml-auto self-center text-[13px]">
              ✓ Approved
            </Stamp>
          )}
        </div>
        <div className="bb-guide-bar" role="progressbar" aria-valuemin={0} aria-valuemax={assembly.length} aria-valuenow={doneCount} aria-label="Build steps done">
          <div style={{ width: `${assembly.length ? (doneCount / assembly.length) * 100 : 0}%` }} />
        </div>

        {assembly.length === 0 && <p className="bb-note">No build steps were generated for this revision.</p>}
        {assembly.map((step, index) => {
          const key = step.step_num ?? index;
          const done = Boolean(checked[key]);
          return (
            <div
              key={key}
              role="checkbox"
              aria-checked={done}
              tabIndex={0}
              className={`bb-step-row ${done ? "is-done" : ""}`}
              onClick={() => setChecked((current) => ({ ...current, [key]: !current[key] }))}
              onKeyDown={(event) => {
                if (event.key !== " " && event.key !== "Enter") return;
                event.preventDefault();
                setChecked((current) => ({ ...current, [key]: !current[key] }));
              }}
            >
              <span className="bb-step-row__box">{done ? "✓" : ""}</span>
              <span className="bb-step-row__n">{String(step.step_num ?? index + 1).padStart(2, "0")}</span>
              <span className="flex min-w-0 flex-col gap-1.5">
                <span className="bb-step-row__title">{step.title}</span>
                <span className="bb-step-row__text">{step.description}</span>
                {step.danger_flag && (
                  <span className="bb-step-row__danger">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span className="min-w-0">{step.danger_message || "Pay close attention to safety constraints during this stage."}</span>
                  </span>
                )}
                {step.affected_components?.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {step.affected_components.map((part: string) => (
                      <span key={part} className="bb-step-row__part">{part}</span>
                    ))}
                  </span>
                )}
              </span>
            </div>
          );
        })}

        <div className="bb-card is-spaced">
          <div className="flex items-center gap-2.5">
            <ShieldCheck className="h-4 w-4 text-[#a9bedd]" />
            <span className="bb-eyebrow">Safety audit</span>
            <span className={`bb-audit-stamp ${critical ? "is-revise" : ""}`}>{critical ? "Revise" : "Pass"}</span>
          </div>
          <span className="text-[13px] text-[#a9bedd]">
            {critical
              ? "The automatic checks found problems to fix before building."
              : "The automatic checks found nothing critical. Have a person review it before you build."}
          </span>
          {issues.length ? (
            issues.map((issue, index) => {
              const { tag, tone } = auditTag(issue);
              return (
                <div key={`${issue.description}-${index}`} className={`bb-audit is-${tone}`}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="bb-audit__tag">{tag}</span>
                    {issue.category && <span className="bb-audit__kind">{issue.category}</span>}
                  </span>
                  <span className="bb-audit__text">{issue.description}</span>
                  {issue.troubleshooting && <span className="bb-audit__fix">{issue.troubleshooting}</span>}
                </div>
              );
            })
          ) : (
            <div className="bb-audit is-green">
              <span className="flex flex-wrap items-center gap-2">
                <span className="bb-audit__tag">Pass</span>
                <span className="bb-audit__kind">Wiring</span>
              </span>
              <span className="bb-audit__text">All electrical nets validated safely.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}


export function PartsSidebar({ components, issues, isValid }: { components: any[]; issues: any[]; isValid: boolean }) {
  return (
    <aside className="hidden min-h-0 border-l border-[#282a30] bg-[#17181d] xl:flex xl:flex-col">
      <div className="border-b border-[#282a30] p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Box className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Parts List</h2>
          </div>
          <span className="border border-[#30323a] px-2 py-1 text-[10px] text-slate-500">{components.length}</span>
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-4 py-4">
        {components.map((component, index) => {
          const tone = categoryTone[component.category?.toLowerCase()] || categoryTone.default;
          const Icon = iconForCategory(component.category);
          return (
            <div key={`${component.ref_des}-${index}`} className="flex min-w-0 items-center gap-3 py-1.5">
              <Icon className={`h-4 w-4 shrink-0 ${tone.text}`} />
              <span className="truncate text-sm font-bold text-slate-300">{component.name}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[#282a30] p-4">
        <div className={`flex items-center gap-2 border p-3 text-xs font-black uppercase tracking-widest ${
          isValid ? "border-emerald-500/30 bg-emerald-950/20 text-emerald-300" : "border-rose-500/30 bg-rose-950/20 text-rose-300"
        }`}>
          {isValid ? <CheckCircle className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
          {isValid ? "Circuit Approved" : `${issues.length} Issues`}
        </div>
      </div>
    </aside>
  );
}

export function ImageUnavailableState({ failed = false }: { failed?: boolean }) {
  return (
    <div className="bb-hatch flex h-full min-h-[220px] flex-col items-center justify-center px-8 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-md border border-[rgb(20_54_110/0.3)] text-[#4a6fa8]">
        {failed ? <AlertTriangle className="h-6 w-6" /> : <Box className="h-6 w-6" />}
      </div>
      <div className="mt-4 font-[family-name:var(--craft-mono)] text-[11px] font-medium uppercase tracking-[0.14em] text-[#4a6fa8]">
        {failed ? "Product render · unavailable" : "Product render · not generated"}
      </div>
      <p className="mt-2 max-w-md text-xs leading-5 text-[#4a6fa8]">
        {failed
          ? "Image generation failed for this revision. The project data and build artifacts are still available."
          : "No generated product image is available for this revision."}
      </p>
    </div>
  );
}

export function SummaryRow({ label, parts, cost, strong = false }: { label: string; parts: number; cost: number; strong?: boolean }) {
  return (
    <div className={`grid grid-cols-3 border-b border-[var(--forma-border)] px-4 py-2.5 text-sm last:border-b-0 ${strong ? "font-semibold text-[var(--forma-text-strong)]" : "text-[var(--forma-text-body)]"}`}>
      <span>{label}</span>
      <span className="text-center">{parts}</span>
      <span className="text-right">${cost.toFixed(2)}</span>
    </div>
  );
}

export function CategoryBadge({ category }: { category: string }) {
  const tone = categoryTone[category?.toLowerCase()] || categoryTone.default;
  const Icon = iconForCategory(category);
  return (
    <span className={`mt-3 inline-flex items-center gap-1.5 rounded-md border ${tone.border} ${tone.bg} px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${tone.text}`}>
      <Icon className="h-3 w-3" />
      {tone.label}
    </span>
  );
}

export function PartThumb({ component }: { component: any }) {
  const tone = categoryTone[component.category?.toLowerCase()] || categoryTone.default;
  const Icon = iconForCategory(component.category);
  return (
    <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-[var(--forma-border)] bg-[var(--forma-surface-muted)]">
      <div className={`flex h-11 w-11 items-center justify-center rounded-md border ${tone.border} ${tone.bg}`}>
        <Icon className={`h-6 w-6 ${tone.text}`} />
      </div>
    </div>
  );
}

function getSourcesForComponent(component: any): Array<{ label: string; className: string; href: string; title: string }> {
  const category = component.category?.toLowerCase();
  const withHref = (source: { label: string; className: string }) => ({
    ...source,
    href: sourceHrefForComponent(component, source.label),
    title: sourceTitleForComponent(component, source.label),
  });

  if (category === "actuator") {
    return [
      { label: "AliExpress", className: "bg-orange-600" },
      { label: "Amazon", className: "bg-amber-400" },
      { label: "eBay", className: "bg-blue-600 text-white" },
      { label: "Newegg", className: "bg-orange-500" },
    ].map(withHref);
  }
  if (category === "power" && component.name?.toLowerCase().includes("charger")) {
    return [
      { label: "Amazon", className: "bg-amber-400" },
      { label: "eBay", className: "bg-blue-600 text-white" },
      { label: "Newegg", className: "bg-orange-500" },
    ].map(withHref);
  }
  if (category === "mechanical" || category === "3d print") {
    return [
      { label: "fabricate", className: "bg-blue-600 text-white" },
    ].map(withHref);
  }
  return [
    { label: "eBay", className: "bg-blue-600 text-white" },
    { label: "Amazon", className: "bg-amber-400" },
    { label: "Newegg", className: "bg-orange-500" },
  ].map(withHref);
}

function componentSearchText(component: any) {
  const values = [component.part_number, component.name, component.category].filter(Boolean);
  return values.join(" ").trim() || "electronic component";
}

function sourceHrefForComponent(component: any, label: string) {
  const normalizedLabel = label.toLowerCase();
  const query = encodeURIComponent(componentSearchText(component));

  if (normalizedLabel === "aliexpress") return `https://www.aliexpress.com/wholesale?SearchText=${query}`;
  if (normalizedLabel === "amazon") return `https://www.amazon.com/s?k=${query}`;
  if (normalizedLabel === "ebay") return `https://www.ebay.com/sch/i.html?_nkw=${query}`;
  if (normalizedLabel === "newegg") return `https://www.newegg.com/p/pl?d=${query}`;
  if (normalizedLabel === "fabricate") {
    const explicitUrl = firstComponentSourceUrl(component);
    return explicitUrl || `https://www.printables.com/search/models?q=${query}`;
  }

  return firstComponentSourceUrl(component) || `https://www.google.com/search?q=${query}`;
}

function sourceTitleForComponent(component: any, label: string) {
  const part = component.part_number || component.name || "component";
  if (label.toLowerCase() === "fabricate") return `Find fabrication/CAD sources for ${part}`;
  return `Search ${label} for ${part}`;
}

function firstComponentSourceUrl(component: any) {
  const candidates = [
    component.sourcing_url,
    component.source_url,
    component.supplier_url,
    component.vendor_url,
    component.purchase_url,
    component.url,
  ];
  const match = candidates.find((candidate) => typeof candidate === "string" && /^https?:\/\//i.test(candidate));
  return match || "";
}

function iconForCategory(category = "") {
  const cat = category.toLowerCase();
  if (cat === "microcontroller") return Cpu;
  if (cat === "sensor") return Database;
  if (cat === "power") return Battery;
  if (cat === "display") return Monitor;
  if (cat === "actuator") return Volume2;
  if (cat === "passives") return Sliders;
  if (cat === "mechanical") return Wrench;
  if (cat === "3d print") return Printer;
  return Box;
}

function emptyMetrics() {
  return { electricalParts: 0, mechanicalParts: 0, totalParts: 0, electricalCost: 0, mechanicalCost: 0, totalCost: 0 };
}
