import type { ReactNode } from 'react';

/** Same shape as EmptyState, announced to screen readers. */
export function ErrorState({ title, helper, action }: { title: string; helper?: string; action?: ReactNode }) {
  return (
    <div className="v g24 fade-in" style={{ maxWidth: 520, paddingTop: 16 }} role="alert">
      <div className="v g8">
        <p className="t18">{title}</p>
        {helper && <p className="mut">{helper}</p>}
      </div>
      {action}
    </div>
  );
}
