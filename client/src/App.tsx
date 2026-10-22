import { Suspense, useEffect, useRef, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { AppRoutes } from './routes';
import { focusHeading } from './lib/hooks';
import { ApiError } from './lib/api';

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 15_000,
        refetchOnWindowFocus: false,
        retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 1,
      },
      mutations: { retry: false },
    },
  });
}

/** Moves focus to the page heading after each route change, so screen reader users hear where they are. */
function RouteFocus() {
  const { pathname } = useLocation();
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    window.scrollTo(0, 0);
    focusHeading();
  }, [pathname]);
  return null;
}

export function App({ client }: { client?: QueryClient }) {
  const [queryClient] = useState(() => client ?? createQueryClient());
  return (
    <QueryClientProvider client={queryClient}>
      <RouteFocus />
      <Suspense fallback={<div className="shell" aria-busy="true" />}>
        <AppRoutes />
      </Suspense>
    </QueryClientProvider>
  );
}
