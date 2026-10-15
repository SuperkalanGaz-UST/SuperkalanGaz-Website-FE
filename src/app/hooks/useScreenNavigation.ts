'use client';

import { useCallback, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import type { Role } from '../lib/auth';
import { resolveStaffRoute, staffScreenPath } from '../lib/staffRoutes';

export function useScreenNavigation(role: Role) {
  const pathname = usePathname();
  const router = useRouter();
  const route = resolveStaffRoute(pathname);
  const activeScreen = route?.role === role ? route.screen : '';

  const navigate = useCallback((screen: string) => {
    const href = staffScreenPath(role, screen);
    if (href && href !== pathname) router.push(href);
  }, [pathname, role, router]);

  // Existing report/detail controls publish screen IDs. Keep their navigation
  // working while sharing the same URL history as sidebar links.
  useEffect(() => {
    const handleNavigate = (event: Event) => {
      const screen: unknown = (event as CustomEvent<unknown>).detail;
      if (typeof screen === 'string') navigate(screen);
    };
    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, [navigate]);

  return [activeScreen, navigate] as const;
}
