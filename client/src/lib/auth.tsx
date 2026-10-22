import type { ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useLocation } from 'react-router-dom';
import { api, ApiError } from './api';
import type { AppConfig, Me } from './types';

/** The signed-in user, or null when signed out. */
export function useMe() {
  return useQuery({
    queryKey: ['me'],
    queryFn: async () => {
      try {
        return await api.get<Me>('/me');
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 60_000,
    retry: false,
  });
}

export function useConfig() {
  return useQuery({
    queryKey: ['config'],
    queryFn: () => api.get<AppConfig>('/config'),
    staleTime: Infinity,
  });
}

/** Where to return after sign-in. Only paths inside the app are accepted, never another site. */
export function safeNext(next: string | null | undefined): string | null {
  return next && next.startsWith('/') && !next.startsWith('//') && !next.startsWith('/\\') ? next : null;
}

/** Remembered between Sign up and Verify, in case the page is reloaded. */
export const EMAIL_KEY = 'sl_email';
export function rememberEmail(email: string) {
  try {
    sessionStorage.setItem(EMAIL_KEY, email);
  } catch {
    /* storage can be unavailable; router state still carries the email */
  }
}
export function rememberedEmail(): string | null {
  try {
    return sessionStorage.getItem(EMAIL_KEY);
  } catch {
    return null;
  }
}

const Blank = () => <div aria-busy="true" className="shell" />;

/**
 * Gate for signed-in pages. Signed-out visitors go to /signin?next=…, unverified accounts to /verify, and pages
 * that need onboarding send unfinished users to it.
 */
export function RequireAuth({ children, onboarded = true }: { children: ReactNode; onboarded?: boolean }) {
  const { data: me, isPending, isError } = useMe();
  const location = useLocation();
  if (isPending) return <Blank />;
  if (isError || !me) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  if (!me.emailVerified) return <Navigate to="/verify" replace state={{ email: me.email }} />;
  if (onboarded && !me.onboardingComplete) return <Navigate to="/onboarding" replace />;
  return <>{children}</>;
}

/**
 * Welcome, Sign in, Sign up, Forgot and Signed out: a signed-in user goes to Today instead, or to the page in
 * `?next=` (so signing in returns you to where you were going).
 */
export function PublicOnly({ children }: { children: ReactNode }) {
  const { data: me, isPending } = useMe();
  const location = useLocation();
  if (isPending) return <Blank />;
  if (me) {
    if (!me.emailVerified) return <Navigate to="/verify" replace state={{ email: me.email }} />;
    const next = safeNext(new URLSearchParams(location.search).get('next'));
    return <Navigate to={next ?? '/today'} replace />;
  }
  return <>{children}</>;
}
