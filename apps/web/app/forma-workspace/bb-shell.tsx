"use client";

import { createContext, useContext, type ReactNode, type RefObject } from "react";
import Link from "next/link";
import { ArrowUpRight, Layers } from "lucide-react";

import { ConnectWalletButton } from "../../components/connect-wallet-button";
import type { WorkspaceStatusPresentation } from "../../lib/connection-status";
import { revisionLetter, useProjectHistory } from "./project-history";
import { ApiConnectionStatus } from "./sidebar";

/**
 * Pieces of the redesigned app shell (design_handoff_bluebuild_redesign/Bluebuild App.dc.html):
 * the drawing header, the bracketed composer and the empty "What do you want to build?" state.
 */

export type DrawingStatus = "idle" | "drafting" | "ready";

export type WorkspaceHeading = {
  title: ReactNode;
  /** Mobile sidebar button and similar controls shown before the drawing number. */
  leading?: ReactNode;
  drafting?: boolean;
};

/** Backend connection status, provided by WorkspaceFrame so the header can show its dot. */
export const WorkspaceStatusContext = createContext<WorkspaceStatusPresentation | null>(null);

/** "BB-" plus the first four characters of the project id, the same number the panel title block shows. */
export function drawingNumber(projectId: string | null | undefined) {
  return projectId ? `BB-${projectId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()}` : null;
}

export function WorkspaceHead({
  heading,
  projectId,
  hasProject,
  projectOpen,
  onToggleProject,
  projectButtonRef,
}: {
  heading: WorkspaceHeading;
  projectButtonRef?: RefObject<HTMLButtonElement | null>;
  projectId: string | null;
  hasProject: boolean;
  projectOpen: boolean;
  onToggleProject: () => void;
}) {
  const history = useProjectHistory();
  const connection = useContext(WorkspaceStatusContext);
  const rev = revisionLetter(history?.latestRevision);
  const dwg = drawingNumber(projectId);
  const status: DrawingStatus = heading.drafting ? "drafting" : hasProject ? "ready" : "idle";
  const statusText = status === "drafting" ? "DRAFTING" : status === "ready" ? `DRAWN · REV ${rev}` : "IDLE · READY TO DRAW";
  return (
    <header className="bb-head">
      {heading.leading}
      <div className="bb-head__id">
        <span className="bb-head__dwg">{dwg ? `DWG NO. ${dwg} · REV ${rev}` : "NEW DRAWING"}</span>
        <span className="bb-head__title">{heading.title}</span>
      </div>
      <span className={`bb-head__status is-${status}`} role="status">
        <span aria-hidden="true" />
        {statusText}
      </span>
      <span className="bb-head__spacer" />
      {hasProject && (
        <button
          ref={projectButtonRef}
          type="button"
          className={`bb-head__project${projectOpen ? " is-open" : ""}`}
          onClick={onToggleProject}
          aria-label={projectOpen ? "Hide project" : "Show project"}
        >
          <Layers aria-hidden="true" />
          Project
        </button>
      )}
      {connection && <ApiConnectionStatus status={connection} />}
      <span className="bb-head__wallet">
        <ConnectWalletButton />
      </span>
      <Link href="/" className="bb-head__site">
        ← SITE
      </Link>
    </header>
  );
}

/**
 * The paper-like composer box: label tab on the top edge ("REQ-01 · DESCRIBE IT", then
 * "REQ-02 · REFINE REV A" once there is a project) and amber corner brackets.
 */
export function ComposerFrame({ request, refining, busy = false, children }: { request: number; refining: boolean; busy?: boolean; children: ReactNode }) {
  const history = useProjectHistory();
  const req = `REQ-${String(Math.max(1, request)).padStart(2, "0")}`;
  const label = refining ? `${req} · REFINE REV ${revisionLetter(history?.latestRevision)}` : `${req} · DESCRIBE IT`;
  return (
    <div className={`bb-composer${busy ? " is-busy" : ""}`}>
      <span className="bb-composer__label">{label}</span>
      <span className="bb-composer__corner is-tl" aria-hidden="true" />
      <span className="bb-composer__corner is-br" aria-hidden="true" />
      {children}
    </div>
  );
}

export function ScopeChip() {
  return (
    <span className="bb-composer__scope" title="Bluebuild designs low-voltage maker electronics (3.3–5 V).">
      SCOPE 3.3–5 V
    </span>
  );
}

/** Empty chat: heading over two slowly counter-rotating rings. */
export function EmptyDrawing() {
  return (
    <div className="bb-empty">
      <span className="bb-empty__ring is-outer" aria-hidden="true" />
      <span className="bb-empty__ring is-inner" aria-hidden="true" />
      <span className="bb-empty__kicker">NEW DRAWING · DESCRIBE IT BELOW</span>
      <h1 className="bb-empty__h1">What do you want to build?</h1>
      <p className="bb-empty__lede">
        One sentence is enough. Add a sketch if you have one. You&apos;ll get parts, wiring, a 3D model and a build guide.
      </p>
    </div>
  );
}

const CARD_TILT = ["-1.5deg", "1.2deg", "0.8deg", "-1deg"];

/** Pinned example cards under the empty composer. */
export function ExampleCards({ examples, onSelect }: { examples: string[]; onSelect: (example: string) => void }) {
  return (
    <div className="bb-examples">
      {examples.map((example, index) => (
        <button
          key={example}
          type="button"
          className="bb-example"
          style={{ ["--bb-tilt" as string]: CARD_TILT[index % CARD_TILT.length] }}
          onClick={() => onSelect(example)}
        >
          <span className="bb-example__pin" aria-hidden="true" />
          <span className="bb-example__top">
            <span>EXAMPLE {String(index + 1).padStart(2, "0")}</span>
            <ArrowUpRight aria-hidden="true" />
          </span>
          <span className="bb-example__text">{example}</span>
        </button>
      ))}
    </div>
  );
}
