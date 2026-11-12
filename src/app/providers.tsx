'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from './lib/supabase/client';

export function Providers({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  useEffect(() => {
    let identity: string | null = null;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const nextIdentity = session
        ? `${session.user.id}:${String(session.user.app_metadata.role)}`
        : null;
      // Compensation must not remain cached for another user or role on a shared browser.
      if (event === 'SIGNED_OUT' || (identity !== null && identity !== nextIdentity)) {
        queryClient.clear();
      }
      identity = nextIdentity;
    });
    return () => subscription.unsubscribe();
  }, [queryClient]);

  // Staff screens gate their own queries on an authenticated account. Public
  // invitation screens must be able to render even while Auth is unreachable.
  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
