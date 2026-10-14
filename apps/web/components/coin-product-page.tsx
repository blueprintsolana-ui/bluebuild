"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ArrowUpRight, Maximize2 } from "lucide-react";

import CaidLogo from "./caid-logo";
import CopyButton from "./copy-button";
import ImageLightbox from "./image-lightbox";
import type { CoinPageData } from "../lib/coin-page";
import { resolveProductModel } from "../lib/product-model";

const ProductModelViewer = dynamic(() => import("./product-model-viewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[280px] items-center justify-center rounded-xl border border-[var(--forma-border)] bg-[var(--forma-surface-muted)] text-xs uppercase tracking-[0.14em] text-[var(--forma-text-muted)] sm:h-[380px]">
      Loading 3D model...
    </div>
  ),
});

const card = "rounded-xl border border-[var(--forma-border)] bg-[var(--forma-surface)]";
const bodyText = "text-sm leading-7 text-[var(--forma-text-body)]";

function firstSentence(text: string) {
  const match = text.match(/^.*?[.!?](\s|$)/);
  return (match ? match[0] : text).trim();
}

function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}

function money(value: number) {
  return value >= 1000
    ? `$${Math.round(value).toLocaleString("en-US")}`
    : `$${value.toFixed(2)}`;
}

type DeckSection = { id: string; title: string; content: ReactNode };

function DeckSlide({ number, section }: { number: number; section: DeckSection }) {
  return (
    <section id={section.id} className="scroll-mt-20 border-t border-[var(--forma-border)] pt-10">
      <div className="grid gap-6 lg:grid-cols-[14rem_1fr]">
        <div>
          <div className="font-mono text-xs text-[#ffb547]">{String(number).padStart(2, "0")}</div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--forma-text-strong)]">{section.title}</h2>
        </div>
        <div className="min-w-0">{section.content}</div>
      </div>
    </section>
  );
}

