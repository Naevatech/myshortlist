// Production builds call the API on the same domain unless VITE_API_URL says otherwise.
const BASE = (import.meta.env.VITE_API_URL ?? (import.meta.env.PROD ? '' : 'http://localhost:4000')).replace(/\/$/, '');

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

/** Absolute URL for links the browser opens itself (PDFs, downloads, Google sign-in). */
export const apiUrl = (path: string) => `${BASE}${path}`;

let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  refreshing ??= fetch(apiUrl('/api/auth/refresh'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'X-Requested-With': 'shortlist' },
  })
    .then((r) => r.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
}

async function request<T>(path: string, opts: RequestOptions = {}, canRetry = true): Promise<T> {
  const isForm = opts.body instanceof FormData;
  let res: Response;
  try {
    res = await fetch(apiUrl(`/api${path}`), {
      method: opts.method ?? 'GET',
      credentials: 'include',
      headers: {
        'X-Requested-With': 'shortlist',
        ...(opts.body !== undefined && !isForm ? { 'Content-Type': 'application/json' } : {}),
      },
      body: opts.body === undefined ? undefined : isForm ? (opts.body as FormData) : JSON.stringify(opts.body),
    });
  } catch {
    throw new ApiError(0, 'network', 'Check your connection and try again.');
  }

  // The access token is short-lived: refresh once and retry.
  if (res.status === 401 && canRetry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return request<T>(path, opts, false);
  }

  const text = await res.text();
  const data = text ? JSON.parse(text) : undefined;
  if (!res.ok) {
    throw new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? 'Something went wrong. Try again.');
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
};
