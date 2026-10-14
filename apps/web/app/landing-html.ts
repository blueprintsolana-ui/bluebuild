// The Bluebuild landing page, served at "/" by app/route.ts.
//
// Before launch, replace these placeholders below:
//   [PUMP.FUN LINK]      your token's pump.fun page
//   [GITHUB REPO LINK]   your GitHub repository
//   [CONTRACT ADDRESS — ADD ON LAUNCH DAY]   (in the <script> near the end)

export const LANDING_HTML = String.raw`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Bluebuild — Describe it. We'll draw the build. Then launch it.</title>
<meta name="description" content="Type one sentence. Bluebuild returns a parts list, wiring diagram, 3D model and build guide for your product idea, then lets you launch a pump.fun coin for it with its own product page. Open source.">
<meta property="og:title" content="Bluebuild — Describe it. We'll draw the build. Then launch it.">
<meta property="og:description" content="Open-source AI hardware design and launchpad. Parts, wiring, 3D model and build steps from one sentence, plus a pump.fun coin and product page for your idea.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@bluebuild_AI">
<link rel="icon" href="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA1MTIgNTEyIj48cmVjdCB3aWR0aD0iNTEyIiBoZWlnaHQ9IjUxMiIgcng9Ijk2IiBmaWxsPSIjMTQzNjZFIi8+CjxnIHRyYW5zZm9ybT0idHJhbnNsYXRlKDE2NiAzODApIHNjYWxlKDQuMikiIGZpbGw9Im5vbmUiIHN0cm9rZT0iI0Y0RjdGQiIgc3Ryb2tlLXdpZHRoPSI4IiBzdHJva2UtbGluZWNhcD0icm91bmQiPjxwYXRoIGQ9Ik0wIC02NFYwIi8+PGNpcmNsZSBjeD0iMjAiIGN5PSItMjAiIHI9IjIwIi8+PC9nPgo8cGF0aCBkPSJNMzEwIDI2MkwzNjAgMjEyIiBzdHJva2U9IiNGRkI1NDciIHN0cm9rZS13aWR0aD0iMTQiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIvPjwvc3ZnPgo=">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&amp;family=Space+Grotesk:wght@400;500;600&amp;display=swap" rel="stylesheet">
<style>
body{margin:0;background:#14366E}
a{color:#F4F7FB}a:hover{color:#FFB547}
.bb-grid{background-color:#14366E;background-image:linear-gradient(rgba(244,247,251,.16) 1px,transparent 1px),linear-gradient(90deg,rgba(244,247,251,.16) 1px,transparent 1px),linear-gradient(rgba(244,247,251,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(244,247,251,.07) 1px,transparent 1px);background-size:100px 100px,100px 100px,20px 20px,20px 20px}
.bb-deep{background-color:#0E2A57;background-image:linear-gradient(rgba(244,247,251,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(244,247,251,.07) 1px,transparent 1px);background-size:20px 20px,20px 20px}
.bb-input::placeholder{color:#A9BEDD}
.bb-input:focus{outline:2px solid #FFB547;outline-offset:2px}
.bb-btn:hover{filter:brightness(1.06)}

/* ---------- motion system ---------- */
:root{--bb-ease:cubic-bezier(.2,.7,.2,1)}
@keyframes bb-rise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:none}}
@keyframes bb-fade{from{opacity:0}to{opacity:1}}
@keyframes bb-drop{from{opacity:0;transform:translateY(-100%)}to{opacity:1;transform:none}}
@keyframes bb-draw{from{stroke-dasharray:1;stroke-dashoffset:1}to{stroke-dasharray:1;stroke-dashoffset:0}}
@keyframes bb-flow{from{stroke-dashoffset:0}to{stroke-dashoffset:-44}}
@keyframes bb-flow-in{from{opacity:0}to{opacity:.95}}
@keyframes bb-pulse{0%,100%{transform:scale(1);opacity:1}50%{transform:scale(1.7);opacity:.55}}
@keyframes bb-scan{0%{top:-2%;opacity:0}8%{opacity:1}92%{opacity:1}100%{top:100%;opacity:0}}
@keyframes bb-grow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes bb-blink{0%,49%{opacity:1}50%,100%{opacity:0}}
@keyframes bb-glow{0%,100%{box-shadow:0 0 0 0 rgba(255,181,71,0)}50%{box-shadow:0 0 0 6px rgba(255,181,71,.18)}}
@keyframes bb-spin{to{transform:rotate(360deg)}}

/* entrance */
.bb-head{animation:bb-drop .7s var(--bb-ease) both}
.bb-in{animation:bb-rise .9s var(--bb-ease) both}
.bb-d1{animation-delay:.15s}.bb-d2{animation-delay:.3s}.bb-d3{animation-delay:.45s}.bb-d4{animation-delay:.6s}.bb-d5{animation-delay:.75s}.bb-d6{animation-delay:.9s}

/* dimension line under the headline */
.bb-dim{display:block;position:relative;height:2px;width:min(360px,80%);background:#FFB547;transform-origin:left;animation:bb-grow 1.1s var(--bb-ease) .8s both}
.bb-dim::before,.bb-dim::after{content:"";position:absolute;top:-7px;width:2px;height:16px;background:#FFB547}
.bb-dim::before{left:0}.bb-dim::after{right:0}

/* the drawing */
.bb-fig{position:relative;overflow:hidden;transition:border-color .4s var(--bb-ease),transform .5s var(--bb-ease)}
.bb-fig:hover{border-color:#F4F7FB}
.bb-scan{position:absolute;left:0;right:0;height:2px;background:#FFB547;box-shadow:0 0 14px 2px rgba(255,181,71,.55);pointer-events:none;opacity:0;animation:bb-scan 5.5s linear 2.4s infinite}
.bb-draw>*{animation:bb-draw 1.2s var(--bb-ease) both}
.bb-draw>*:nth-child(1){animation-delay:.5s}.bb-draw>*:nth-child(2){animation-delay:.7s}.bb-draw>*:nth-child(3){animation-delay:.85s}.bb-draw>*:nth-child(4){animation-delay:1s}.bb-draw>*:nth-child(5){animation-delay:1.15s}.bb-draw>*:nth-child(6){animation-delay:1.3s}
.bb-wires>*{animation:bb-draw 1s var(--bb-ease) both}
.bb-wires>*:nth-child(1){animation-delay:1.2s}.bb-wires>*:nth-child(2){animation-delay:1.3s}.bb-wires>*:nth-child(3){animation-delay:1.4s}.bb-wires>*:nth-child(4){animation-delay:1.5s}.bb-wires>*:nth-child(5){animation-delay:1.6s}.bb-wires>*:nth-child(6){animation-delay:1.7s}
.bb-flow{opacity:0;stroke-dasharray:4 18;animation:bb-flow-in .6s ease 2.4s forwards,bb-flow 1.4s linear 2.4s infinite}
.bb-node{transform-box:fill-box;transform-origin:center;animation:bb-fade .4s ease 2s both,bb-pulse 2.6s ease-in-out 2.4s infinite}
.bb-node:nth-child(2n){animation-delay:2s,3.1s}.bb-node:nth-child(3n){animation-delay:2s,3.7s}
.bb-lbl{animation:bb-fade .8s ease 1.9s both}
.bb-tb{animation:bb-rise .8s var(--bb-ease) 2.1s both}
.bb-rev{animation:bb-blink 1.2s steps(1) 3s 3}

/* links + buttons */
.bb-nav a{background:linear-gradient(#FFB547,#FFB547) 0 100%/0 1px no-repeat;padding-bottom:3px;transition:background-size .35s var(--bb-ease),color .25s}
.bb-nav a:hover{background-size:100% 1px}
.bb-nav a.bb-btn{background:#FFB547;padding-bottom:0}
.bb-btn{position:relative;overflow:hidden;transition:transform .3s var(--bb-ease),box-shadow .3s var(--bb-ease)}
.bb-btn::after{content:"";position:absolute;top:0;bottom:0;left:-60%;width:40%;background:rgba(255,255,255,.35);transform:skewX(-20deg);transition:left .6s var(--bb-ease);pointer-events:none}
.bb-btn:hover{transform:translateY(-2px);box-shadow:0 10px 24px -10px rgba(255,181,71,.7)}
.bb-btn:hover::after{left:130%}
.bb-btn:active{transform:translateY(0)}
.bb-ghost{transition:border-color .3s,background-color .3s,transform .3s var(--bb-ease)}
.bb-ghost:hover{border-color:#F4F7FB;background-color:rgba(244,247,251,.06);transform:translateY(-2px)}
.bb-arrow{display:inline-block;transition:transform .3s var(--bb-ease)}
a:hover .bb-arrow{transform:translateX(5px)}
.bb-glow{animation:bb-glow 3.2s ease-in-out infinite}
.bb-chip{transition:border-color .3s,box-shadow .3s}
.bb-chip:hover{border-color:#FFB547;box-shadow:0 0 0 3px rgba(255,181,71,.15)}
.bb-promptbox{transition:border-color .35s,box-shadow .35s}
.bb-promptbox:focus-within{border-color:#FFB547;box-shadow:0 0 0 4px rgba(255,181,71,.14)}
.bb-logo img{transition:transform .4s var(--bb-ease)}
.bb-logo:hover img{transform:translateY(-1px) scale(1.03)}
.bb-x svg{transition:transform .5s var(--bb-ease)}
.bb-x:hover svg{transform:rotate(90deg)}

/* cards */
.bb-card{position:relative;transition:transform .45s var(--bb-ease),border-color .35s,background-color .35s,box-shadow .45s var(--bb-ease)}
.bb-card::before,.bb-card::after{content:"";position:absolute;width:14px;height:14px;opacity:0;transition:opacity .3s,transform .45s var(--bb-ease);pointer-events:none}
.bb-card::before{top:-1px;left:-1px;border-top:2px solid #FFB547;border-left:2px solid #FFB547;transform:translate(-6px,-6px)}
.bb-card::after{bottom:-1px;right:-1px;border-bottom:2px solid #FFB547;border-right:2px solid #FFB547;transform:translate(6px,6px)}
.bb-card:hover{transform:translateY(-6px);border-color:#F4F7FB;box-shadow:0 22px 40px -24px rgba(0,0,0,.6)}
.bb-card:hover::before,.bb-card:hover::after{opacity:1;transform:none}
.bb-step{display:inline-flex;align-items:center;gap:12px}
.bb-step::after{content:"";height:1.5px;width:20px;background:#FFB547;transition:width .45s var(--bb-ease)}
.bb-card:hover .bb-step::after{width:64px}
.bb-icon>*{transition:stroke .3s}
.bb-card:hover .bb-icon>*{animation:bb-draw .8s var(--bb-ease) both;stroke:#FFB547}
.bb-caret{display:inline-block;width:9px;height:1.1em;vertical-align:text-bottom;background:#FFB547;animation:bb-blink 1s steps(1) infinite}
.bb-tblock{transition:border-color .35s}
.bb-tblock:hover{border-color:#FFB547}

/* scroll reveals (browsers without scroll timelines just show everything) */
@supports (animation-timeline: view()){
.bb-reveal{animation:bb-rise linear both;animation-timeline:view();animation-range:entry 0% cover 28%}
.bb-stagger>*{animation:bb-rise linear both;animation-timeline:view();animation-range:entry 0% cover 30%}
.bb-stagger>*:nth-child(2){animation-range:entry 6% cover 36%}
.bb-stagger>*:nth-child(3){animation-range:entry 12% cover 42%}
.bb-stagger>*:nth-child(4){animation-range:entry 18% cover 48%}
}
@media (max-width: 600px){h1{font-size:44px !important}h2{font-size:30px !important}}
@media (prefers-reduced-motion: reduce){
*,*::before,*::after{animation:none!important;transition:none!important}
.bb-flow,.bb-scan{display:none}
}
</style>
<style>html{scroll-behavior:smooth}@media (prefers-reduced-motion: reduce){html{scroll-behavior:auto}}</style>
</head>
<body>
<div class="bb-grid" style="font-family: 'Space Grotesk', 'Segoe UI', system-ui, sans-serif; color: #F4F7FB; min-height: 100%">

<!-- NAV -->
<header class="bb-head" style="border-bottom: 1px solid #3A70C4; background: rgba(14, 42, 87, 0.92)">
<nav aria-label="Main" style="max-width: 1240px; margin: 0 auto; padding: 18px 24px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px">
<a href="#top" class="bb-logo" aria-label="Bluebuild home" style="display: flex; align-items: center"><svg role="img" aria-label="bluebuild" style="height:30px;width:auto;display:block" xmlns="http://www.w3.org/2000/svg" viewBox="-4 -68 344 72" ><g fill="none" stroke="#F4F7FB" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 -64 V0"/><circle cx="20" cy="-20" r="20"/><path d="M52 -64 V0"/><path d="M64 -40 V-20 A20 20 0 0 0 104 -20 V-40 M104 -40 V0"/><path d="M116 -20 H156 A20 20 0 1 0 150.14 -5.86"/><path d="M168 -64 V0"/><circle cx="188" cy="-20" r="20"/><path d="M220 -40 V-20 A20 20 0 0 0 260 -20 V-40 M260 -40 V0"/><path d="M272 -40 V0"/><circle cx="272" cy="-54" r="4" fill="#F4F7FB" stroke="none"/><path d="M284 -64 V0"/><circle cx="316" cy="-20" r="20"/><path d="M336 -64 V0"/></g></svg></a>
<div class="bb-nav" style="display: flex; flex-wrap: wrap; align-items: center; gap: 28px; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase">
<a href="#how" style="text-decoration: none">How it works</a>
<a href="#launch" style="text-decoration: none">Launchpad</a>
<a href="#docs" style="text-decoration: none">Docs</a>
<a href="#token" style="text-decoration: none">Token</a>
<a href="https://x.com/bluebuild_AI" class="bb-x" aria-label="Bluebuild on X" style="display: flex; align-items: center; text-decoration: none; gap: 8px">
<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l16 16M20 4L4 20"></path></svg>
@bluebuild_AI</a>
<a class="bb-ghost" href="/app" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; border: 1px solid #3A70C4; border-radius: 4px; text-decoration: none; font-weight: 500; background: none">Launch app</a>
<a class="bb-btn" href="[PUMP.FUN LINK]" style="display: inline-flex; align-items: center; min-height: 44px; padding: 0 18px; background: #FFB547; color: #1A1300; border-radius: 4px; text-decoration: none; font-weight: 500">Buy on pump.fun</a>
</div>
</nav>
</header>

<!-- HERO -->
<section id="top" style="max-width: 1240px; margin: 0 auto; padding: 100px 24px 100px; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 60px; align-items: center">
<div style="display: flex; flex-direction: column; gap: 28px">
<p class="bb-in" style="margin: 0; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.14em; color: #A9BEDD; text-transform: uppercase">DWG NO. BB-001 &#183; Open-source AI hardware design &#183; Launchpad</p>
<h1 class="bb-in bb-d1" style="margin: 0; font-size: 64px; line-height: 1.05; font-weight: 600; letter-spacing: -0.02em">Describe it.<br>We'll draw the build.<br><span style="color: #FFB547">Then launch it.</span></h1>
<span class="bb-dim" aria-hidden="true"></span>
<p class="bb-in bb-d2" style="margin: 0; font-size: 19px; line-height: 1.55; color: #A9BEDD; max-width: 540px">Type one sentence. Bluebuild returns a parts list, a wiring diagram, a 3D model and a step-by-step build guide for your product idea. Then launch a pump.fun coin for it, with its own product page, straight from your wallet.</p>
<div class="bb-in bb-d3 bb-promptbox" style="background: #1C4A91; border: 1px solid #3A70C4; border-radius: 4px; padding: 20px; display: flex; flex-direction: column; gap: 12px">
<label for="bb-prompt" style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; color: #A9BEDD">What do you want to build?</label>
<div style="display: flex; flex-wrap: wrap; gap: 12px">
<input id="bb-prompt" class="bb-input" type="text" placeholder="A temperature monitor with a small OLED screen" style="flex: 1 1 260px; min-height: 48px; padding: 0 14px; background: #0E2A57; border: 1px solid #3A70C4; border-radius: 4px; color: #F4F7FB; font-family: inherit; font-size: 16px">
<a id="bb-draw" class="bb-btn" href="/app" style="display: inline-flex; align-items: center; justify-content: center; min-height: 48px; padding: 0 24px; background: #FFB547; color: #1A1300; border-radius: 4px; text-decoration: none; font-weight: 600; font-size: 16px">Draw it&#160;<span class="bb-arrow" aria-hidden="true">&#8594;</span></a>
</div>
</div>
<div class="bb-in bb-d4" style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px">
<span style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.12em; color: #A9BEDD">CA</span>
<code class="bb-chip" style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 14px; padding: 10px 12px; background: #0E2A57; border: 1px solid #3A70C4; border-radius: 4px; color: #F4F7FB; overflow-wrap: anywhere">[CONTRACT ADDRESS — ADD ON LAUNCH DAY]</code>
<button type="button" class="bb-ghost" style="min-height: 44px; padding: 0 14px; background: transparent; color: #F4F7FB; border: 1px solid #3A70C4; border-radius: 4px; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.12em; cursor: pointer" data-copy>COPY</button>
</div>
</div>

<!-- sample drawing -->
<figure class="bb-fig bb-in bb-d2" style="margin: 0; background: #0E2A57; border: 1px solid #3A70C4; padding: 20px; display: flex; flex-direction: column; gap: 0">
<div class="bb-scan" aria-hidden="true"></div>
<svg viewBox="0 0 560 420" role="img" aria-label="Example output: a wiring diagram connecting a microcontroller to an OLED screen and a temperature sensor" style="width: 100%; height: auto; display: block">
<g class="bb-draw" fill="none" stroke="#F4F7FB" stroke-width="2" stroke-linejoin="round">
<rect pathLength="1" x="210" y="140" width="140" height="160"></rect>
<rect pathLength="1" x="400" y="60" width="130" height="80"></rect>
<rect pathLength="1" x="400" y="260" width="130" height="80"></rect>
<rect pathLength="1" x="30" y="180" width="120" height="80"></rect>
</g>
<g class="bb-wires" fill="none" stroke-width="2" stroke-linecap="round">
<path pathLength="1" d="M350 170H375V100H400" stroke="#F4F7FB"></path>
<path pathLength="1" d="M350 190H385V120H400" stroke="#F4F7FB"></path>
<path pathLength="1" d="M350 250H375V290H400" stroke="#F4F7FB"></path>
<path pathLength="1" d="M150 210H210" stroke="#FFB547"></path>
<path pathLength="1" d="M150 230H210" stroke="#A9BEDD"></path>
<path pathLength="1" d="M350 275H385V320H400" stroke="#FFB547"></path>
</g>
<g fill="none" stroke="#FFB547" stroke-width="2.5" stroke-linecap="round">
<path class="bb-flow" d="M150 210H210"></path>
<path class="bb-flow" d="M350 170H375V100H400"></path>
<path class="bb-flow" d="M350 190H385V120H400"></path>
<path class="bb-flow" d="M350 275H385V320H400"></path>
</g>
<g fill="#F4F7FB">
<circle class="bb-node" cx="350" cy="170" r="3.5"></circle><circle class="bb-node" cx="350" cy="190" r="3.5"></circle><circle class="bb-node" cx="350" cy="250" r="3.5"></circle><circle class="bb-node" cx="350" cy="275" r="3.5"></circle>
<circle class="bb-node" cx="210" cy="210" r="3.5"></circle><circle class="bb-node" cx="210" cy="230" r="3.5"></circle>
</g>
<g class="bb-lbl" font-family="IBM Plex Mono, Consolas, monospace" font-size="12" fill="#A9BEDD" letter-spacing="1">
<text x="222" y="164" fill="#F4F7FB" font-size="14">MCU</text>
<text x="222" y="182">3.3 V LOGIC</text>
<text x="412" y="84" fill="#F4F7FB" font-size="14">OLED</text>
<text x="412" y="102">I2C &#183; SDA/SCL</text>
<text x="412" y="284" fill="#F4F7FB" font-size="14">TEMP SENSOR</text>
<text x="412" y="302">DATA &#183; 3.3 V</text>
<text x="42" y="204" fill="#F4F7FB" font-size="14">USB 5 V</text>
<text x="42" y="222">POWER IN</text>
</g>
<g class="bb-wires" stroke="#FFB547" stroke-width="1.5" fill="none"><path pathLength="1" d="M210 330H350M210 322V338M350 322V338"></path></g>
<text class="bb-lbl" x="280" y="356" text-anchor="middle" font-family="IBM Plex Mono, Consolas, monospace" font-size="11" fill="#FFB547" letter-spacing="1">VALIDATED &#183; NO SHORTS &#183; NO PIN CONFLICTS</text>
<g stroke="#F4F7FB" stroke-opacity="0.6" stroke-width="1.2"><path d="M14 14h12M20 8v12M534 14h12M540 8v12M14 406h12M20 400v12M534 406h12M540 400v12"></path></g>
</svg>
<figcaption class="bb-tb" style="display: grid; grid-template-columns: 2fr 1fr 1fr; border: 1px solid rgba(244, 247, 251, 0.7); font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.1em; color: #A9BEDD">
<div style="grid-column: 1 / -1; padding: 8px 12px; border-bottom: 1px solid rgba(244, 247, 251, 0.7)">PROJECT<br><span style="color: #F4F7FB; font-size: 13px">TEMPERATURE MONITOR + OLED</span></div>
<div style="padding: 8px 12px; border-right: 1px solid rgba(244, 247, 251, 0.7)">DWG NO.<br><span style="color: #F4F7FB; font-size: 13px">BB-001</span></div>
<div style="padding: 8px 12px; border-right: 1px solid rgba(244, 247, 251, 0.7)">REV<br><span class="bb-rev" style="color: #FFB547; font-size: 13px">A</span></div>
<div style="padding: 8px 12px">SHEET<br><span style="color: #F4F7FB; font-size: 13px">1 / 1</span></div>
</figcaption>
</figure>
</section>

<!-- HOW IT WORKS -->
<section id="how" class="bb-deep" style="border-top: 1px solid #3A70C4; border-bottom: 1px solid #3A70C4">
<div style="max-width: 1240px; margin: 0 auto; padding: 100px 24px; display: flex; flex-direction: column; gap: 48px">
<div class="bb-reveal" style="display: flex; flex-direction: column; gap: 12px">
<p style="margin: 0; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.14em; color: #A9BEDD; text-transform: uppercase">How it works</p>
<h2 style="margin: 0; font-size: 40px; line-height: 1.15; font-weight: 600">From a sentence to a buildable drawing.</h2>
</div>
<div class="bb-stagger" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 20px">
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 28px; display: flex; flex-direction: column; gap: 14px; background: #14366E">
<span class="bb-step" style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 13px; color: #FFB547; letter-spacing: 0.12em">01 &#8212; DESCRIBE</span>
<h3 style="margin: 0; font-size: 22px; font-weight: 600">Say what you want to make</h3>
<p style="margin: 0; font-size: 16px; line-height: 1.6; color: #A9BEDD">Plain English, plus an optional reference image or sketch. Then refine it in conversation.</p>
</div>
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 28px; display: flex; flex-direction: column; gap: 14px; background: #14366E">
<span class="bb-step" style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 13px; color: #FFB547; letter-spacing: 0.12em">02 &#8212; COMPILE</span>
<h3 style="margin: 0; font-size: 22px; font-weight: 600">AI drafts, rules check</h3>
<p style="margin: 0; font-size: 16px; line-height: 1.6; color: #A9BEDD">An AI turns your idea into a structured design of every part and connection. Rule-based checks then flag shorts, voltage mismatches and pin conflicts, and repair what they can.</p>
</div>
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 28px; display: flex; flex-direction: column; gap: 14px; background: #14366E">
<span class="bb-step" style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 13px; color: #FFB547; letter-spacing: 0.12em">03 &#8212; BUILD</span>
<h3 style="margin: 0; font-size: 22px; font-weight: 600">Get the full package</h3>
<p style="margin: 0; font-size: 16px; line-height: 1.6; color: #A9BEDD">Parts list, interactive wiring diagram, 3D model, product renders and step-by-step assembly instructions. Keep iterating on the same project.</p>
</div>
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 28px; display: flex; flex-direction: column; gap: 14px; background: #14366E">
<span class="bb-step" style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 13px; color: #FFB547; letter-spacing: 0.12em">04 &#8212; LAUNCH</span>
<h3 style="margin: 0; font-size: 22px; font-weight: 600">Launch a coin for it</h3>
<p style="margin: 0; font-size: 16px; line-height: 1.6; color: #A9BEDD">Turn the idea into a pump.fun coin from your own wallet. Bluebuild builds its product page, the coin's website, from your design.</p>
</div>
</div>
</div>
</section>

<!-- WHAT YOU GET -->
<section style="max-width: 1240px; margin: 0 auto; padding: 100px 24px; display: flex; flex-direction: column; gap: 48px">
<div class="bb-reveal" style="display: flex; flex-direction: column; gap: 12px">
<p style="margin: 0; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.14em; color: #A9BEDD; text-transform: uppercase">The output</p>
<h2 style="margin: 0; font-size: 40px; line-height: 1.15; font-weight: 600">Everything on one sheet.</h2>
</div>
<div class="bb-stagger" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px">
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 24px; display: flex; flex-direction: column; gap: 14px; background: rgba(14, 42, 87, 0.6)">
<svg class="bb-icon" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#F4F7FB" stroke-width="1.5" stroke-linecap="round"><path pathLength="1" d="M8 6h12M8 12h12M8 18h12"></path><circle pathLength="1" cx="4" cy="6" r="1"></circle><circle pathLength="1" cx="4" cy="12" r="1"></circle><circle pathLength="1" cx="4" cy="18" r="1"></circle></svg>
<h3 style="margin: 0; font-size: 20px; font-weight: 600">Parts list</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #A9BEDD">Every component, with quantities and where to buy it.</p>
</div>
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 24px; display: flex; flex-direction: column; gap: 14px; background: rgba(14, 42, 87, 0.6)">
<svg class="bb-icon" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#F4F7FB" stroke-width="1.5" stroke-linecap="round"><rect pathLength="1" x="3" y="3" width="6" height="6"></rect><rect pathLength="1" x="15" y="15" width="6" height="6"></rect><path pathLength="1" d="M9 6h6v9"></path></svg>
<h3 style="margin: 0; font-size: 20px; font-weight: 600">Wiring diagram</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #A9BEDD">Interactive schematic showing exactly which pin goes where.</p>
</div>
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 24px; display: flex; flex-direction: column; gap: 14px; background: rgba(14, 42, 87, 0.6)">
<svg class="bb-icon" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#F4F7FB" stroke-width="1.5" stroke-linejoin="round"><path pathLength="1" d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3zM12 12l8-4.5M12 12v9M12 12L4 7.5"></path></svg>
<h3 style="margin: 0; font-size: 20px; font-weight: 600">3D layout</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #A9BEDD">A lightweight 3D view of how the parts fit in the enclosure.</p>
</div>
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 24px; display: flex; flex-direction: column; gap: 14px; background: rgba(14, 42, 87, 0.6)">
<svg class="bb-icon" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#F4F7FB" stroke-width="1.5" stroke-linecap="round"><path pathLength="1" d="M5 4h14v16H5zM9 9h6M9 13h6M9 17h3"></path></svg>
<h3 style="margin: 0; font-size: 20px; font-weight: 600">Build guide</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #A9BEDD">Step-by-step assembly instructions, in order.</p>
</div>
<div class="bb-card" style="border: 1px solid #3A70C4; padding: 24px; display: flex; flex-direction: column; gap: 14px; background: rgba(14, 42, 87, 0.6)">
<svg class="bb-icon" width="36" height="36" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="#FFB547" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path pathLength="1" d="M5 15c-1.5 1.5-2 4-2 6 2 0 4.5-.5 6-2M9 13l2 2M14.5 4.5c2-2 5-2 5.5-1.5s.5 3.5-1.5 5.5L11 16l-3-3 6.5-8.5z"></path><circle pathLength="1" cx="15.5" cy="8.5" r="1.5"></circle></svg>
<h3 style="margin: 0; font-size: 20px; font-weight: 600">Product page &amp; coin</h3>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #A9BEDD">A shareable product page with renders, 3D model, use cases and specs, ready to be your coin's website.</p>
</div>
</div>
<p class="bb-reveal" style="margin: 0; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.1em; color: #A9BEDD">SCOPE: 3.3&#8211;5 V MAKER ELECTRONICS. DESIGNS NEED HUMAN REVIEW BEFORE YOU BUILD.</p>
</section>

<!-- LAUNCHPAD -->
<section id="launch" class="bb-deep" style="border-top: 1px solid #3A70C4; border-bottom: 1px solid #3A70C4">
<div style="max-width: 1240px; margin: 0 auto; padding: 100px 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 60px; align-items: center">
<div class="bb-reveal" style="display: flex; flex-direction: column; gap: 20px">
<p style="margin: 0; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.14em; color: #FFB547; text-transform: uppercase">Launchpad</p>
<h2 style="margin: 0; font-size: 40px; line-height: 1.15; font-weight: 600">Every idea can have a coin.</h2>
<p style="margin: 0; font-size: 17px; line-height: 1.6; color: #A9BEDD">When your design is ready, launch a pump.fun coin for it in a couple of clicks. Bluebuild turns the design into a product page that pitches the idea: renders, a 3D model you can spin, use cases, specs and what's inside.</p>
<ul style="margin: 0; padding: 0; list-style: none; display: flex; flex-direction: column; gap: 14px">
<li style="display: flex; gap: 12px; font-size: 16px; line-height: 1.55"><span style="color: #FFB547; font-family: 'IBM Plex Mono', Consolas, monospace">01</span><span><strong>Your wallet, your coin.</strong> <span style="color: #A9BEDD">You create it on pump.fun yourself. Bluebuild never holds your keys and takes no fee.</span></span></li>
<li style="display: flex; gap: 12px; font-size: 16px; line-height: 1.55"><span style="color: #FFB547; font-family: 'IBM Plex Mono', Consolas, monospace">02</span><span><strong>A product page, built for you.</strong> <span style="color: #A9BEDD">It becomes the coin's website, so buyers see what the product actually is.</span></span></li>
<li style="display: flex; gap: 12px; font-size: 16px; line-height: 1.55"><span style="color: #FFB547; font-family: 'IBM Plex Mono', Consolas, monospace">03</span><span><strong>Bring your community.</strong> <span style="color: #A9BEDD">Add your X and Telegram links, or point the coin at your own site.</span></span></li>
</ul>
<div style="display: flex; flex-wrap: wrap; gap: 12px">
<a class="bb-btn bb-glow" href="/app" style="display: inline-flex; align-items: center; min-height: 48px; padding: 0 24px; background: #FFB547; color: #1A1300; border-radius: 4px; text-decoration: none; font-weight: 600">Design something to launch&#160;<span class="bb-arrow" aria-hidden="true">&#8594;</span></a>
</div>
<p style="margin: 0; max-width: 560px; font-size: 13px; line-height: 1.6; color: #A9BEDD">Coins are created by their designers on pump.fun. Bluebuild takes no fee, doesn't endorse or promote any coin, and can't undo transactions. Crypto is risky; only spend what you can afford to lose.</p>
</div>
<figure class="bb-fig bb-reveal" style="margin: 0; background: #14366E; border: 1px solid #3A70C4; padding: 24px; display: flex; flex-direction: column; gap: 18px" aria-label="Example: a design launched as a coin with its product page">
<div style="display: flex; align-items: center; gap: 14px">
<svg width="56" height="56" viewBox="0 0 56 56" aria-hidden="true"><rect x="1" y="1" width="54" height="54" rx="10" fill="#0E2A57" stroke="#3A70C4"/><rect x="22" y="16" width="12" height="28" rx="5" fill="#C0C6CF"/><rect x="21" y="11" width="14" height="7" rx="2" fill="#1C1F26"/><rect x="24.5" y="12.5" width="7" height="3" rx="1" fill="#FFB547"/></svg>
<div style="display: flex; flex-direction: column; gap: 4px">
<span style="font-size: 18px; font-weight: 600">Smart Sip Bottle</span>
<span style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 13px; color: #FFB547">$SIP &#183; LIVE ON PUMP.FUN</span>
</div>
</div>
<p style="margin: 0; font-size: 15px; line-height: 1.6; color: #F4F7FB">Know exactly how cold your water is, at a glance.</p>
<div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px">
<div style="border: 1px solid #3A70C4; padding: 10px; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.08em; color: #A9BEDD">RENDERS<br><span style="color: #F4F7FB; font-size: 13px">3 VIEWS</span></div>
<div style="border: 1px solid #3A70C4; padding: 10px; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.08em; color: #A9BEDD">3D MODEL<br><span style="color: #F4F7FB; font-size: 13px">X-RAY</span></div>
<div style="border: 1px solid #3A70C4; padding: 10px; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.08em; color: #A9BEDD">USE CASES<br><span style="color: #F4F7FB; font-size: 13px">3 LISTED</span></div>
</div>
<div style="display: flex; flex-wrap: wrap; gap: 10px">
<span style="display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; background: #FFB547; color: #1A1300; border-radius: 4px; font-weight: 600; font-size: 14px">View on pump.fun</span>
<span style="display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border: 1px solid #3A70C4; border-radius: 4px; font-size: 14px">Product page</span>
<span style="display: inline-flex; align-items: center; min-height: 40px; padding: 0 16px; border: 1px solid #3A70C4; border-radius: 4px; font-size: 14px">X</span>
</div>
<figcaption style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.1em; color: #A9BEDD">EXAMPLE &#183; FEE TO BLUEBUILD: 0</figcaption>
</figure>
</div>
</section>

<!-- DOCS -->
<section id="docs" class="bb-deep" style="border-top: 1px solid #3A70C4; border-bottom: 1px solid #3A70C4">
<div style="max-width: 1240px; margin: 0 auto; padding: 100px 24px; display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 60px; align-items: center">
<div class="bb-reveal" style="display: flex; flex-direction: column; gap: 20px">
<p style="margin: 0; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.14em; color: #A9BEDD; text-transform: uppercase">Docs</p>
<h2 style="margin: 0; font-size: 40px; line-height: 1.15; font-weight: 600">Open source. Read every line.</h2>
<p style="margin: 0; font-size: 17px; line-height: 1.6; color: #A9BEDD">Bluebuild's full code is public on GitHub. It is built on Form, the open-source AI hardware design workspace by CAID Technologies, and shared under the same MPL-2.0 licence.</p>
<div style="display: flex; flex-wrap: wrap; gap: 12px">
<a class="bb-btn" href="[GITHUB REPO LINK]" style="display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 22px; background: #F4F7FB; color: #0E2A57; border-radius: 4px; text-decoration: none; font-weight: 600">
<svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5"></path></svg>
View the code on GitHub</a>
<a class="bb-ghost" href="[GITHUB REPO LINK]/tree/main/docs" style="display: inline-flex; align-items: center; min-height: 48px; padding: 0 22px; border: 1px solid #3A70C4; border-radius: 4px; text-decoration: none">Read the docs</a>
</div>
</div>
<pre class="bb-reveal bb-tblock" style="margin: 0; background: #14366E; border: 1px solid #3A70C4; border-radius: 4px; padding: 24px; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 14px; line-height: 1.8; color: #F4F7FB; overflow-x: auto"><span style="color: #A9BEDD"># run Bluebuild on your own machine</span>
git clone [GITHUB REPO LINK].git
cd bluebuild
./scripts/development/dev.sh

<span style="color: #A9BEDD"># then open</span>
<span style="color: #FFB547">http://localhost:3000</span> <span class="bb-caret" aria-hidden="true"></span></pre>
</div>
</section>

<!-- TOKEN -->
<section id="token" class="bb-reveal" style="max-width: 1240px; margin: 0 auto; padding: 100px 24px; display: flex; flex-direction: column; gap: 28px; align-items: flex-start">
<p style="margin: 0; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.14em; color: #A9BEDD; text-transform: uppercase">Token</p>
<h2 style="margin: 0; font-size: 40px; line-height: 1.15; font-weight: 600">$BLUEBUILD on pump.fun</h2>
<div style="display: flex; flex-wrap: wrap; align-items: center; gap: 10px">
<span style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.12em; color: #A9BEDD">CA</span>
<code class="bb-chip" style="font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 15px; padding: 12px 14px; background: #0E2A57; border: 1px solid #3A70C4; border-radius: 4px; overflow-wrap: anywhere">[CONTRACT ADDRESS — ADD ON LAUNCH DAY]</code>
<button type="button" class="bb-ghost" style="min-height: 44px; padding: 0 14px; background: transparent; color: #F4F7FB; border: 1px solid #3A70C4; border-radius: 4px; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.12em; cursor: pointer" data-copy>COPY</button>
</div>
<div style="display: flex; flex-wrap: wrap; gap: 12px">
<a class="bb-btn bb-glow" href="[PUMP.FUN LINK]" style="display: inline-flex; align-items: center; min-height: 48px; padding: 0 24px; background: #FFB547; color: #1A1300; border-radius: 4px; text-decoration: none; font-weight: 600">Buy on pump.fun</a>
<a class="bb-ghost bb-x" href="https://x.com/bluebuild_AI" style="display: inline-flex; align-items: center; gap: 10px; min-height: 48px; padding: 0 22px; border: 1px solid #3A70C4; border-radius: 4px; text-decoration: none">
<svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 4l16 16M20 4L4 20"></path></svg>
Follow @bluebuild_AI</a>
</div>
<p style="margin: 0; max-width: 640px; font-size: 14px; line-height: 1.6; color: #A9BEDD">$BLUEBUILD is a community memecoin. It is not a share in Bluebuild, gives no rights to the software or any revenue, and carries no promise of returns. Only buy what you can afford to lose. It is separate from the coins people launch for their own designs.</p>
</section>

<!-- FOOTER -->
<footer class="bb-deep" style="border-top: 1px solid #3A70C4">
<div class="bb-reveal" style="max-width: 1240px; margin: 0 auto; padding: 60px 24px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-end; gap: 40px">
<div style="display: flex; flex-direction: column; gap: 16px; max-width: 520px">
<div style="align-self:flex-start"><svg role="img" aria-label="bluebuild" style="height:26px;width:auto;display:block" xmlns="http://www.w3.org/2000/svg" viewBox="-4 -68 344 72" ><g fill="none" stroke="#F4F7FB" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"><path d="M0 -64 V0"/><circle cx="20" cy="-20" r="20"/><path d="M52 -64 V0"/><path d="M64 -40 V-20 A20 20 0 0 0 104 -20 V-40 M104 -40 V0"/><path d="M116 -20 H156 A20 20 0 1 0 150.14 -5.86"/><path d="M168 -64 V0"/><circle cx="188" cy="-20" r="20"/><path d="M220 -40 V-20 A20 20 0 0 0 260 -20 V-40 M260 -40 V0"/><path d="M272 -40 V0"/><circle cx="272" cy="-54" r="4" fill="#F4F7FB" stroke="none"/><path d="M284 -64 V0"/><circle cx="316" cy="-20" r="20"/><path d="M336 -64 V0"/></g></svg></div>
<p style="margin: 0; font-size: 14px; line-height: 1.6; color: #A9BEDD">Bluebuild is an independent open-source project. Not affiliated with Blueprint.io. Built on Form by CAID Technologies (MPL-2.0).</p>
<div class="bb-nav" style="display: flex; flex-wrap: wrap; gap: 24px; font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 12px; letter-spacing: 0.12em">
<a href="[GITHUB REPO LINK]">GITHUB</a>
<a href="https://x.com/bluebuild_AI">X / TWITTER</a>
<a href="[PUMP.FUN LINK]">PUMP.FUN</a>
</div>
</div>
<div class="bb-tblock" style="display: grid; grid-template-columns: 2fr 1fr 1fr; min-width: 300px; border: 1px solid rgba(244, 247, 251, 0.7); font-family: 'IBM Plex Mono', Consolas, monospace; font-size: 11px; letter-spacing: 0.1em; color: #A9BEDD">
<div style="grid-column: 1 / -1; padding: 8px 12px; border-bottom: 1px solid rgba(244, 247, 251, 0.7)">PROJECT<br><span style="color: #F4F7FB; font-size: 13px">BLUEBUILD &#8212; AI HARDWARE DESIGN</span></div>
<div style="padding: 8px 12px; border-right: 1px solid rgba(244, 247, 251, 0.7)">DWG NO.<br><span style="color: #F4F7FB; font-size: 13px">BB-001</span></div>
<div style="padding: 8px 12px; border-right: 1px solid rgba(244, 247, 251, 0.7)">REV<br><span style="color: #FFB547; font-size: 13px">A</span></div>
<div style="padding: 8px 12px">SHEET<br><span style="color: #F4F7FB; font-size: 13px">1 / 1</span></div>
</div>
</div>
</footer>

</div>
<script>
(function () {
  // ---- Fill these in on launch day ----
  var CONTRACT_ADDRESS = "[CONTRACT ADDRESS — ADD ON LAUNCH DAY]";
  // --------------------------------------
  document.querySelectorAll("code.bb-chip").forEach(function (el) { el.textContent = CONTRACT_ADDRESS; });

  var examples = [
    "A temperature monitor with a small OLED screen",
    "A plant moisture alarm that beeps when the soil is dry",
    "A motion-triggered night light for the hallway",
    "A desk lamp with a touch dimmer"
  ];
  var input = document.getElementById("bb-prompt");
  var i = 0;
  setInterval(function () {
    if (document.activeElement === input || input.value) return;
    i = (i + 1) % examples.length;
    input.setAttribute("placeholder", examples[i]);
  }, 3200);

  // "Draw it" opens the app with the typed idea.
  var draw = document.getElementById("bb-draw");
  if (draw) draw.addEventListener("click", function (e) {
    var base = draw.getAttribute("href");
    var idea = input.value.trim();
    if (idea) { e.preventDefault(); window.location.href = base + "?prompt=" + encodeURIComponent(idea); }
  });

  input.addEventListener("keydown", function (e) { if (e.key === "Enter" && draw) draw.click(); });

  document.querySelectorAll("button[data-copy]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var done = function () {
        btn.textContent = "COPIED \u2713";
        setTimeout(function () { btn.textContent = "COPY"; }, 1600);
      };
      if (navigator.clipboard) navigator.clipboard.writeText(CONTRACT_ADDRESS).then(done, done); else done();
    });
  });
})();
</script>
</body>
</html>
`;
