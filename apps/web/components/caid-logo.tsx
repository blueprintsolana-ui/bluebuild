type CaidLogoProps = {
  className?: string;
  sizes?: string;
};

/** Bluebuild mark: a monoline lowercase "b" (stem + perfect circle) with an amber measure tick. */
export default function CaidLogo({ className = "h-5 w-9" }: CaidLogoProps) {
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center align-middle ${className}`} aria-hidden="true">
      <svg viewBox="-6 -70 64 76" className="h-full w-auto" fill="none">
        <g stroke="currentColor" strokeWidth="7" strokeLinecap="round">
          <path d="M0 -64V0" />
          <circle cx="20" cy="-20" r="20" />
        </g>
        <path d="M34 -34L48 -48" stroke="#FFB547" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
