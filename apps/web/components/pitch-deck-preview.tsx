"use client";

export type LaunchImageOption = { src: string; label: string };

export type LaunchPreview = {
  /** A product render for the pitch deck preview. */
  heroImage: string | null;
  renderCount: number;
  hasModel: boolean;
  /** Parts cost for one unit, e.g. "$19.49". */
  unitCost: string | null;
};

/** Pitch deck preview card: the coin as buyers will meet it, updating as the form changes. */
export function PitchDeckPreview({
  name,
  description,
  symbol,
  logo,
  preview,
  launched,
}: {
  name: string;
  description: string;
  symbol: string;
  logo: string | null;
  preview: LaunchPreview;
  launched: boolean;
}) {
  const ticker = `$${symbol.trim().replace(/^\$/, "").toUpperCase() || "???"}`;
  return (
    <div className="bb-deck-wrap">
      <div className="bb-deck">
        <span className="craft-tape bb-deck__tape" aria-hidden="true" />
        <div className="bb-deck__top">
          <span>Pitch deck · preview</span>
          <span className={`bb-deck__chip ${launched ? "is-live" : ""}`}>{launched ? "Live" : "Draft"}</span>
        </div>
        <div className="bb-deck__render">
          {preview.heroImage ? (
            // eslint-disable-next-line @next/next/no-img-element -- generated product render
            <img src={preview.heroImage} alt="" />
          ) : (
            <span>Product render</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="bb-coin" aria-hidden="true">
            {logo ? (
              // eslint-disable-next-line @next/next/no-img-element -- chosen coin logo
              <img src={logo} alt="" />
            ) : (
              ticker
            )}
          </span>
          <span className="flex min-w-0 flex-col gap-1">
            <span className="bb-deck__name">{name.trim() || "Untitled coin"}</span>
            <span className="bb-deck__desc">{description.trim() || "What it does, in a sentence"}</span>
          </span>
        </div>
        <div className="bb-deck__stats">
          <span>Renders<b>{preview.renderCount ? `${preview.renderCount} view${preview.renderCount === 1 ? "" : "s"}` : "—"}</b></span>
          <span>3D<b>{preview.hasModel ? "X-ray" : "—"}</b></span>
          <span>Unit<b>{preview.unitCost || "—"}</b></span>
        </div>
        {launched && (
          <div className="bb-deck__stamp" role="status">
            Launched
            <span>Live on pump.fun</span>
          </div>
        )}
      </div>
    </div>
  );
}