export default function CoinProductPage({ launch, pitch }: CoinPageData) {
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const copy = pitch?.copy || null;
  const title = pitch?.title || launch.name;
  const description = pitch?.description || launch.description;
  const tagline = copy?.tagline || (description ? firstSentence(description) : "");
  const images = pitch?.images?.length ? pitch.images : [{ url: launch.image_url, label: launch.name }];
  const model = useMemo(
    () => resolveProductModel(pitch?.product_model, pitch?.mechanical, Array.isArray(pitch?.components) ? pitch.components : []),
    [pitch],
  );
  const highlights = copy?.highlights?.length ? copy.highlights : pitch?.features || [];
  const materials = copy?.materials?.length ? copy.materials : pitch?.fabrication || [];
  const howItWorks = copy?.how_it_works?.length
    ? copy.how_it_works
    : (pitch?.subsystems || []).map((system) => `${system.name}: ${system.purpose}`);
  const estimates = copy?.production_estimates || [];
  const socials = [
    launch.twitter && { label: "X", href: launch.twitter },
    launch.telegram && { label: "Telegram", href: launch.telegram },
  ].filter(Boolean) as { label: string; href: string }[];

  const sections: DeckSection[] = [];
  if (copy?.problem) {
    sections.push({ id: "problem", title: "The problem", content: <p className={`${bodyText} text-base`}>{copy.problem}</p> });
  }
  if (description || highlights.length) {
    sections.push({
      id: "product",
      title: "The product",
      content: (
        <div className="space-y-5">
          {description && <p className={bodyText}>{description}</p>}
          {highlights.length > 0 && (
            <ul className="grid gap-3 sm:grid-cols-2">
              {highlights.map((item) => (
                <li key={item} className={`${card} p-4 text-sm leading-6 text-[var(--forma-text-body)]`}>{item}</li>
              ))}
            </ul>
          )}
        </div>
      ),
    });
  }
  if (howItWorks.length) {
    sections.push({
      id: "how-it-works",
      title: "How it works",
      content: (
        <ol className="space-y-3">
          {howItWorks.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm leading-6 text-[var(--forma-text-body)]">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[rgb(255_181_71/0.15)] font-mono text-[11px] text-[#ffb547]">
                {index + 1}
              </span>
              <span className="pt-0.5">{step}</span>
            </li>
          ))}
        </ol>
      ),
    });
  }
  if (model) {
    sections.push({
      id: "model",
      title: "See it in 3D",
      content: (
        <div>
          <p className="mb-4 text-sm text-[var(--forma-text-secondary)]">Drag to turn it around, and switch to Internal to see what&apos;s inside.</p>
          <ProductModelViewer model={model} />
        </div>
      ),
    });
  }
  if (copy?.use_cases?.length) {
    sections.push({
      id: "use-cases",
      title: "Use cases",
      content: (
        <div>
          <div className="grid gap-3 sm:grid-cols-2">
            {copy.use_cases.map((useCase) => (
              <div key={useCase.title} className={`${card} p-5`}>
                <h3 className="text-sm font-semibold text-[var(--forma-text-strong)]">{useCase.title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--forma-text-secondary)]">{useCase.detail}</p>
              </div>
            ))}
          </div>
          {copy.audience && (
            <p className="mt-4 text-sm text-[var(--forma-text-secondary)]">
              <span className="font-semibold text-[var(--forma-text-strong)]">Who it&apos;s for: </span>
              {copy.audience}
            </p>
          )}
        </div>
      ),
    });
  }
  if (copy?.target_market) {
    sections.push({ id: "market", title: "Market", content: <p className={bodyText}>{copy.target_market}</p> });
  }
  if (pitch?.specs?.length || materials.length) {
    sections.push({
      id: "specs",
      title: "Specs & materials",
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          {pitch?.specs && pitch.specs.length > 0 && (
            <dl className={`${card} divide-y divide-[var(--forma-border)]`}>
              {pitch.specs.map((spec) => (
                <div key={spec.label} className="grid grid-cols-[8rem_1fr] gap-3 px-4 py-2.5 text-sm">
                  <dt className="text-[var(--forma-text-muted)]">{spec.label}</dt>
                  <dd className="break-words text-[var(--forma-text-strong)]">{spec.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {materials.length > 0 && (
            <ul className="space-y-2 text-sm leading-6 text-[var(--forma-text-body)]">
              {materials.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffb547]" aria-hidden="true" />
                  {item}
                </li>
              ))}
            </ul>
          )}
        </div>
      ),
    });
  }
  if (pitch?.estimated_cost_usd || estimates.length) {
    sections.push({
      id: "costs",
      title: "Cost to make",
      content: (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-3">
            {pitch?.estimated_cost_usd ? (
              <div className={`${card} p-4`}>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--forma-text-muted)]">Prototype parts</div>
                <div className="mt-1 text-2xl font-semibold text-[var(--forma-text-strong)]">{money(pitch.estimated_cost_usd)}</div>
                <div className="mt-1 text-xs text-[var(--forma-text-muted)]">one unit, off-the-shelf parts</div>
              </div>
            ) : null}
            {estimates.map((estimate) => (
              <div key={estimate.volume} className={`${card} p-4`}>
                <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--forma-text-muted)]">Per unit at {estimate.volume}</div>
                <div className="mt-1 text-2xl font-semibold text-[#ffb547]">{money(estimate.unit_cost_usd)}</div>
                {estimate.notes && <div className="mt-1 text-xs leading-5 text-[var(--forma-text-muted)]">{estimate.notes}</div>}
              </div>
            ))}
          </div>
          {copy?.tooling_cost_usd ? (
            <p className="text-sm text-[var(--forma-text-secondary)]">
              <span className="font-semibold text-[var(--forma-text-strong)]">One-time tooling: </span>
              about {money(copy.tooling_cost_usd)} for moulds and fixtures.
            </p>
          ) : null}
          {copy?.manufacturing_notes && copy.manufacturing_notes.length > 0 && (
            <ul className="space-y-2 text-sm leading-6 text-[var(--forma-text-body)]">
              {copy.manufacturing_notes.map((note) => (
                <li key={note} className="flex gap-2">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#ffb547]" aria-hidden="true" />
                  {note}
                </li>
              ))}
            </ul>
          )}
          <p className="text-[11px] text-[var(--forma-text-muted)]">Rough engineering estimates from the design, not supplier quotes.</p>
        </div>
      ),
    });
  }
  if (pitch?.parts?.length) {
    sections.push({
      id: "parts",
      title: "Inside the build",
      content: (
        <ul className="grid gap-2 sm:grid-cols-2">
          {pitch.parts.map((part) => (
            <li key={part.name} className={`${card} flex items-center justify-between gap-3 px-4 py-3 text-sm`}>
              <span className="min-w-0">
                <span className="block truncate text-[var(--forma-text-strong)]">{part.name}</span>
                {part.category && <span className="block truncate text-[11px] text-[var(--forma-text-muted)]">{part.category}</span>}
              </span>
              {part.count > 1 && <span className="shrink-0 font-mono text-xs text-[var(--forma-text-muted)]">×{part.count}</span>}
            </li>
          ))}
        </ul>
      ),
    });
  }

  return (
    <div className="min-h-[100dvh] bg-[var(--forma-page)] text-[var(--forma-text)]">
      <header className="sticky top-0 z-30 border-b border-[var(--forma-border)] bg-[rgb(var(--forma-chrome-rgb)/0.9)] backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--forma-text-strong)]">
            <CaidLogo className="h-6 w-7" />
            Bluebuild
          </Link>
          <a href={launch.pump_url} target="_blank" rel="noreferrer" className="connect-wallet-button">
            Buy ${launch.symbol} on pump.fun
          </a>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12">
        <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              {/* eslint-disable-next-line @next/next/no-img-element -- coin logo from public storage */}
              <img src={launch.image_url} alt="" className="h-12 w-12 rounded-xl border border-[var(--forma-border)] object-cover" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-[var(--forma-text-strong)]">{launch.name}</div>
                <div className="font-mono text-xs text-[#ffb547]">${launch.symbol} · Pitch deck</div>
              </div>
            </div>
            <h1 className="mt-6 break-words text-3xl font-semibold leading-tight tracking-tight text-[var(--forma-text-strong)] sm:text-5xl">
              {title}
            </h1>
            {tagline && <p className="mt-4 max-w-xl text-lg leading-8 text-[var(--forma-text-body)]">{tagline}</p>}
            {copy?.pitch && <p className="mt-4 max-w-xl text-sm leading-7 text-[var(--forma-text-secondary)]">{copy.pitch}</p>}
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <a href={launch.pump_url} target="_blank" rel="noreferrer" className="connect-wallet-button">
                View on pump.fun
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
              {pitch?.project_id && (
                <Link
                  href={`/project/${encodeURIComponent(pitch.project_id)}`}
                  className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[var(--forma-border)] px-4 text-sm font-medium text-[var(--forma-text-strong)] transition hover:border-[var(--forma-text-muted)]"
                >
                  See the full build plan
                </Link>
              )}
            </div>
            <div className="mt-5 flex flex-wrap items-center gap-2 text-xs text-[var(--forma-text-muted)]">
              <span>Contract</span>
              <code className="rounded-md border border-[var(--forma-border)] bg-[var(--forma-surface)] px-2 py-1 font-mono text-[var(--forma-text-strong)]" title={launch.mint}>
                {shortAddress(launch.mint)}
              </code>
              <CopyButton value={launch.mint} label="Copy contract address" />
              {socials.map((social) => (
                <a key={social.href} href={social.href} target="_blank" rel="noreferrer nofollow" className="rounded-md border border-[var(--forma-border)] px-2 py-1 text-[var(--forma-text-strong)] hover:border-[var(--forma-text-muted)]">
                  {social.label}
                </a>
              ))}
            </div>
          </div>

          <button
            type="button"
            onClick={() => setLightboxIndex(0)}
            className="group relative block overflow-hidden rounded-2xl border border-[var(--forma-border)] bg-[var(--forma-surface-muted)] text-left"
            aria-label={`Open ${images[0].label} full size`}
          >
            {/* eslint-disable-next-line @next/next/no-img-element -- product render from public storage */}
            <img src={images[0].url} alt={images[0].label} className="aspect-[4/3] w-full object-cover transition duration-500 group-hover:scale-[1.02]" />
            <span className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-md bg-black/55 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
              <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />
              View full size
            </span>
          </button>
        </section>

        {images.length > 1 && (
          <section className={`mt-6 grid grid-cols-2 gap-3 ${images.length === 3 ? "sm:grid-cols-3" : "sm:grid-cols-4"}`} aria-label="Product images">
            {images.map((image, index) => (
              <button
                key={image.url}
                type="button"
                onClick={() => setLightboxIndex(index)}
                className="overflow-hidden rounded-xl border border-[var(--forma-border)] bg-[var(--forma-surface-muted)] text-left transition hover:border-[var(--forma-text-muted)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element -- product render from public storage */}
                <img src={image.url} alt={image.label} className="aspect-[4/3] w-full object-cover" />
                <div className="truncate px-2.5 py-2 text-[11px] font-medium text-[var(--forma-text-secondary)]">{image.label}</div>
              </button>
            ))}
          </section>
        )}

        <div className="mt-14 space-y-10">
          {sections.map((section, index) => (
            <DeckSlide key={section.id} number={index + 1} section={section} />
          ))}
        </div>

        <section className={`${card} mt-14 flex flex-col items-start gap-4 p-6 sm:flex-row sm:items-center sm:justify-between`}>
          <div>
            <h2 className="text-lg font-semibold text-[var(--forma-text-strong)]">Have your own product idea?</h2>
            <p className="mt-1 text-sm text-[var(--forma-text-secondary)]">Describe it in one sentence and Bluebuild draws the parts, wiring, 3D model and build steps.</p>
          </div>
          <Link href="/app" className="connect-wallet-button shrink-0">
            Design yours on Bluebuild
          </Link>
        </section>

        <footer className="mt-10 space-y-2 border-t border-[var(--forma-border)] pt-6 text-[11px] leading-5 text-[var(--forma-text-muted)]">
          <p>
            This pitch deck was generated by Bluebuild from the design when its community coin launched. The coin was created by the
            designer from their own wallet on pump.fun. Bluebuild doesn&apos;t endorse or promote it, takes no fee, and has no control
            over it. Cost figures are rough estimates. Crypto assets are risky and can lose all their value.
          </p>
          <p>Bluebuild is an independent open-source project. Not affiliated with Blueprint.io.</p>
        </footer>
      </main>

      {lightboxIndex !== null && (
        <ImageLightbox
          images={images.map((image) => ({ src: image.url, label: image.label }))}
          index={lightboxIndex}
          onIndexChange={setLightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}
