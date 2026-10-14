"use client";

import React, { useCallback, useEffect, useState } from "react";
import { webConfig } from "../lib/config";
import { useFormaAuth } from "../lib/forma-auth";

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

function tierLabel(status: QuotaStatus): string {
  if (status.tier === "free") return "Free taster";
  const level = status.tier?.replace("tier-", "") || "";
  return `Holder tier ${level}`;
}

/** Small fixed badge: "Holder tier 2 · 14 of 20 designs left today". */
export function BluebuildQuotaBadge() {
  const { isSignedIn, getToken, openSignIn } = useFormaAuth();
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
      // The badge is informational; stay quiet if the API is unreachable.
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

  if (!status?.gating) return null;

  const shell: React.CSSProperties = {
    position: "fixed",
    right: 16,
    bottom: 16,
    zIndex: 60,
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "10px 14px",
    background: "#0E2A57",
    color: "#F4F7FB",
    border: "1px solid #3A70C4",
    borderRadius: 4,
    fontFamily: "'IBM Plex Mono', Consolas, monospace",
    fontSize: 12,
    letterSpacing: "0.06em",
    boxShadow: "0 10px 30px -12px rgba(0,0,0,0.6)",
    maxWidth: "calc(100vw - 32px)",
  };

  if (!status.signed_in) {
    return (
      <div style={shell}>
        <span>Connect a Solana wallet for {status.free_per_day ?? 5} free designs a day</span>
        <button
          type="button"
          onClick={() => openSignIn({ redirectUrl: typeof window !== "undefined" ? window.location.href : "/" })}
          style={{
            minHeight: 36,
            padding: "0 12px",
            background: "#FFB547",
            color: "#1A1300",
            border: "none",
            borderRadius: 4,
            fontFamily: "inherit",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Connect wallet
        </button>
      </div>
    );
  }

  if (status.owner) {
    return (
      <div style={shell} role="status">
        <span style={{ color: "#FFB547" }}>Owner account</span>
        <span aria-hidden="true" style={{ opacity: 0.4 }}>|</span>
        <span>no daily limit · other people see their tier here</span>
      </div>
    );
  }

  if (status.error) {
    return <div style={shell}>Design allowance unavailable right now</div>;
  }

  const remaining = status.remaining ?? 0;
  const limit = status.limit ?? 0;
  const empty = remaining <= 0;

  return (
    <div style={shell} role="status" aria-live="polite">
      <span style={{ color: status.tier === "free" ? "#A9BEDD" : "#FFB547" }}>{tierLabel(status)}</span>
      <span aria-hidden="true" style={{ opacity: 0.4 }}>|</span>
      <span style={{ color: empty ? "#FFB547" : "#F4F7FB" }}>
        {status.free_pool_empty && status.tier === "free"
          ? "Free designs used up today"
          : `${remaining} of ${limit} designs left today`}
      </span>
      {status.wallet ? (
        <>
          <span aria-hidden="true" style={{ opacity: 0.4 }}>|</span>
          <span style={{ color: "#A9BEDD" }}>
            {shortWallet(status.wallet)}
            {status.token_live ? ` · ${formatTokens(status.holding)} $BLUEBUILD` : ""}
          </span>
        </>
      ) : null}
    </div>
  );
}
