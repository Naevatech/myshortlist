import { useEffect, useRef } from 'react';

/** Sets the document title for the page. */
export function useTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · Shortlist` : 'Shortlist';
  }, [title]);
}

/** Moves focus to the page heading when `key` changes (used for steps within one route). */
export function useFocusHeading(key: unknown) {
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    focusHeading();
  }, [key]);
}

export function focusHeading() {
  let tries = 0;
  const attempt = () => {
    // Never pull focus away from a field the user has already started using.
    const active = document.activeElement;
    if (active && active !== document.body && active.matches('input, textarea, select, [contenteditable="true"]')) return;
    const h = document.querySelector<HTMLElement>('main h1, h1');
    if (h) {
      h.setAttribute('tabindex', '-1');
      h.focus({ preventScroll: false });
    } else if (tries++ < 20) {
      setTimeout(attempt, 50);
    }
  };
  requestAnimationFrame(attempt);
}

export function newIdempotencyKey(): string {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
