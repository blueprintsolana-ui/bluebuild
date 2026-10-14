import { PUMP_FUN_LINK, X_LINK } from "./landing-links";
import { Wordmark } from "./wordmark";

const mono = "font-[family-name:var(--craft-mono)]";

export function LandingHeader() {
  return (
    <header className="relative z-20 border-b border-[var(--craft-hairline)] bg-[rgb(14_42_87/0.9)] backdrop-blur">
      <nav aria-label="Main" className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <a href="#top" aria-label="Bluebuild home">
          <Wordmark height={28} />
        </a>
        <div className={`bb-nav flex flex-wrap items-center gap-x-3 gap-y-3 text-[12px] md:gap-x-6 uppercase tracking-[0.12em] ${mono}`}>
          <a href="#how" className="no-underline max-md:hidden">How it works</a>
          <a href="#launch" className="no-underline max-md:hidden">Launchpad</a>
          <a href="#docs" className="no-underline max-md:hidden">Docs</a>
          <a href="#token" className="no-underline max-md:hidden">Token</a>
          <a href={X_LINK} className="no-underline max-md:hidden" aria-label="Bluebuild on X">@bluebuild_AI</a>
          <a href="/app" className="craft-key min-h-[40px] px-3 normal-case tracking-normal sm:px-[1.1rem]">Launch app</a>
          <a href={PUMP_FUN_LINK} className="craft-key craft-key--primary min-h-[40px] px-3 normal-case tracking-normal sm:px-[1.1rem]">
            Buy<span className="max-sm:hidden">&nbsp;on pump.fun</span>
          </a>
        </div>
      </nav>
    </header>
  );
}
