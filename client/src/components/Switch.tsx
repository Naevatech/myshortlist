interface Props {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelledBy?: string;
  label?: string;
  describedBy?: string;
  disabled?: boolean;
}

/** 44x24 track inside a 44x44 hit area; the knob moves 20px. */
export function Switch({ checked, onChange, labelledBy, label, describedBy, disabled }: Props) {
  return (
    <button
      type="button"
      className="sw"
      role="switch"
      aria-checked={checked}
      aria-labelledby={labelledBy}
      aria-label={labelledBy ? undefined : label}
      aria-describedby={describedBy}
      disabled={disabled}
      onClick={() => onChange(!checked)}
    >
      <i />
    </button>
  );
}
