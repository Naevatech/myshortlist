import type { ReactNode } from 'react';

/**
 * Sticky bar at the bottom of the content column. DOM order is primary, secondary, note, so keyboard users
 * meet the primary action first. Mobile stacks them; desktop lays them out right-to-left in one row.
 */
export function ActionBar({ primary, secondary, note }: { primary: ReactNode; secondary?: ReactNode; note?: ReactNode }) {
  return (
    <div className="bar">
      {primary}
      {secondary && <div className="sec">{secondary}</div>}
      {note && (
        <p className="xs mut note" aria-live="polite">
          {note}
        </p>
      )}
    </div>
  );
}
