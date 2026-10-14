import { PaperCard, TornEdge } from "../craft";
import { TitleBlock } from "./landing-hero";
import { CONTRACT_ADDRESS, GITHUB_REPO_LINK, PUMP_FUN_LINK, X_LINK } from "./landing-links";
import { Wordmark } from "./wordmark";

const mono = "font-[family-name:var(--craft-mono)]";
const eyebrowBase = `m-0 text-[12px] uppercase tracking-[0.14em] ${mono}`;
const eyebrow = `${eyebrowBase} text-[var(--craft-muted)]`;

export function LaunchpadSection() {
  const points = [
    ["Your wallet, your coin.", "You create it on pump.fun yourself. Bluebuild never holds your keys and takes no fee."],
    ["A pitch deck, built for you.", "It becomes the coin's website, so buyers see what the product actually is, with renders, a 3D model, use cases and costs."],
    ["Bring your community.", "Add your X and Telegram links when you launch."],
  ];
  return (
    <section id="launch" className="relative z-10">
      <TornEdge seed={5} />
      <div className="bg-[var(--craft-panel)]">
        <div className="mx-auto grid max-w-[1240px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
          <div className="bb-reveal flex flex-col gap-5">
            <p className={`${eyebrowBase} text-[var(--craft-amber)]`}>Launchpad</p>
            <h2 className="landing-h2 m-0 font-semibold leading-tight">Every idea can have a coin.</h2>
            <p className="m-0 text-[17px] leading-relaxed text-[var(--craft-muted)]">
              When your design is ready, launch a pump.fun coin for it in a couple of clicks. Bluebuild turns the design into a pitch
              deck that becomes the coin&apos;s website.
            </p>
            <ol className="m-0 flex list-none flex-col gap-3.5 p-0">
              {points.map(([title, body], index) => (
                <li key={title} className="flex gap-3 text-[16px] leading-relaxed">
                  <span className={`text-[var(--craft-amber)] ${mono}`}>{String(index + 1).padStart(2, "0")}</span>
                  <span>
                    <strong>{title}</strong> <span className="text-[var(--craft-muted)]">{body}</span>
                  </span>
                </li>
              ))}
            </ol>
            <div>
              <a href="/app" className="craft-key craft-key--primary min-h-[48px] px-6">Design something to launch →</a>
            </div>
            <p className="m-0 max-w-[560px] text-[13px] leading-relaxed text-[var(--craft-muted)]">
              Coins are created by their designers on pump.fun. Bluebuild takes no fee, doesn&apos;t endorse or promote any coin, and
              can&apos;t undo transactions. Crypto is risky; only spend what you can afford to lose.
            </p>
          </div>
          <PaperCard
            className="bb-reveal flex flex-col gap-5 p-6"
            fold
            tape={[{ style: { top: -11, left: "42%" }, rotate: 2, width: 100 }]}
            aria-label="Example: a design launched as a coin with its pitch deck"
          >
            <div className="flex items-center gap-3.5">
              <svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true">
                <rect x="1" y="1" width="54" height="54" rx="10" fill="#0E2A57" stroke="#3A70C4" />
                <rect x="22" y="16" width="12" height="28" rx="5" fill="#C0C6CF" />
                <rect x="21" y="11" width="14" height="7" rx="2" fill="#1C1F26" />
                <rect x="24.5" y="12.5" width="7" height="3" rx="1" fill="#FFB547" />
              </svg>
              <div className="flex flex-col gap-1">
                <span className="text-[18px] font-semibold">Smart Sip Bottle</span>
                <span className={`text-[13px] text-[var(--craft-amber)] ${mono}`}>$SIP · LIVE ON PUMP.FUN</span>
              </div>
            </div>
            <p className="m-0 text-[15px] leading-relaxed">Know exactly how cold your water is, at a glance.</p>
            <div className="grid grid-cols-3 gap-2.5">
              {[["Renders", "3 views"], ["3D model", "X-ray"], ["Costs", "1k · 10k units"]].map(([label, value]) => (
                <div key={label} className={`border border-[var(--craft-hairline)] p-2.5 text-[11px] tracking-[0.08em] text-[var(--craft-muted)] ${mono}`}>
                  {label.toUpperCase()}
                  <span className="mt-1 block text-[13px] text-[var(--craft-ink)]">{value.toUpperCase()}</span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap gap-2.5 text-[14px]">
              <span className="inline-flex min-h-[40px] items-center rounded bg-[var(--craft-amber)] px-4 font-semibold text-[#1A1300]">View on pump.fun</span>
              <span className="inline-flex min-h-[40px] items-center rounded border border-[var(--craft-hairline)] px-4">Pitch deck</span>
              <span className="inline-flex min-h-[40px] items-center rounded border border-[var(--craft-hairline)] px-4">X</span>
            </div>
            <span className={`text-[11px] tracking-[0.1em] text-[var(--craft-muted)] ${mono}`}>EXAMPLE · FEE TO BLUEBUILD: 0</span>
          </PaperCard>
        </div>
      </div>
      <TornEdge seed={9} color="var(--craft-panel)" flip />
    </section>
  );
}

export function DocsSection() {
  return (
    <section id="docs" className="relative z-10 mx-auto grid max-w-[1240px] items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
      <div className="bb-reveal flex flex-col gap-5">
        <p className={eyebrow}>Docs</p>
        <h2 className="landing-h2 m-0 font-semibold leading-tight">Open source. Read every line.</h2>
        <p className="m-0 text-[17px] leading-relaxed text-[var(--craft-muted)]">
          Bluebuild&apos;s full code is public on GitHub. It is built on Form, the open-source AI hardware design workspace by CAID
          Technologies, and shared under the same MPL-2.0 licence.
        </p>
        <div className="flex flex-wrap gap-3">
          <a href={GITHUB_REPO_LINK} className="craft-key min-h-[48px] bg-[var(--craft-ink)] px-5 font-semibold text-[var(--craft-panel)]">View the code on GitHub</a>
          <a href={`${GITHUB_REPO_LINK}/tree/main/docs`} className="craft-key min-h-[48px] px-5">Read the docs</a>
        </div>
      </div>
      <PaperCard tone="deep" className="bb-reveal p-6" tape={[{ style: { top: -11, right: 30 }, rotate: 4, width: 86 }]}>
        <pre className={`m-0 overflow-x-auto text-[14px] leading-[1.8] ${mono}`}>
          <span className="text-[var(--craft-muted)]"># run Bluebuild on your own machine</span>
          {`\ngit clone ${GITHUB_REPO_LINK}.git\ncd bluebuild\n./scripts/development/dev.sh\n\n`}
          <span className="text-[var(--craft-muted)]"># then open</span>
          {"\n"}
          <span className="text-[var(--craft-amber)]">http://localhost:3000</span> <span className="bb-caret" aria-hidden="true" />
        </pre>
      </PaperCard>
    </section>
  );
}

export function TokenSection() {
  return (
    <section id="token" className="relative z-10">
      <TornEdge seed={14} />
      <div className="bg-[var(--craft-panel)]">
        <div className="bb-reveal mx-auto flex max-w-[1240px] flex-col items-start gap-7 px-4 py-24 sm:px-6">
          <p className={eyebrow}>Token</p>
          <h2 className="landing-h2 m-0 font-semibold leading-tight">$BLUEBUILD on pump.fun</h2>
          <div className={`flex flex-wrap items-center gap-2.5 ${mono}`}>
            <span className="text-[12px] tracking-[0.12em] text-[var(--craft-muted)]">CA</span>
            <code className="break-all rounded-[3px] border border-[var(--craft-hairline)] bg-[var(--craft-page)] px-3.5 py-3 text-[15px]">{CONTRACT_ADDRESS}</code>
          </div>
          <div className="flex flex-wrap gap-3">
            <a href={PUMP_FUN_LINK} className="craft-key craft-key--primary min-h-[48px] px-6">Buy on pump.fun</a>
            <a href={X_LINK} className="craft-key min-h-[48px] px-5">Follow @bluebuild_AI</a>
          </div>
          <p className="m-0 max-w-[640px] text-[14px] leading-relaxed text-[var(--craft-muted)]">
            $BLUEBUILD is a community memecoin. It is not a share in Bluebuild, gives no rights to the software or any revenue, and
            carries no promise of returns. Only buy what you can afford to lose. It is separate from the coins people launch for
            their own designs.
          </p>
        </div>
      </div>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="relative z-10 border-t border-[var(--craft-hairline)] bg-[var(--craft-panel)]">
      <div className="mx-auto flex max-w-[1240px] flex-wrap items-end justify-between gap-10 px-4 py-14 sm:px-6">
        <div className="flex max-w-[520px] flex-col gap-4">
          <span className="self-start">
            <Wordmark height={26} />
          </span>
          <p className="m-0 text-[14px] leading-relaxed text-[var(--craft-muted)]">
            Bluebuild is an independent open-source project. Not affiliated with Blueprint.io. Built on Form by CAID Technologies
            (MPL-2.0).
          </p>
          <div className={`bb-nav flex flex-wrap gap-6 text-[12px] tracking-[0.12em] ${mono}`}>
            <a href={GITHUB_REPO_LINK}>GITHUB</a>
            <a href={X_LINK}>X / TWITTER</a>
            <a href={PUMP_FUN_LINK}>PUMP.FUN</a>
            <a href="/about">ABOUT &amp; LEGAL</a>
          </div>
        </div>
        <TitleBlock project="Bluebuild — AI hardware design" className="min-w-[300px]" />
      </div>
    </footer>
  );
}
