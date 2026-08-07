'use client';

import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { Login } from './components/Login';
import { LogoutConfirmationDialog } from './components/LogoutConfirmationDialog';
import { PersonaSwitcher } from './components/PersonaSwitcher';
import { AccountProvider } from './contexts/AccountContext';
import { Account, accountFromUser, DEMO_ACCOUNTS, signIn, signOut } from './lib/auth';
import { supabase } from './lib/supabase/client';

// Lazy-load each persona app so a page load only compiles/downloads the one
// that's actually shown, instead of all three (each pulls in charts, maps, etc.).
const FranchiseAdminApp = dynamic(
  () => import('./franchise-admin/FranchiseAdminApp').then((m) => m.FranchiseAdminApp),
  { ssr: false },
);
const BranchOwnerApp = dynamic(
  () => import('./branch-owner/BranchOwnerApp').then((m) => m.BranchOwnerApp),
  { ssr: false },
);
const BranchManagerApp = dynamic(
  () => import('./branch-manager/BranchManagerApp').then((m) => m.BranchManagerApp),
  { ssr: false },
);

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    const applySession = (session: Session | null) => {
      if (!mounted) return;

      if (!session) {
        setAccount(null);
        setAuthReady(true);
        return;
      }

      const restored = accountFromUser(session.user);
      setAccount(restored.account);
      setAuthReady(true);

      if (!restored.account) {
        // Run outside the auth callback to avoid blocking later auth events.
        window.setTimeout(() => {
          void supabase.auth.signOut({ scope: 'local' });
        }, 0);
      }
    };

    // Keep React state aligned with Supabase across login, logout, user updates,
    // automatic token refresh, and changes made in another browser tab.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      applySession(session);
    });

    // Restore the persisted session on a hard refresh. getSession refreshes an
    // expired access token when the stored refresh token is still valid.
    void supabase.auth
      .getSession()
      .then(({ data, error }) => applySession(error ? null : data.session))
      .catch(() => applySession(null));

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  /**
   * DEMO-ONLY: really signs in as the chosen seed user (new Supabase session),
   * rather than just re-skinning the view. This keeps the JWT the API verifies
   * in agreement with the persona on screen — a view-only switch would leave
   * API calls scoped to the previous user's role/branches.
   */
  const handleSwitchUser = async (username: string) => {
    if (username === account?.username || switching) return;
    const demo = DEMO_ACCOUNTS.find((d) => d.username === username);
    if (!demo) return;

    setSwitching(true);
    const { account: next, error } = await signIn(demo.username, demo.password);
    if (next) {
      setAccount(next);
    } else {
      toast.error(error ?? 'Could not switch demo user');
    }
    setSwitching(false);
  };

  const requestLogout = () => setShowLogoutConfirm(true);

  const handleLogout = async () => {
    if (loggingOut) return;

    setLoggingOut(true);
    try {
      await signOut();
      setShowLogoutConfirm(false);
      setAccount(null);
      toast.success('You have been successfully logged out.');
    } catch (logoutError) {
      toast.error(logoutError instanceof Error ? logoutError.message : 'Could not log out. Please try again.');
    } finally {
      setLoggingOut(false);
    }
  };

  const handleAccountUpdate = (patch: Partial<Account>) => {
    setAccount((current) => (current ? { ...current, ...patch } : current));
  };

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
    <>
      {account ? (
        <AccountProvider
          account={account}
          onLogout={requestLogout}
          onAccountUpdate={handleAccountUpdate}
        >
          {/* The rendered app always follows the REAL session's role — no view/JWT drift. */}
          {account.role === 'franchise-admin' && <FranchiseAdminApp />}
          {account.role === 'branch-owner' && (
            // Remount when the branch set changes so BranchProvider re-initializes.
            <BranchOwnerApp key={account.branches.join('|')} branches={account.branches} />
          )}
          {account.role === 'branch-manager' && <BranchManagerApp />}

          <PersonaSwitcher
            account={account}
            switching={switching}
            onSwitchUser={handleSwitchUser}
            onLogout={requestLogout}
          />
          <LogoutConfirmationDialog
            open={showLogoutConfirm}
            loggingOut={loggingOut}
            onOpenChange={setShowLogoutConfirm}
            onConfirm={handleLogout}
          />
        </AccountProvider>
      ) : (
        <Login onLogin={setAccount} />
      )}
      <Toaster className={account ? 'dashboard-toaster' : undefined} />
    </>
  );
}
