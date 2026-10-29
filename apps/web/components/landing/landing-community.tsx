"use client";

import { useEffect, useRef, useState } from "react";

import { webConfig } from "../../lib/config";
import { resolveProjectImageCandidates } from "../../lib/project-images";
import { avatarColor, drawingNumber, formatCount, makerHandle, type CommunityProject } from "../../lib/community";
import { clamp, lerp, ss, stickyProgress, useLandingFrame } from "./landing-motion";

const CARD_WIDTH = 270;
const MAX_CARDS = 10;
const MIN_CARDS = 3;

function apiBase() {
  const trimmed = (webConfig.apiBaseUrl || "").trim().replace(/\/+$/, "");
  if (!trimmed) return "/api";
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

type TurntableCard = CommunityProject & { image: string | null };

function statsLine(project: CommunityProject) {
  const cost = project.estimated_cost_usd ? ` · $${project.estimated_cost_usd.toFixed(2)} / UNIT` : "";
  return `${project.parts_count || 0} PARTS${cost} · ↻ ${formatCount(project.remix_count)} REMIXES`;
}

function byLine(project: CommunityProject) {
  return `by @${makerHandle(project)}${project.category ? ` · ${project.category}` : ""}${project.coin ? ` · $${project.coin.symbol}` : ""}`;
}

/**
 * Community turntable: the community's trending projects on a 3D cylinder that turns with the
 * scroll (420vh sticky). Hidden until there are at least three public projects to show.
 */
export function CommunityTurntable() {
  const [cards, setCards] = useState<TurntableCard[]>([]);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const response = await fetch(`${apiBase()}/community/projects?limit=${MAX_CARDS}&sort=trending`);
        if (!response.ok) return;
        const page = (await response.json()) as { items: CommunityProject[]; all_total: number };
        const withImages = await Promise.all(
          page.items.map(async (item) => {
            let image = resolveProjectImageCandidates(item as Record<string, unknown>)[0]?.src || null;
            if (!image && item.has_product_image) {
              try {
                const summary = await fetch(`${apiBase()}/projects/${encodeURIComponent(item.project_id)}/image-summary`);
                if (summary.ok) image = resolveProjectImageCandidates(await summary.json())[0]?.src || null;
              } catch {
                image = null;
              }
            }
            return { ...item, image };
          }),
        );
        if (!cancelled) {
          setCards(withImages);
          setTotal(page.all_total || withImages.length);
        }
      } catch {
        // No community section without data; the rest of the page is unaffected.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (cards.length < MIN_CARDS) return null;
  return <Turntable cards={cards} total={total} />;
}

function Turntable({ cards, total }: { cards: TurntableCard[]; total: number }) {
  const sectionRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const scaleRef = useRef<HTMLDivElement>(null);
  const ringRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLAnchorElement | null)[]>([]);
  const dotRefs = useRef<(HTMLSpanElement | null)[]>([]);
  const numRef = useRef<HTMLSpanElement>(null);
  const titleRef = useRef<HTMLSpanElement>(null);
  const byRef = useRef<HTMLSpanElement>(null);
  const statsRef = useRef<HTMLSpanElement>(null);
  const state = useRef<{ q?: number; front?: number }>({});
  const count = cards.length;
  const step = 360 / count;
  const radius = Math.round((CARD_WIDTH / (2 * Math.tan(Math.PI / count))) * 1.14);

  // Fit the stage: scale(min(1, w/1020, h/600)).
  useEffect(() => {
    const stage = stageRef.current;
    const scaler = scaleRef.current;
    if (!stage || !scaler) return undefined;
    const fit = () => {
      const s = Math.max(0.36, Math.min(1, stage.clientWidth / 1020, stage.clientHeight / 600));
      scaler.style.transform = `scale(${s.toFixed(3)})`;
    };
    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  useLandingFrame(({ now, vw, vh, pointer: m, reduced }) => {
    const section = sectionRef.current;
    const ring = ringRef.current;
    if (!section || !ring) return;
    const { rect, p } = stickyProgress(section, vh);
    if (rect.bottom <= 0 || rect.top >= vh) return;
    const st = state.current;
    st.q = st.q === undefined ? p : lerp(st.q, p, 0.1);
    const tiltY = (m.sx / vw - 0.5) * 12;
    const tiltX = -9 + (m.sy / vh - 0.5) * -8;
    const angle = -ss(0.05, 0.95, st.q) * step * (count - 1) + (reduced ? 0 : Math.sin(now / 2600) * 1.2);
    ring.style.transform = `translateZ(${-radius}px) rotateX(${tiltX.toFixed(2)}deg) rotateY(${(angle + tiltY).toFixed(2)}deg)`;
    let front = 0;
    let best = -2;
    cardRefs.current.forEach((card, i) => {
      if (!card) return;
      const rel = ((((i * step + angle + tiltY) % 360) + 540) % 360) - 180;
      const facing = Math.cos((rel * Math.PI) / 180);
      if (facing > best) {
        best = facing;
        front = i;
      }
      const lift = Math.max(0, (facing - 0.86) / 0.14);
      card.style.transform = `rotateY(${i * step}deg) translateZ(${radius}px) translateY(${(-lift * 22).toFixed(1)}px) scale(${(1 + lift * 0.1).toFixed(3)})`;
      card.style.opacity = (0.08 + 0.92 * clamp((facing + 0.2) / 1.2)).toFixed(3);
      card.style.filter = facing < 0.75 ? `brightness(${Math.max(0.35, 0.45 + facing * 0.55).toFixed(2)})` : "none";
      card.style.boxShadow =
        lift > 0.02
          ? `0 0 0 ${(lift * 2).toFixed(1)}px #ffb547,0 0 ${(lift * 50).toFixed(0)}px -6px rgba(255,181,71,.6),0 40px 60px -26px rgba(0,0,0,.8)`
          : "0 24px 40px -26px rgba(0,0,0,.7)";
      card.style.pointerEvents = facing > 0.7 ? "auto" : "none";
      card.tabIndex = facing > 0.7 ? 0 : -1;
    });
    if (front !== st.front) {
      const first = st.front === undefined;
      st.front = front;
      const project = cards[front];
      if (numRef.current) numRef.current.textContent = `${String(front + 1).padStart(2, "0")} / ${String(count).padStart(2, "0")}`;
      if (titleRef.current) titleRef.current.textContent = project.title;
      if (byRef.current) byRef.current.textContent = byLine(project);
      if (statsRef.current) statsRef.current.textContent = statsLine(project);
      dotRefs.current.forEach((dot, i) => dot?.classList.toggle("is-on", i === front));
      if (!first && !reduced) {
        [titleRef, byRef, statsRef].forEach((ref, j) =>
          ref.current?.animate(
            [
              { opacity: 0, transform: "translateY(10px)", filter: "blur(3px)" },
              { opacity: 1, transform: "none", filter: "blur(0)" },
            ],
            { duration: 420, delay: j * 50, easing: "cubic-bezier(.2,.8,.2,1)", fill: "backwards" },
          ),
        );
      }
    }
  });

  return (
    <section id="community" ref={sectionRef} className="lp-comm">
      <div className="lp-sticky lp-comm__stage">
        <div className="lp-comm__left">
          <span className="lp-eyebrow lp-eyebrow--amber">Community</span>
          <h2 className="lp-comm__h2">Built by other makers.</h2>
          <p className="lp-comm__lede">
            Every design on Bluebuild is open. Browse what people have drawn, open the parts and wiring, or remix one into your own build.
          </p>
          <div className="lp-comm__feat">
            <span className="lp-comm__tape" aria-hidden="true" />
            <span className="lp-comm__featTop">
              <span>NOW ON THE TURNTABLE</span>
              <span ref={numRef} className="lp-amber">
                01 / {String(count).padStart(2, "0")}
              </span>
            </span>
            <span ref={titleRef} className="lp-comm__featTitle">
              {cards[0].title}
            </span>
            <span ref={byRef} className="lp-comm__featBy">
              {byLine(cards[0])}
            </span>
            <span ref={statsRef} className="lp-comm__featStats">
              {statsLine(cards[0])}
            </span>
          </div>
          <div className="lp-comm__dots" aria-hidden="true">
            {cards.map((card, i) => (
              <span
                key={card.project_id}
                ref={(el) => {
                  dotRefs.current[i] = el;
                }}
                className={i === 0 ? "is-on" : ""}
              />
            ))}
          </div>
          <div className="lp-comm__cta">
            <a href="/projects" className="lp-btn lp-btn--amber lp-btn--lg">
              Browse the community →
            </a>
            <span className="lp-hand lp-comm__note">
              {total.toLocaleString()} build{total === 1 ? "" : "s"} and counting
            </span>
          </div>
        </div>

        <div ref={stageRef} className="lp-comm__right">
          <div ref={scaleRef} className="lp-comm__scale">
            <div ref={ringRef} className="lp-comm__ring">
              <div className="lp-comm__disk" aria-hidden="true" />
              <div className="lp-comm__hub" aria-hidden="true" />
              {cards.map((card, i) => {
                const paper = i % 2 === 0;
                const handle = makerHandle(card);
                return (
                  <a
                    key={card.project_id}
                    ref={(el) => {
                      cardRefs.current[i] = el;
                    }}
                    href={`/projects?p=${encodeURIComponent(card.project_id)}`}
                    className={`lp-tcard ${paper ? "is-paper" : "is-blue"}`}
                    aria-label={`${card.title} by @${handle}`}
                  >
                    <span className="lp-tcard__tape" style={{ transform: `rotate(${((i % 3) - 1) * 3}deg)` }} aria-hidden="true" />
                    <span className="lp-tcard__render">
                      {card.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={card.image} alt="" loading="lazy" />
                      ) : (
                        <span className="lp-tcard__dwg">DWG {drawingNumber(card.project_id)} · RENDER</span>
                      )}
                      {card.category && <span className="lp-tcard__cat">{card.category}</span>}
                      {card.coin && <span className="lp-tcard__coin">${card.coin.symbol}</span>}
                    </span>
                    <span className="lp-tcard__title">{card.title}</span>
                    <span className="lp-tcard__maker">
                      <span className="lp-tcard__av" style={{ background: avatarColor(handle) }}>
                        {handle.slice(0, 2).toUpperCase()}
                      </span>
                      @{handle}
                    </span>
                    <span className="lp-tcard__stats">
                      <span>{card.parts_count || 0} PARTS</span>
                      <span>{card.estimated_cost_usd ? `$${card.estimated_cost_usd.toFixed(2)}` : "—"}</span>
                      <span>↻ {formatCount(card.remix_count)}</span>
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
          <span className="lp-hand lp-comm__spin">scroll to spin the turntable ↻</span>
        </div>
      </div>
    </section>
  );
}
