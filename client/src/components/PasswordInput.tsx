import { useId, useState, type InputHTMLAttributes, type ReactNode } from 'react';

interface Props extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label: string;
  /** Shown on the label row, on the right (for example "Forgot password?"). */
  labelAside?: ReactNode;
  hint?: string;
  error?: string;
  /** Red border without a message under this field (the message is shown elsewhere). */
  invalid?: boolean;
}

/** Password field with a Show/Hide text button inside it (44px hit area, aria-pressed). */
export function PasswordInput({ label, labelAside, hint, error, invalid, id, className, ...rest }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  const helpId = `${fieldId}-help`;
  const [shown, setShown] = useState(false);
  const bad = Boolean(error) || invalid;
  return (
    <div className="fld">
      {labelAside ? (
        <div className="h sp g16">
          <label className="lbl" htmlFor={fieldId}>
            {label}
          </label>
          {labelAside}
        </div>
      ) : (
        <label className="lbl" htmlFor={fieldId}>
          {label}
        </label>
      )}
      <div className="pw">
        <input
          id={fieldId}
          type={shown ? 'text' : 'password'}
          className={['in', className].filter(Boolean).join(' ')}
          aria-invalid={bad ? true : undefined}
          aria-describedby={error || hint ? helpId : undefined}
          {...rest}
        />
        <button
          type="button"
          className="btn bt"
          aria-pressed={shown}
          aria-label={shown ? 'Hide password' : 'Show password'}
          onClick={() => setShown((s) => !s)}
        >
          {shown ? 'Hide' : 'Show'}
        </button>
      </div>
      {error ? (
        <p id={helpId} className="sm err-t" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p id={helpId} className="xs mut">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
