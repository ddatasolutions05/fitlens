import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState, type ReactNode } from 'react';

import '@/features/logs/hooks';
import '@/features/meals/hooks';

import { isNetworkError } from './net';
import { startQueue } from './offline-queue';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        gcTime: 24 * 60 * 60 * 1000,
        retry: (count, err) => (isNetworkError(err) ? count < 2 : false),
        refetchOnWindowFocus: true,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

export function QueryProvider({ children }: { children: ReactNode }) {
  const [client] = useState(makeQueryClient);
  useEffect(() => startQueue(), []);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
