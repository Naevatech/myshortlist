import type { StatusTone } from '../lib/format';

const DOT: Record<StatusTone, string> = { ok: 'dot d-ok', grey: 'dot', acc: 'dot d-acc', off: 'dot d-off', warn: 'dot d-warn' };

/** An 8px dot and the status word. The word is always shown. */
export function StatusDot({ label, tone, className }: { label: string; tone: StatusTone; className?: string }) {
  return (
    <span className={['st', className].filter(Boolean).join(' ')}>
      <span className={DOT[tone]} aria-hidden="true" />
      {label}
    </span>
  );
}
