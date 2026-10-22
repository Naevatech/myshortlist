import type { CSSProperties } from 'react';

/** Soft grey bar with a slow pulse. Decorative: wrap groups in aria-busy with a visually hidden label. */
export function Skeleton({ width = '100%', height = 12, style }: { width?: number | string; height?: number; style?: CSSProperties }) {
  return <span className="sk" style={{ width, height, ...style }} aria-hidden="true" />;
}
