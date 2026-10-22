import { useId, type SelectHTMLAttributes } from 'react';

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: Array<{ value: string | number; label: string }>;
}

export function Select({ label, options, id, ...rest }: Props) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className="fld">
      <label className="lbl" htmlFor={fieldId}>
        {label}
      </label>
      <select id={fieldId} className="in" {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
