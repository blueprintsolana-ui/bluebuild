"use client";

import React, { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { webConfig } from "../lib/config";
import { useFormaAuth } from "../lib/forma-auth";
import { MechanicalCounter } from "./craft/mechanical-counter";
import { Stamp } from "./craft/stamp";

type QuotaStatus = {
  gating: boolean;
  signed_in?: boolean;
  token_live?: boolean;
  tier?: string;
  limit?: number;
  remaining?: number;
  holding?: number;
  wallet?: string | null;
  free_per_day?: number;
  free_pool_empty?: boolean;
  connection_limited?: boolean;
  resets_at?: string;
  error?: string;
  owner?: boolean;
};

function apiUrl(): string {
  const trimmed = (webConfig.apiBaseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "/api";
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

function shortWallet(address?: string | null): string {
  if (!address) return "";
  return `${address.slice(0, 4)}…${address.slice(-4)}`;
}

function formatTokens(value?: number): string {
  if (!value) return "0";
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${Math.floor(value / 1_000)}K`;
  return String(Math.floor(value));
}

function tierStub(status: QuotaStatus): string {
  if (status.owner) return "Owner";
  if (status.tier === "free") return "Free";
  return `Tier ${status.tier?.replace("tier-", "") || ""}`.trim();
}

/** Workspace screens show the ticket in the sidebar, so the floating one would cover the composer. */
const WORKSPACE_PREFIXES = ["/app", "/chat/", "/project/", "/projects", "/my-projects", "/jobs", "/settings", "/about"];

function isWorkspaceRoute(pathname: string) {
  return WORKSPACE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : `${prefix}/`));
}

function useQuotaStatus() {
  const { isSignedIn, getToken } = useFormaAuth();
  const [status, setStatus] = useState<QuotaStatus | null>(null);

  const refresh = useCallback(async () => {
    try {
      const token = isSignedIn ? await getToken() : null;
      const res = await fetch(`${apiUrl()}/bluebuild/status`, {
        cache: "no-store",
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (res.ok) setStatus(await res.json());
    } catch {
      // The ticket is informational; stay quiet if the API is unreachable.
    }
  }, [getToken, isSignedIn]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 20_000);
    const onFocus = () => void refresh();
    window.addEventListener("focus", onFocus);
    window.addEventListener("bluebuild:refresh", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("bluebuild:refresh", onFocus);
    };
  }, [refresh]);

  return status;
}

/**
 * The design allowance as a ticket stub: tier on the stub (re-stamped when it changes) and the
 * designs left on a mechanical counter. "Holder tier 2 · 14 of 20 designs left today".
 */
function QuotaTicket({ status, floating }: { status: QuotaStatus; floating: boolean }) {
  const { openSignIn } = useFormaAuth();
  const className = `craft-ticket ${floating ? "craft-ticket--floating" : ""}`;

  if (!status.signed_in) {
    return (
      <button
        type="button"
        onClick={() => openSignIn({ redirectUrl: typeof window !== "undefined" ? window.location.href : "/" })}
        className={`${className} craft-ticket--action`}
      >
        <span className="craft-ticket__stub">Admit</span>
        <span className="craft-ticket__body">
          <span>Connect a Solana wallet</span>
          <span className="craft-ticket__fine">
            for <span className="text-[var(--craft-amber)]">{status.free_per_day ?? 5} free designs</span> a day
          </span>
        </span>
      </button>
    );
  }

  if (status.error) {
    return (
      <div className={className} role="status">
        <span className="craft-ticket__stub">—</span>
        <span className="craft-ticket__body craft-ticket__fine">Design allowance unavailable right now</span>
      </div>
    );
  }

  const stub = (
    <span className="craft-ticket__stub">
      <Stamp tone={status.tier === "free" && !status.owner ? "ink" : "amber"} rotate={-8} stampKey={tierStub(status)} className="craft-ticket__tier">
        {tierStub(status)}
      </Stamp>
    </span>
  );

  if (status.owner) {
    return (
      <div className={className} role="status">
        {stub}
        <span className="craft-ticket__body">
          <span>No daily limit</span>
          <span className="craft-ticket__fine">Other people see their tier here</span>
        </span>
      </div>
    );
  }

  const remaining = status.remaining ?? 0;
  const limit = status.limit ?? 0;
  const usedUp =
    status.free_pool_empty && status.tier === "free"
      ? "Free designs used up today"
      : status.connection_limited
        ? "Free designs for this connection used up today"
        : null;

  return (
    <div className={className} role="status" aria-live="polite">
      {stub}
      <span className="craft-ticket__body">
        {usedUp ? (
          <span className="text-[var(--craft-amber)]">{usedUp}</span>
        ) : (
          <span className="flex items-baseline gap-1.5">
            <MechanicalCounter value={remaining} className={remaining <= 0 ? "text-[var(--craft-amber)]" : ""} />
            <span className="craft-ticket__fine">of {limit} designs left today</span>
          </span>
        )}
        {status.wallet ? (
          <span className="craft-ticket__fine">
            {shortWallet(status.wallet)}
            {status.token_live ? ` · ${formatTokens(status.holding)} $BLUEBUILD` : ""}
          </span>
        ) : null}
      </span>
    </div>
  );
}

function FloatingQuotaTicket() {
  const status = useQuotaStatus();
  if (!status?.gating) return null;
  return <QuotaTicket status={status} floating />;
}

/** Floating ticket for pages outside the workspace (bottom right). */
export function BluebuildQuotaBadge() {
  const pathname = usePathname() || "";
  // The landing page and coin pitch decks are for visitors, not design allowances.
  const visitorPage = pathname === "/" || pathname.startsWith("/coin/") || pathname.startsWith("/craft-kit");
  if (visitorPage || isWorkspaceRoute(pathname)) return null;
  return <FloatingQuotaTicket />;
}

/** The same ticket, tucked into the bottom of the workspace sidebar. */
export function SidebarQuotaTicket() {
  const status = useQuotaStatus();
  if (!status?.gating) return null;
  return (
    <div className="mt-3">
      <QuotaTicket status={status} floating={false} />
    </div>
  );
}
