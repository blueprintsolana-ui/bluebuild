const DIGITS = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * A number on rolling drums, like a mechanical counter: when it changes, each digit wheel turns
 * to its new value. Reduced motion snaps straight there (see `.craft-counter` in craft.css).
 */
export function MechanicalCounter({ value, className = "" }: { value: number; className?: string }) {
  const text = String(Math.max(0, Math.floor(value)));
  return (
    <span className={`craft-counter ${className}`} aria-label={text} role="img">
      {/* Key wheels from the right so the ones digit keeps its drum when the number grows. */}
      {text.split("").map((digit, index) => (
        <span key={text.length - index} className="craft-counter__wheel" aria-hidden="true">
          <span className="craft-counter__drum" style={{ transform: `translateY(-${Number(digit) * 10}%)` }}>
            {DIGITS.map((face) => (
              <span key={face}>{face}</span>
            ))}
          </span>
        </span>
      ))}
    </span>
  );
}
