/**
 * Launchpad helpers: talk to the backend launch endpoints and prepare form defaults.
 * Transaction building lives in components/launch-coin-dialog.tsx so the Solana
 * libraries only load when someone opens the launch form.
 */

import { webConfig } from "./config";
import type { LaunchForm } from "./launchpad-form";

export { defaultLaunchForm, suggestTicker, type LaunchForm } from "./launchpad-form";

export type LaunchedCoin = {
  id: string;
  project_id: string;
  mint: string;
  name: string;
  symbol: string;
  description: string;
  image_url: string;
  metadata_uri: string;
  website: string | null;
  twitter: string | null;
  telegram: string | null;
  creator_wallet: string;
  status: string;
  signature: string | null;
  launched_at: string | null;
  pump_url: string;
  product_page_path?: string;
};

export type LaunchpadProjectStatus = {
  enabled: boolean;
  launch: LaunchedCoin | null;
  can_launch: boolean;
  max_initial_buy_sol: number;
};

export type PreparedLaunch = {
  launch_id: string;
  metadata_uri: string;
  name: string;
  symbol: string;
  initial_buy_sol: number;
};

export class LaunchpadError extends Error {}

/** localStorage key for a launch that was sent but not yet recorded by the backend. */
export const PENDING_LAUNCH_KEY = "bluebuild:pending-launch";

export function launchpadApiUrl(): string {
  const trimmed = (webConfig.apiBaseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "/api";
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

/** Absolute URL for the JSON-RPC relay; web3.js needs an http(s) endpoint. */
export function launchpadRpcUrl(): string {
  const base = launchpadApiUrl();
  const absolute = /^https?:\/\//.test(base) ? base : `${window.location.origin}${base.startsWith("/") ? "" : "/"}${base}`;
  return `${absolute}/launchpad/rpc`;
}

/**
 * fetch for web3.js Connection pointed at the relay: adds the sign-in token and drops
 * web3.js' custom "solana-client" header so cross-origin API setups need no extra CORS rule.
 */
export function launchpadRpcFetch(getToken: () => Promise<string | null>) {
  return async (input: RequestInfo | URL, init?: RequestInit) => {
    const headers = new Headers(init?.headers);
    headers.delete("solana-client");
    const token = await getToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(input, { ...init, headers });
  };
}

async function request<T>(path: string, init: RequestInit, token: string | null): Promise<T> {
  const response = await fetch(`${launchpadApiUrl()}${path}`, {
    ...init,
    cache: "no-store",
    headers: {
      ...(init.body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = body?.detail;
    const message = typeof detail === "string" ? detail : detail?.message;
    throw new LaunchpadError(message || "Something went wrong. Please try again.");
  }
  return body as T;
}

export function fetchLaunchpadStatus(projectId: string, token: string | null) {
  return request<LaunchpadProjectStatus>(`/launchpad/projects/${encodeURIComponent(projectId)}`, { method: "GET" }, token);
}

export function prepareLaunch(
  projectId: string,
  form: LaunchForm,
  extra: { mint: string; creatorWallet: string; imageData: string },
  token: string | null,
) {
  return request<PreparedLaunch>(
    `/launchpad/projects/${encodeURIComponent(projectId)}/prepare`,
    {
      method: "POST",
      body: JSON.stringify({
        name: form.name,
        symbol: form.symbol,
        description: form.description,
        twitter: form.twitter,
        telegram: form.telegram,
        initial_buy_sol: form.initialBuySol || "0",
        mint: extra.mint,
        creator_wallet: extra.creatorWallet,
        image_data: extra.imageData,
      }),
    },
    token,
  );
}

export function confirmLaunch(launchId: string, signature: string, token: string | null) {
  return request<{ status: "pending" | "launched"; launch?: LaunchedCoin }>(
    `/launchpad/launches/${encodeURIComponent(launchId)}/confirm`,
    { method: "POST", body: JSON.stringify({ signature }) },
    token,
  );
}

/** Square-crops and shrinks an image to a small JPEG data URL suitable for a coin logo. */
export async function imageToLogoDataUrl(src: string, size = 512): Promise<string> {
  const image = new Image();
  image.crossOrigin = "anonymous";
  image.decoding = "async";
  image.src = src;
  await image.decode();
  const side = Math.min(image.naturalWidth, image.naturalHeight);
  if (!side) throw new LaunchpadError("That image couldn't be used as a logo.");
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new LaunchpadError("That image couldn't be used as a logo.");
  context.drawImage(
    image,
    (image.naturalWidth - side) / 2,
    (image.naturalHeight - side) / 2,
    side,
    side,
    0,
    0,
    size,
    size,
  );
  try {
    return canvas.toDataURL("image/jpeg", 0.88);
  } catch {
    throw new LaunchpadError("That image couldn't be used as a logo. Try uploading one instead.");
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new LaunchpadError("That file couldn't be read."));
    reader.readAsDataURL(file);
  });
}
