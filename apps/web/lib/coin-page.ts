import { headers } from "next/headers";

import { webConfig } from "./config";
import type { LaunchedCoin } from "./launchpad";

export type PitchSpec = { label: string; value: string };
export type PitchImage = { url: string; label: string };
export type PitchCopy = {
  tagline?: string;
  pitch?: string;
  highlights?: string[];
  use_cases?: { title: string; detail: string }[];
  audience?: string;
  materials?: string[];
  problem?: string;
  how_it_works?: string[];
  target_market?: string;
  production_estimates?: { volume: string; unit_cost_usd: number; notes?: string }[];
  tooling_cost_usd?: number | null;
  manufacturing_notes?: string[];
};

export type CoinPitch = {
  project_id: string;
  title: string;
  description: string;
  category?: string;
  estimated_cost_usd?: number | null;
  features?: string[];
  specs?: PitchSpec[];
  parts?: { name: string; category: string; count: number }[];
  fabrication?: string[];
  subsystems?: { name: string; purpose: string }[];
  product_model?: unknown;
  mechanical?: unknown;
  components?: unknown[];
  images?: PitchImage[];
  copy?: PitchCopy | null;
  generated_at?: string;
};

export type CoinPageData = {
  launch: LaunchedCoin & { product_page_path: string };
  pitch: CoinPitch | null;
};

const MINT_RE = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

/** Absolute API base for server-side fetches; the API shares the site's origin in production. */
async function serverApiBase(): Promise<string> {
  const configured = (webConfig.apiBaseUrl || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\//.test(configured)) return configured.endsWith("/api") ? configured : `${configured}/api`;
  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") || requestHeaders.get("host") || "localhost:3000";
  const protocol = requestHeaders.get("x-forwarded-proto") || (host.startsWith("localhost") ? "http" : "https");
  return `${protocol}://${host}/api`;
}

export async function fetchCoinPage(mint: string): Promise<CoinPageData | null> {
  if (!MINT_RE.test(mint)) return null;
  try {
    const response = await fetch(`${await serverApiBase()}/launchpad/coins/${encodeURIComponent(mint)}`, {
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as CoinPageData;
  } catch {
    return null;
  }
}
