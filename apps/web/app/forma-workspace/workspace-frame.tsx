import type { ReactNode } from "react";

import { LivingGrid, PaperGrain } from "../../components/craft";
import { WorkspaceStatusCorner } from "./sidebar";
import { WorkspaceStatusContext } from "./bb-shell";
import type { WorkspaceStatusPresentation } from "../../lib/connection-status";

type WorkspaceFrameProps = {
  collapsed: boolean;
  mobileSidebar: ReactNode;
  desktopSidebar: ReactNode;
  children: ReactNode;
  homeMobileTopPadding?: boolean;
  workspaceStatus: WorkspaceStatusPresentation;
};

export default function WorkspaceFrame({
  collapsed,
  mobileSidebar,
  desktopSidebar,
  children,
  homeMobileTopPadding = false,
  workspaceStatus,
}: WorkspaceFrameProps) {
  return (
    <div
      className={
        homeMobileTopPadding
          ? "craft-app relative h-[100dvh] w-full overflow-hidden bg-[#0f1117] font-[family-name:var(--craft-sans)] text-zinc-100"
          : "craft-app relative h-[100dvh] w-full overflow-hidden bg-[#0f1117] font-[family-name:var(--craft-sans)] text-zinc-200"
      }
    >
      {/* The drafting grid shows through the open space around the chat (blue theme only). */}
      <LivingGrid />
      <PaperGrain />
      {mobileSidebar}
      <WorkspaceStatusCorner status={workspaceStatus} />
      <div
        className={`relative z-[2] grid h-full min-h-0 min-w-0 overflow-hidden ${
          collapsed ? "md:grid-cols-[72px_minmax(0,1fr)]" : "md:grid-cols-[260px_minmax(0,1fr)]"
        }`}
      >
        {desktopSidebar}
        <div
          className={
            homeMobileTopPadding
              ? "relative flex h-full min-h-0 min-w-0 flex-col overflow-hidden"
              : "grid h-full min-h-0 min-w-0 grid-cols-1 overflow-hidden"
          }
        >
          <WorkspaceStatusContext.Provider value={workspaceStatus}>{children}</WorkspaceStatusContext.Provider>
        </div>
      </div>
    </div>
  );
}
