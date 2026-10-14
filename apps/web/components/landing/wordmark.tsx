/** The drawn "bluebuild" wordmark (monoline, matching the logo). */
export function Wordmark({ height = 28, title = "bluebuild" }: { height?: number; title?: string }) {
  return (
    <svg role="img" aria-label={title} style={{ height, width: "auto", display: "block" }} viewBox="-4 -68 344 72">
      <g fill="none" stroke="var(--craft-ink)" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round">
        <path d="M0 -64 V0" />
        <circle cx="20" cy="-20" r="20" />
        <path d="M52 -64 V0" />
        <path d="M64 -40 V-20 A20 20 0 0 0 104 -20 V-40 M104 -40 V0" />
        <path d="M116 -20 H156 A20 20 0 1 0 150.14 -5.86" />
        <path d="M168 -64 V0" />
        <circle cx="188" cy="-20" r="20" />
        <path d="M220 -40 V-20 A20 20 0 0 0 260 -20 V-40 M260 -40 V0" />
        <path d="M272 -40 V0" />
        <circle cx="272" cy="-54" r="4" fill="var(--craft-ink)" stroke="none" />
        <path d="M284 -64 V0" />
        <circle cx="316" cy="-20" r="20" />
        <path d="M336 -64 V0" />
      </g>
      <path d="M30 -46 L44 -60" stroke="var(--craft-amber)" strokeWidth="6" strokeLinecap="round" />
    </svg>
  );
}
