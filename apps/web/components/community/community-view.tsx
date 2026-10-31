"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowUpRight, RefreshCw, Search, X } from "lucide-react";

import {
  avatarColor,
  drawingNumber,
  formatAge,
  formatCount,
  makerHandle,
  type CommunityProject,
} from "../../lib/community";
import { resolveProjectImageCandidates, type ProjectImageCandidate } from "../../lib/project-images";

export type { CommunityProject };

type CommunityPage = {
  items: CommunityProject[];
  total: number;
  all_total: number;
  categories: { name: string; count: number }[];
  has_more: boolean;
};

type Sort = "trending" | "newest" | "remixed";

const PAGE_SIZE = 9;
const SORTS: [Sort, string][] = [
  ["trending", "Trending"],
  ["newest", "Newest"],
  ["remixed", "Most remixed"],
];
const SORT_LABEL: Record<Sort, string> = { trending: "TRENDING", newest: "NEWEST", remixed: "MOST REMIXED" };
const MAX_CATEGORY_CHIPS = 8;
const TAPE_TILT = ["-3deg", "2deg", "-1.5deg", "3deg"];

type CommunityViewProps = {
  apiUrl: string;
  getHeaders: () => Promise<Record<string, string>>;
  /** Signed in (or local), so saves can be recorded. */
  canSave: boolean;
  /** Copies a design into the viewer's own projects; absent when remixing isn't available. */
  onRemix?: (project: CommunityProject) => Promise<void> | void;
  onOpenProject: (projectId: string) => void;
  onDrawYourOwn: () => void;
  /** Mobile sidebar button. */
  leading?: ReactNode;
};

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Community tab: filter bar, card grid with infinite scroll, and a project drawer. */
export default function CommunityView({ apiUrl, getHeaders, canSave, onRemix, onOpenProject, onDrawYourOwn, leading }: CommunityViewProps) {
  const [queryInput, setQueryInput] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("trending");
  const [category, setCategory] = useState<string | null>(null);
  const [coinOnly, setCoinOnly] = useState(false);
  const [items, setItems] = useState<CommunityProject[]>([]);
  const [total, setTotal] = useState(0);
  const [allTotal, setAllTotal] = useState<number | null>(null);
  const [categories, setCategories] = useState<{ name: string; count: number }[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Record<string, ProjectImageCandidate[]>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [remixing, setRemixing] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const animatedCount = useRef(0);
  const requestId = useRef(0);
  const imageRequests = useRef(new Set<string>());

  const filterKey = `${query}|${sort}|${category || ""}|${coinOnly}`;

  // Debounced search.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(queryInput.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [queryInput]);

  const loadPage = useCallback(async (offset: number) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset), sort });
    if (query) params.set("q", query);
    if (category) params.set("category", category);
    if (coinOnly) params.set("coin", "true");
    try {
      const response = await fetch(`${apiUrl}/community/projects?${params}`, { headers: await getHeaders() });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const page = (await response.json()) as CommunityPage;
      if (id !== requestId.current) return;
      setItems((current) => (offset === 0 ? page.items : [...current, ...page.items]));
      setTotal(page.total);
      setAllTotal(page.all_total);
      setCategories(page.categories || []);
      setHasMore(page.has_more);
    } catch {
      if (id === requestId.current) setError("The community couldn't be loaded. Check your connection and try again.");
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [apiUrl, category, coinOnly, getHeaders, query, sort]);

  // Any filter change starts a fresh sheet and re-staggers the cards.
  useEffect(() => {
    animatedCount.current = 0;
    scrollRef.current?.scrollTo({ top: 0 });
    void loadPage(0);
  }, [filterKey, loadPage]);

  // Infinite scroll: fetch the next nine when the bottom comes within 320px.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || !hasMore || loading) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void loadPage(items.length);
      },
      { root: scrollRef.current, rootMargin: "0px 0px 320px 0px" },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, items.length, loadPage, loading]);

  // Cards rise in: 26px up, tipped back, 55ms apart. Only cards not yet shown animate.
  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-ccard]"));
    const fresh = cards.slice(animatedCount.current);
    animatedCount.current = cards.length;
    if (prefersReducedMotion()) return;
    fresh.forEach((card, index) =>
      card.animate(
        [
          { opacity: 0, transform: "translateY(26px) rotateX(-14deg) scale(.96)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 560, delay: index * 55, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" },
      ),
    );
  }, [items]);

  // Pictures: use what the list carries, otherwise ask for the project's image summary.
  useEffect(() => {
    items.forEach((item) => {
      const id = item.project_id;
      if (images[id] || imageRequests.current.has(id)) return;
      const inline = resolveProjectImageCandidates(item as Record<string, unknown>);
      if (inline.length) {
        setImages((current) => ({ ...current, [id]: inline }));
        return;
      }
      if (!item.has_product_image) return;
      imageRequests.current.add(id);
      void (async () => {
        try {
          const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(id)}/image-summary`, { headers: await getHeaders() });
          const found = response.ok ? resolveProjectImageCandidates(await response.json()) : [];
          setImages((current) => ({ ...current, [id]: found }));
        } catch {
          setImages((current) => ({ ...current, [id]: [] }));
        }
      })();
    });
  }, [apiUrl, getHeaders, images, items]);

  // Deep link: /projects?p={id} opens that project's drawer.
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("p");
    if (requested) setOpenId(requested);
  }, []);

  const openProject = useCallback((projectId: string | null) => {
    setOpenId(projectId);
    const url = new URL(window.location.href);
    if (projectId) url.searchParams.set("p", projectId);
    else url.searchParams.delete("p");
    window.history.replaceState(window.history.state, "", url);
  }, []);

  const [drawerProject, setDrawerProject] = useState<CommunityProject | null>(null);
  useEffect(() => {
    if (!openId) {
      setDrawerProject(null);
      return;
    }
    const listed = items.find((item) => item.project_id === openId);
    if (listed) setDrawerProject(listed);
    else if (!loading) {
      // A deep link to a project that isn't on this sheet opens its full project page instead.
      setOpenId(null);
      onOpenProject(openId);
    }
  }, [items, loading, onOpenProject, openId]);

  const toggleSave = useCallback(async (project: CommunityProject) => {
    if (!canSave) return;
    const nextSaved = !project.saved;
    const patch = (saved: boolean, count: number) => {
      const update = (item: CommunityProject) => (item.project_id === project.project_id ? { ...item, saved, save_count: count } : item);
      setItems((current) => current.map(update));
      setDrawerProject((current) => (current ? update(current) : current));
    };
    const optimistic = Math.max(0, (project.save_count || 0) + (nextSaved ? 1 : -1));
    patch(nextSaved, optimistic);
    try {
      const response = await fetch(`${apiUrl}/projects/${encodeURIComponent(project.project_id)}/save`, {
        method: nextSaved ? "POST" : "DELETE",
        headers: await getHeaders(),
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      patch(Boolean(data.saved), Math.max(0, Number(data.save_count ?? optimistic)));
    } catch {
      patch(Boolean(project.saved), project.save_count || 0);
    }
  }, [apiUrl, canSave, getHeaders]);

  const chips = useMemo(() => categories.slice(0, MAX_CATEGORY_CHIPS), [categories]);
  const resultLine = total
    ? `SHOWING ${items.length} OF ${total} · ${SORT_LABEL[sort]}${category ? ` · ${category.toUpperCase()}` : ""}${coinOnly ? " · HAS A COIN" : ""}`
    : "";
  const clearFilters = () => {
    setQueryInput("");
    setQuery("");
    setCategory(null);
    setCoinOnly(false);
  };

  return (
    <div className="bb-comm" ref={scrollRef}>
      <div className="bb-comm__inner">
        <header className="bb-comm__head">
          {leading}
          <div className="bb-comm__intro">
            <span className="bb-comm__eyebrow">
              Community{allTotal !== null ? ` · ${allTotal.toLocaleString()} open design${allTotal === 1 ? "" : "s"}` : ""}
            </span>
            <h1 className="bb-comm__h1">Community builds</h1>
            <p className="bb-comm__lede">
              See what other makers have drawn. Open any project for its parts and wiring, or remix it into a drawing of your own.
            </p>
          </div>
          <button type="button" className="bb-comm__draw" onClick={onDrawYourOwn}>
            + Draw your own
          </button>
        </header>

        <div className="bb-comm__bar">
          <div className="bb-comm__row">
            <label className="bb-comm__search">
              <Search aria-hidden="true" />
              <input
                value={queryInput}
                onChange={(event) => setQueryInput(event.target.value)}
                placeholder="Search projects, parts or makers"
                aria-label="Search community projects"
              />
              {queryInput && (
                <button type="button" onClick={() => setQueryInput("")} aria-label="Clear search">
                  <X aria-hidden="true" />
                </button>
              )}
            </label>
            <div className="bb-comm__sorts" role="group" aria-label="Sort">
              {SORTS.map(([key, label]) => (
                <button key={key} type="button" className={sort === key ? "is-on" : ""} aria-pressed={sort === key} onClick={() => setSort(key)}>
                  {label}
                </button>
              ))}
            </div>
            <button type="button" className={`bb-comm__coin${coinOnly ? " is-on" : ""}`} aria-pressed={coinOnly} onClick={() => setCoinOnly((on) => !on)}>
              <span aria-hidden="true">$</span>Has a coin
            </button>
          </div>
          {chips.length > 0 && (
            <div className="bb-comm__cats" role="group" aria-label="Category">
              <button type="button" className={category === null ? "is-on" : ""} aria-pressed={category === null} onClick={() => setCategory(null)}>
                ALL<span>{allTotal ?? ""}</span>
              </button>
              {chips.map((chip) => (
                <button
                  key={chip.name}
                  type="button"
                  className={category === chip.name ? "is-on" : ""}
                  aria-pressed={category === chip.name}
                  onClick={() => setCategory(chip.name)}
                >
                  {chip.name.toUpperCase()}
                  <span>{chip.count}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <span className="bb-comm__result" aria-live="polite">{resultLine}</span>

        <div className="bb-comm__grid" ref={gridRef}>
          {items.map((project, index) => (
            <CommunityCard
              key={project.project_id}
              project={project}
              image={images[project.project_id]?.[0] || null}
              tapeTilt={TAPE_TILT[index % TAPE_TILT.length]}
              canSave={canSave}
              onOpen={() => openProject(project.project_id)}
              onToggleSave={() => void toggleSave(project)}
            />
          ))}
          {loading &&
            [0, 1, 2].map((key) => (
              <div key={`skeleton-${key}`} className="bb-comm__skeleton" aria-hidden="true">
                <span />
                <span />
                <span />
                <span />
                <i />
              </div>
            ))}
        </div>
        <div ref={sentinelRef} aria-hidden="true" />

        {error && (
          <div className="bb-comm__empty">
            <span className="bb-comm__hand">couldn&apos;t fetch the sheet</span>
            <span>{error}</span>
            <button type="button" onClick={() => void loadPage(items.length)}>
              Try again
            </button>
          </div>
        )}
        {!loading && !error && total === 0 && (
          <div className="bb-comm__empty">
            <span className="bb-comm__hand">nothing on this sheet yet</span>
            <span>No projects match. Try another category, or draw it yourself.</span>
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        )}
        {!loading && !error && total > 0 && !hasMore && (
          <div className="bb-comm__end">
            <span />
            END OF SHEET · {total} PROJECT{total === 1 ? "" : "S"}
            <span />
          </div>
        )}
      </div>

      {drawerProject && (
        <ProjectDrawer
          project={drawerProject}
          images={images[drawerProject.project_id] || []}
          canSave={canSave}
          remixing={remixing}
          onClose={() => openProject(null)}
          onToggleSave={() => void toggleSave(drawerProject)}
          onOpen={() => onOpenProject(drawerProject.project_id)}
          onRemix={
            onRemix
              ? async () => {
                  setRemixing(true);
                  try {
                    await onRemix(drawerProject);
                  } finally {
                    setRemixing(false);
                  }
                }
              : undefined
          }
        />
      )}
    </div>
  );
}

function CommunityCard({
  project,
  image,
  tapeTilt,
  canSave,
  onOpen,
  onToggleSave,
}: {
  project: CommunityProject;
  image: ProjectImageCandidate | null;
  tapeTilt: string;
  canSave: boolean;
  onOpen: () => void;
  onToggleSave: () => void;
}) {
  const handle = makerHandle(project);
  const dwg = drawingNumber(project.project_id) || "BB";
  const [imageFailed, setImageFailed] = useState(false);
  return (
    <div
      data-ccard
      className="bb-ccard"
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen();
        }
      }}
      aria-label={`Open ${project.title}`}
    >
      <span className="bb-ctape" style={{ transform: `rotate(${tapeTilt})` }} aria-hidden="true" />
      <div className="bb-ccard__render">
        {image && !imageFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={image.src} alt="" loading="lazy" onError={() => setImageFailed(true)} />
        ) : (
          <span className="bb-ccard__dwg">DWG {dwg} · RENDER</span>
        )}
        {project.category && <span className="bb-ccard__cat">{project.category}</span>}
        {project.coin && <span className="bb-ccard__coin">${project.coin.symbol}</span>}
        <button
          type="button"
          className={`bb-ccard__star${project.saved ? " is-on" : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleSave();
          }}
          disabled={!canSave}
          aria-pressed={Boolean(project.saved)}
          aria-label={project.saved ? "Remove from saved" : "Save project"}
          title={canSave ? (project.saved ? "Saved" : "Save") : "Connect a wallet to save projects"}
        >
          {project.saved ? "★" : "☆"} {formatCount(project.save_count)}
        </button>
      </div>
      <div className="bb-ccard__body">
        <span className="bb-ccard__title">{project.title}</span>
        <span className="bb-ccard__desc">{project.description || project.prompt}</span>
        <span className="bb-ccard__maker">
          <span className="bb-avatar" style={{ background: avatarColor(handle) }} aria-hidden="true">
            {handle.slice(0, 2).toUpperCase()}
          </span>
          @{handle}
          {formatAge(project.updated_at || project.created_at) && <span className="bb-ccard__age">· {formatAge(project.updated_at || project.created_at)}</span>}
        </span>
        <span className="bb-ccard__stats">
          <span>{project.parts_count || 0} PARTS</span>
          <span>{project.estimated_cost_usd ? `$${project.estimated_cost_usd.toFixed(2)}` : "—"}</span>
          <span className="is-amber">↻ {formatCount(project.remix_count)}</span>
        </span>
      </div>
    </div>
  );
}

function ProjectDrawer({
  project,
  images,
  canSave,
  remixing,
  onClose,
  onToggleSave,
  onOpen,
  onRemix,
}: {
  project: CommunityProject;
  images: ProjectImageCandidate[];
  canSave: boolean;
  remixing: boolean;
  onClose: () => void;
  onToggleSave: () => void;
  onOpen: () => void;
  onRemix?: () => void;
}) {
  const drawerRef = useRef<HTMLElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);
  const [imageIndex, setImageIndex] = useState(0);
  const handle = makerHandle(project);
  const dwg = drawingNumber(project.project_id) || "BB";
  const age = formatAge(project.updated_at || project.created_at);
  const image = images[imageIndex] || images[0] || null;

  useEffect(() => {
    setImageIndex(0);
  }, [project.project_id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    drawerRef.current?.focus();
    if (!prefersReducedMotion()) {
      drawerRef.current?.animate([{ transform: "translateX(100%)" }, { transform: "none" }], {
        duration: 480,
        easing: "cubic-bezier(.2,.8,.2,1)",
      });
      backdropRef.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 320 });
      drawerRef.current?.querySelectorAll<HTMLElement>("[data-stagger]").forEach((element, index) =>
        element.animate([{ opacity: 0, transform: "translateY(14px)" }, { opacity: 1, transform: "none" }], {
          duration: 420,
          delay: 160 + index * 55,
          easing: "cubic-bezier(.2,.8,.2,1)",
          fill: "backwards",
        }),
      );
    }
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const stats: [string, string][] = [
    ["Parts", String(project.parts_count || 0)],
    ["Unit cost", project.estimated_cost_usd ? `$${project.estimated_cost_usd.toFixed(2)}` : "—"],
    ["Remixes", formatCount(project.remix_count)],
  ];
  const sheets = ["Parts list", "Wiring diagram", "3D model", "Build guide", ...(images.length ? ["Renders"] : [])];

  return (
    <>
      <div ref={backdropRef} className="bb-drawer__backdrop" onClick={onClose} aria-hidden="true" />
      <aside ref={drawerRef} className="bb-drawer" role="dialog" aria-modal="true" aria-label={project.title} tabIndex={-1}>
        <div className="bb-drawer__top">
          <span>Community · DWG {dwg}</span>
          <button type="button" onClick={onClose} aria-label="Close project">
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="bb-drawer__body">
          <div className="bb-drawer__render" data-stagger>
            <span className="bb-ctape is-a" aria-hidden="true" />
            <span className="bb-ctape is-b" aria-hidden="true" />
            {image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={image.src} alt={image.label} />
            ) : (
              <span className="bb-ccard__dwg">PRODUCT RENDER · {dwg}</span>
            )}
          </div>
          {images.length > 1 && (
            <div className="bb-drawer__thumbs" data-stagger>
              {images.slice(0, 4).map((candidate, index) => (
                <button
                  key={candidate.src}
                  type="button"
                  className={index === imageIndex ? "is-on" : ""}
                  onClick={() => setImageIndex(index)}
                  aria-label={`Show ${candidate.label}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={candidate.src} alt="" />
                </button>
              ))}
            </div>
          )}
          <div className="bb-drawer__chips" data-stagger>
            {project.category && <span>{project.category}</span>}
            {project.operating_voltage ? <span className="is-green">{`${Number(project.operating_voltage)} V LOGIC`}</span> : null}
            {project.coin && <span className="is-amber">${project.coin.symbol} · LIVE ON PUMP.FUN</span>}
          </div>
          <h2 className="bb-drawer__title" data-stagger>
            {project.title}
          </h2>
          <span className="bb-drawer__maker" data-stagger>
            <span className="bb-avatar is-lg" style={{ background: avatarColor(handle) }} aria-hidden="true">
              {handle.slice(0, 2).toUpperCase()}
            </span>
            @{handle}
            {age && <span className="bb-ccard__age">· updated {age} ago</span>}
          </span>
          {(project.description || project.prompt) && (
            <p className="bb-drawer__desc" data-stagger>
              {project.description || project.prompt}
            </p>
          )}
          <div className="bb-drawer__stats" data-stagger>
            {stats.map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <b>{value}</b>
              </div>
            ))}
          </div>
          <div className="bb-drawer__sheets" data-stagger>
            <span>Included sheets</span>
            <div>
              {sheets.map((sheet) => (
                <span key={sheet}>{sheet}</span>
              ))}
            </div>
          </div>
        </div>
        <div className="bb-drawer__actions">
          {onRemix && (
            <button type="button" className="bb-drawer__remix" onClick={onRemix} disabled={remixing}>
              {remixing ? <RefreshCw className="animate-spin" aria-hidden="true" /> : "↻"} Remix this design
            </button>
          )}
          <button type="button" className="bb-drawer__btn" onClick={onOpen}>
            Open project <ArrowUpRight aria-hidden="true" />
          </button>
          <button
            type="button"
            className={`bb-drawer__btn${project.saved ? " is-on" : ""}`}
            onClick={onToggleSave}
            disabled={!canSave}
            aria-pressed={Boolean(project.saved)}
            title={canSave ? undefined : "Connect a wallet to save projects"}
          >
            {project.saved ? "★" : "☆"} {formatCount(project.save_count)}
          </button>
          {project.coin && (
            <a className="bb-drawer__btn" href={project.coin.product_page_path}>
              Pitch deck <ArrowUpRight aria-hidden="true" />
            </a>
          )}
        </div>
      </aside>
    </>
  );
}
