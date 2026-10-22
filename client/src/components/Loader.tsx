import { useEffect, useState } from 'react';

interface Props {
  /** Announced once to screen readers. */
  label: string;
  /** Short lines shown in turn while waiting. */
  steps?: string[];
  /** Milliseconds per step. */
  every?: number;
}

/**
 * A spinner with short status lines that change while the user waits. Movement stops when the user prefers
 * reduced motion; the lines still change. Screen readers hear the label once, not every step.
 */
export function Loader({ label, steps = [], every = 1800 }: Props) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (steps.length < 2) return;
    const t = setInterval(() => setI((n) => Math.min(n + 1, steps.length - 1)), every);
    return () => clearInterval(t);
  }, [steps.length, every]);

  return (
    <div className="loader">
      <span className="spin" aria-hidden="true" />
      <div className="v g4">
        <p className="sr" role="status">
          {label}
        </p>
        <p key={i} className="fade-in" aria-hidden="true">
          {steps[i] ?? label}
        </p>
        {steps.length > 1 && (
          <div className="steps" aria-hidden="true">
            {steps.map((_, n) => (
              <i key={n} className={n <= i ? 'on' : undefined} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
