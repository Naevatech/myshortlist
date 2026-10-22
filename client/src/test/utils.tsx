import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi } from 'vitest';
import { App, createQueryClient } from '../App';

type Handler = (body: unknown, url: URL) => unknown;
export type Routes = Record<string, Handler | unknown>;

export interface FetchCall {
  method: string;
  path: string;
  body: unknown;
}

/**
 * Mocks fetch with "METHOD /path" keys (path without /api, query string included when present in the key).
 * A value that is an Error-like { status, error } returns that status.
 */
export function mockApi(routes: Routes) {
  const calls: FetchCall[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input.toString());
    const method = (init?.method ?? 'GET').toUpperCase();
    const path = url.pathname.replace(/^\/api/, '');
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : init?.body;
    calls.push({ method, path: path + url.search, body });
    const key = [`${method} ${path}${url.search}`, `${method} ${path}`].find((k) => k in routes);
    if (!key) return new Response(JSON.stringify({ error: { code: 'not_found', message: 'Not found.' } }), { status: 404 });
    const value = routes[key];
    const result = typeof value === 'function' ? (value as Handler)(body, url) : value;
    if (result && typeof result === 'object' && 'status' in result && 'error' in result) {
      const r = result as { status: number; error: unknown };
      return new Response(JSON.stringify({ error: r.error }), { status: r.status });
    }
    return new Response(result === undefined ? '' : JSON.stringify(result), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

export const ME = {
  id: 'u1',
  email: 'sam.carter@example.com',
  name: 'Sam Carter',
  emailVerified: true,
  onboardingComplete: true,
  signInMethod: 'password',
  hasPassword: true,
  passwordChangedAt: '2026-09-03T10:00:00Z',
};
export const CONFIG = { googleEnabled: false, undoWindowSeconds: 10, otpTtlMinutes: 10, maxCvSizeMb: 5, minPasswordLength: 8, passwordResetTtlMinutes: 30 };

export function renderAt(path: string) {
  const client = createQueryClient();
  client.setDefaultOptions({ queries: { retry: false, staleTime: 0 } });
  return render(
    <MemoryRouter initialEntries={[path]} future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <App client={client} />
    </MemoryRouter>,
  );
}

export const job = (over: Record<string, unknown> = {}) => ({
  id: 'j1',
  title: 'Full-Stack Developer',
  company: 'Northfield Labs',
  location: 'UK',
  workMode: 'remote',
  workModeDetail: null,
  salaryMin: 50000,
  salaryMax: 60000,
  applyRoute: 'email',
  postedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
  ...over,
});
