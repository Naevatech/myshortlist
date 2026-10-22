import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

// Pages load lazily; the first load of each can take more than the 1s default in a full run.
configure({ asyncUtilTimeout: 10_000 });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

// jsdom has no scrollTo or matchMedia.
window.scrollTo = () => {};
