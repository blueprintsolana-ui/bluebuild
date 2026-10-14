"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink, Rocket } from "lucide-react";

import { useFormaAuth } from "../lib/forma-auth";
import {
  confirmLaunch,
  defaultLaunchForm,
  fetchLaunchpadStatus,
  PENDING_LAUNCH_KEY,
  type LaunchedCoin,
  type LaunchpadProjectStatus,
} from "../lib/launchpad";
import type { LaunchImageOption } from "./launch-coin-dialog";

const LaunchCoinDialog = dynamic(() => import("./launch-coin-dialog"), { ssr: false });

type DesignCoinCardProps = {
  projectId: string;
  title: string;
  description: string;
  images: LaunchImageOption[];
};

function shortLink(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

export function DesignCoinCard({ projectId, title, description, images }: DesignCoinCardProps) {
  const { getToken, isLoaded } = useFormaAuth();
  const [status, setStatus] = useState<LaunchpadProjectStatus | null>(null);
  const [open, setOpen] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchLaunchpadStatus(projectId, await getToken()));
    } catch {
      setStatus(null);
    }
  }, [getToken, projectId]);

  useEffect(() => {
    if (!isLoaded) return;
    let cancelled = false;
    (async () => {
      // Finish recording a launch that confirmed after the page was closed.
      try {
        const pending = JSON.parse(window.localStorage.getItem(PENDING_LAUNCH_KEY) || "null");
        if (pending?.projectId === projectId && pending.launchId && pending.signature) {
          const result = await confirmLaunch(pending.launchId, pending.signature, await getToken());
          if (result.status === "launched") window.localStorage.removeItem(PENDING_LAUNCH_KEY);
        }
      } catch {
        // A failed resume leaves the pending record for the next visit.
      }
      if (!cancelled) await refresh();
    })();
    return () => {
      cancelled = true;
    };
  }, [getToken, isLoaded, projectId, refresh]);

  if (!status?.enabled) return null;
  const coin = status.launch;

  if (coin) {
    return <LaunchedCoinCard coin={coin} />;
  }
  if (!status.can_launch) return null;

  const designUrl = typeof window !== "undefined" ? `${window.location.origin}/project/${encodeURIComponent(projectId)}` : "";
  return (
    <section className="mt-5 flex flex-col gap-3 rounded-xl border border-[rgb(255_181_71/0.35)] bg-[rgb(255_181_71/0.06)] p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-sm font-semibold text-[var(--forma-text-strong)]">Launch a coin for this idea</h2>
        <p className="mt-1 text-xs leading-5 text-[var(--forma-text-secondary)]">
          Create a pump.fun coin for your design from your own wallet, with optional website, X and Telegram links. Bluebuild takes no fee.
        </p>
      </div>
      <button type="button" onClick={() => setOpen(true)} className="connect-wallet-button shrink-0 justify-center">
        <Rocket className="h-4 w-4" aria-hidden="true" />
        Launch a coin
      </button>
      {open && (
        <LaunchCoinDialog
          projectId={projectId}
          initialForm={defaultLaunchForm(title, description, designUrl)}
          images={images}
          maxInitialBuySol={status.max_initial_buy_sol}
          getToken={getToken}
          onClose={() => setOpen(false)}
          onLaunched={(launched) => setStatus((current) => current && { ...current, launch: launched, can_launch: false })}
        />
      )}
    </section>
  );
}

function LaunchedCoinCard({ coin }: { coin: LaunchedCoin }) {
  const links = [
    coin.website && { label: shortLink(coin.website), href: coin.website },
    coin.twitter && { label: "X", href: coin.twitter },
    coin.telegram && { label: "Telegram", href: coin.telegram },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <section className="mt-5 flex flex-col gap-3 rounded-xl border border-[var(--forma-border)] bg-[var(--forma-surface)] p-4 sm:flex-row sm:items-center">
      {/* eslint-disable-next-line @next/next/no-img-element -- coin logo from public storage */}
      <img src={coin.image_url} alt="" className="h-14 w-14 shrink-0 rounded-xl border border-[var(--forma-border)] object-cover" />
      <div className="min-w-0 flex-1">
        <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--forma-text-muted)]">Community coin</div>
        <h2 className="mt-0.5 truncate text-sm font-semibold text-[var(--forma-text-strong)]">
          {coin.name} <span className="text-[var(--forma-text-muted)]">${coin.symbol}</span>
        </h2>
        {links.length > 0 && (
          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs">
            {links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer nofollow" className="truncate text-[var(--forma-text-secondary)] underline-offset-2 hover:underline">
                {link.label}
              </a>
            ))}
          </div>
        )}
        <p className="mt-1 text-[10px] text-[var(--forma-text-muted)]">Launched by the designer. Not endorsed by Bluebuild.</p>
      </div>
      <a href={coin.pump_url} target="_blank" rel="noreferrer" className="connect-wallet-button shrink-0 justify-center">
        View on pump.fun
        <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
      </a>
    </section>
  );
}
