import { useId } from 'react';

interface Option<T> {
  value: T;
  label: string;
}

interface Props<T> {
  label: string;
  options: Array<Option<T>>;
  /** One value for single choice, an array for multi-select. */
  value: T | T[];
  onChange: (value: T) => void;
  hint?: string;
  /** Keep the label for screen readers only (when a heading already names the group). */
  hideLabel?: boolean;
  /** Narrower buttons for short labels such as numbers, so a long row wraps neatly on mobile. */
  compact?: boolean;
}

/**
 * Buttons with aria-pressed for Remote / Hybrid / On-site, Yes / No and matches per day.
 * Selected state uses border, colour and weight, so colour is never the only signal.
 */
export function OptionToggle<T extends string | number>({ label, options, value, onChange, hint, hideLabel, compact }: Props<T>) {
  const id = useId();
  const selected = (v: T) => (Array.isArray(value) ? value.includes(v) : value === v);
  return (
    <div className="fld">
      <span className={hideLabel ? 'sr' : 'lbl'} id={`${id}-l`}>
        {label}
      </span>
      {hint && (
        <p className="sm mut" id={`${id}-h`}>
          {hint}
        </p>
      )}
      <div className="h wrap g8" role="group" aria-labelledby={`${id}-l`} aria-describedby={hint ? `${id}-h` : undefined}>
        {options.map((o) => (
          <button key={String(o.value)} type="button" className={compact ? 'opt compact' : 'opt'} aria-pressed={selected(o.value)} onClick={() => onChange(o.value)}>
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
