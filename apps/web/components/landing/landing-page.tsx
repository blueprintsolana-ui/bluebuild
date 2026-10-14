"use client";

import { CrosshairReadout, Gear, LivingGrid, PaperGrain } from "../craft";
import { ExplodedBottle } from "./exploded-bottle";
import { LandingHeader } from "./landing-header";
import { LandingHero } from "./landing-hero";
import { DocsSection, LandingFooter, LaunchpadSection, TokenSection } from "./landing-sections";
import { HowItWorks, OutputSheets } from "./landing-steps";

/** The Bluebuild landing page: the "crafty drafting table" from BLUEBUILD_DESIGN_BRIEF.md. */
export default function LandingPage() {
  return (
    <div className="craft-crosshair-zone relative min-h-screen overflow-x-clip font-[family-name:var(--craft-sans)] text-[var(--craft-ink)]">
      <LivingGrid fragments />
      <PaperGrain />
      <CrosshairReadout />
      {/* A brass gear in the corner turns with the scroll position. */}
      <Gear
        mode="scroll"
        teeth={22}
        radius={70}
        color="var(--craft-brass)"
        strokeWidth={2}
        className="pointer-events-none fixed -bottom-14 -right-14 z-[2] h-36 w-36 opacity-30 sm:-bottom-20 sm:-right-20 sm:h-56 sm:w-56 sm:opacity-40"
      />
      <LandingHeader />
      <main className="relative z-10">
        <LandingHero />
        <ExplodedBottle />
        <HowItWorks />
        <OutputSheets />
        <LaunchpadSection />
        <DocsSection />
        <TokenSection />
      </main>
      <LandingFooter />
    </div>
  );
}
