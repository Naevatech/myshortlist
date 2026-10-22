import type { ReactNode } from 'react';

/** One short sentence, an optional grey helper line and one action. No illustration. */
export function EmptyState({ title, helper, action }: { title: string; helper?: string; action?: ReactNode }) {
  return (
    <div className="v g24 fade-in" style={{ maxWidth: 520, paddingTop: 16 }}>
      <div className="v g8">
        <p className="t18">{title}</p>
        {helper && <p className="mut">{helper}</p>}
      </div>
      {action}
    </div>
  );
}
