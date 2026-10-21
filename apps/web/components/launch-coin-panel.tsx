"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { ExternalLink } from "lucide-react";

import { useFormaAuth } from "../lib/forma-auth";
import {
  confirmLaunch,
  defaultLaunchForm,
  fetchLaunchpadStatus,
  PENDING_LAUNCH_KEY,
  type LaunchedCoin,
  type LaunchpadProjectStatus,
} from "../lib/launchpad";
import { PitchDeckPreview, type LaunchImageOption, type LaunchPreview } from "./pitch-deck-preview";

// The Solana and pump.fun libraries only load when the form is actually shown.
const LaunchCoinForm = dynamic(() => import("./launch-coin-form"), { ssr: false });

type LaunchCoinPanelProps = {
  projectId: string;
  title: string;
  description: string;
  images: LaunchImageOption[];
  preview: LaunchPreview;
};

function shortLink(url: string) {
  return url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, "");
}

/** Launch coin tab: the inline launch form, or the coin once it exists. */
export function LaunchCoinPanel({ projectId, title, description, images, preview }: LaunchCoinPanelProps) {
  const { getToken, isLoaded } = useFormaAuth();
  const [status, setStatus] = useState<LaunchpadProjectStatus | null>(null);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setStatus(await fetchLaunchpadStatus(projectId, await getToken()));
      setFailed(false);
    } catch {
      setStatus(null);
      setFailed(true);
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

  let body;
  if (!status) {
    body = <p className="bb-note">{failed ? "The launchpad couldn't be reached. Try again in a moment." : "Checking the launchpad…"}</p>;
  } else if (status.launch) {
    body = <LaunchedCoinView coin={status.launch} preview={preview} />;
  } else if (!status.enabled) {
    body = (
      <LaunchUnavailable
        title={title}
        description={description}
        preview={preview}
        message="The launchpad isn't switched on yet. When it is, you'll be able to launch a coin for this design from here."
      />
    );
  } else if (!status.can_launch) {
    body = (
      <LaunchUnavailable
        title={title}
        description={description}
        preview={preview}
        message="Only the person who designed this project can launch its coin, signed in with their own wallet."
      />
    );
  } else {
    body = (
      <LaunchCoinForm
        projectId={projectId}
        initialForm={defaultLaunchForm(title, description)}
        images={images}
        maxInitialBuySol={status.max_initial_buy_sol}
        getToken={getToken}
        preview={preview}
        onLaunched={(launched) => setStatus((current) => current && { ...current, launch: launched, can_launch: false })}
      />
    );
  }

  return (
    <div className="bb-sheet h-full min-w-0 overflow-y-auto overflow-x-hidden">
      <div className="bb-sheet__body is-tight">{body}</div>
    </div>
  );
}

function LaunchUnavailable({ title, description, preview, message }: { title: string; description: string; preview: LaunchPreview; message: string }) {
  return (
    <div className="bb-launch">
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <span className="bb-eyebrow is-amber">Pitch deck &amp; coin · your wallet</span>
          <span className="bb-sheet__h">Launch a coin for it</span>
        </div>
        <p className="m-0 text-[15px] leading-relaxed text-[#d7e2f3]">{message}</p>
        <p className="bb-launch__legal">
          You create the coin on pump.fun from your own wallet. Bluebuild never holds your keys, takes no fee, doesn&apos;t endorse any coin and
          can&apos;t undo transactions. Crypto is risky.
        </p>
      </div>
      <PitchDeckPreview name={title} description={description} symbol="" logo={null} preview={preview} launched={false} />
    </div>
  );
}

function LaunchedCoinView({ coin, preview }: { coin: LaunchedCoin; preview: LaunchPreview }) {
  const links = [
    coin.website && { label: shortLink(coin.website), href: coin.website },
    coin.twitter && { label: "X", href: coin.twitter },
    coin.telegram && { label: "Telegram", href: coin.telegram },
  ].filter(Boolean) as { label: string; href: string }[];

  return (
    <div className="bb-launch">
      <div className="flex min-w-0 flex-col gap-3.5">
        <div className="flex flex-col gap-1">
          <span className="bb-eyebrow is-amber">Community coin · launched by the designer</span>
          <span className="bb-sheet__h">
            {coin.name} <span className="text-[#a9bedd]">${coin.symbol}</span>
          </span>
        </div>
        <p className="m-0 break-all font-[family-name:var(--craft-mono)] text-[11px] text-[#7f9ccc]">{coin.mint}</p>
        {links.length > 0 && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {links.map((link) => (
              <a key={link.href} href={link.href} target="_blank" rel="noreferrer nofollow" className="text-[#a9bedd] underline underline-offset-2 hover:text-[#ffb547]">
                {link.label}
              </a>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <a href={coin.pump_url} target="_blank" rel="noreferrer" className="bb-launch-btn">
            View on pump.fun <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
          </a>
          {coin.product_page_path && (
            <a href={coin.product_page_path} className="bb-panel-link">
              Open pitch deck
            </a>
          )}
        </div>
        <p className="bb-launch__legal">Launched by the designer from their own wallet. Not endorsed by Bluebuild.</p>
      </div>
      <PitchDeckPreview name={coin.name} description={coin.description} symbol={coin.symbol} logo={coin.image_url} preview={preview} launched />
    </div>
  );
}
