/** Shared, dependency-free helpers for community projects (the app's Community tab and the landing turntable). */

/** One public project as /community/projects returns it. */
export type CommunityProject = {
  project_id: string;
  title: string;
  description?: string;
  prompt?: string;
  category?: string | null;
  creator_display?: string;
  creator_username?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  parts_count?: number;
  estimated_cost_usd?: number | null;
  operating_voltage?: number | null;
  save_count?: number;
  remix_count?: number;
  saved?: boolean;
  has_product_image?: boolean;
  coin?: { name: string; symbol: string; mint: string; pump_url: string; product_page_path: string } | null;
  [key: string]: unknown;
};

const AVATAR_COLORS = ["#ffb547", "#78d6a0", "#a9bedd", "#e8dcc3", "#7fb2ff"];

/** "BB-" plus the first four characters of the project id, the number the project title block shows. */
export function drawingNumber(projectId: string | null | undefined) {
  return projectId ? `BB-${projectId.replace(/[^a-z0-9]/gi, "").slice(0, 4).toUpperCase()}` : null;
}

export function formatAge(value: string | null | undefined): string {
  const time = value ? Date.parse(value) : NaN;
  if (!Number.isFinite(time)) return "";
  const hours = Math.max(0, (Date.now() - time) / 3_600_000);
  if (hours < 1) return "now";
  if (hours < 24) return `${Math.floor(hours)}h`;
  const days = hours / 24;
  if (days < 7) return `${Math.floor(days)}d`;
  if (days < 30) return `${Math.floor(days / 7)}w`;
  if (days < 365) return `${Math.floor(days / 30)}mo`;
  return `${Math.floor(days / 365)}y`;
}

export function formatCount(value: number | undefined): string {
  const count = Math.max(0, Number(value) || 0);
  if (count >= 10_000) return `${Math.round(count / 1000)}K`;
  if (count >= 1000) return `${(count / 1000).toFixed(1).replace(/\.0$/, "")}K`;
  return String(count);
}

export function makerHandle(project: CommunityProject): string {
  const name = String(project.creator_username || project.creator_display || "maker").trim();
  return name.replace(/^@/, "").replace(/\s+/g, "_").slice(0, 24) || "maker";
}

export function avatarColor(handle: string): string {
  let hash = 0;
  for (const char of handle) hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}
