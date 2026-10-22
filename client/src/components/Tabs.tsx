import { useRef, type KeyboardEvent, type ReactNode } from 'react';

interface Props<T extends string> {
  label: string;
  idPrefix: string;
  tabs: Array<{ id: T; label: string }>;
  value: T;
  onChange: (id: T) => void;
  /** Content to the right of the tab row (for example Edit). */
  aside?: ReactNode;
}

export const tabId = (prefix: string, id: string) => `${prefix}-tab-${id}`;
export const panelId = (prefix: string, id: string) => `${prefix}-panel-${id}`;

/** ARIA tabs with arrow-key, Home and End support. Panels use panelId() and aria-labelledby tabId(). */
export function Tabs<T extends string>({ label, idPrefix, tabs, value, onChange, aside }: Props<T>) {
  const refs = useRef<Array<HTMLButtonElement | null>>([]);

  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const last = tabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[
      e.key as 'ArrowRight' | 'ArrowLeft' | 'Home' | 'End'
    ];
    if (next === undefined) return;
    e.preventDefault();
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };

  const list = (
    <div className="tabs" role="tablist" aria-label={label} style={aside ? { borderBottom: 0 } : undefined}>
      {tabs.map((t, i) => (
        <button
          key={t.id}
          ref={(el) => {
            refs.current[i] = el;
          }}
          type="button"
          role="tab"
          className="tab"
          id={tabId(idPrefix, t.id)}
          aria-selected={t.id === value}
          aria-controls={panelId(idPrefix, t.id)}
          tabIndex={t.id === value ? 0 : -1}
          onClick={() => onChange(t.id)}
          onKeyDown={(e) => onKeyDown(e, i)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );

  if (!aside) return list;
  return (
    <div className="h sp" style={{ borderBottom: '1px solid var(--line)' }}>
      {list}
      {aside}
    </div>
  );
}
