'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { supabase } from './lib/supabase/client';
import { Loader2 } from 'lucide-react';

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

  const [authReady, setAuthReady] = useState(false);

  useEffect(() => {
    // Wait for Supabase to restore the session from storage before rendering the app.
    // This prevents useQuery calls from firing prematurely before auth is fully ready.
    void supabase.auth.getSession().then(() => {
      setAuthReady(true);
    });
  }, []);

  if (!authReady) {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-[#e8e8e8] text-gray-700"
        aria-busy="true"
      >
        <div className="flex items-center gap-3" role="status">
          <Loader2 className="h-5 w-5 animate-spin text-[#007BC1]" aria-hidden="true" />
          <span className="text-sm font-medium">Restoring your secure session…</span>
        </div>
      </main>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  );
}
