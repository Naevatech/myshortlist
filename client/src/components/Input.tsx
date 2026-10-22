import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: ReactNode;
  /** Grey helper line under the field. */
  hint?: ReactNode;
  /** Amber state: the helper says what is needed. */
  warning?: string;
  /** Error message (red), announced to screen readers. */
  error?: string;
}

function Helper({ id, hint, warning, error }: { id: string } & Omit<FieldProps, 'label'>) {
  if (error)
    return (
      <p id={id} className="sm err-t" role="alert">
        {error}
      </p>
    );
  if (warning)
    return (
      <p id={id} className="xs warn-t">
        {warning}
      </p>
    );
  if (hint)
    return (
      <p id={id} className="xs mut">
        {hint}
      </p>
    );
  return null;
}

export function Input({ label, hint, warning, error, className, id, ...rest }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  const helpId = `${fieldId}-help`;
  const hasHelp = Boolean(error || warning || hint);
  return (
    <div className="fld">
      <label className="lbl" htmlFor={fieldId}>
        {label}
      </label>
      <input
        id={fieldId}
        className={['in', warning && !error ? 'warn' : '', className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasHelp ? helpId : undefined}
        {...rest}
      />
      <Helper id={helpId} hint={hint} warning={warning} error={error} />
    </div>
  );
}

export function Textarea({ label, hint, warning, error, className, id, ...rest }: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  const helpId = `${fieldId}-help`;
  const hasHelp = Boolean(error || warning || hint);
  return (
    <div className="fld">
      <label className="lbl" htmlFor={fieldId}>
        {label}
      </label>
      <textarea
        id={fieldId}
        className={['in', warning && !error ? 'warn' : '', className].filter(Boolean).join(' ')}
        aria-invalid={error ? true : undefined}
        aria-describedby={hasHelp ? helpId : undefined}
        {...rest}
      />
      <Helper id={helpId} hint={hint} warning={warning} error={error} />
    </div>
  );
}
