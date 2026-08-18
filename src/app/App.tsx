'use client';

import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { Login } from './components/Login';
import { LogoutConfirmationDialog } from './components/LogoutConfirmationDialog';
import { AccountProvider } from './contexts/AccountContext';
import { Account, accountFromUser, signOut } from './lib/auth';
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
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const passwordRecoveryRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let initialSignOutTimer: number | null = null;

    const applySession = (session: Session | null) => {
      if (!mounted) return;

      if (!session || passwordRecoveryRef.current) {
        setAccount(null);
        return;
      }

      const restored = accountFromUser(session.user);
      setAccount(restored.account);

      if (!restored.account) {
        // Run outside the auth callback to avoid blocking later auth events.
        window.setTimeout(() => {
          void supabase.auth.signOut({ scope: 'local' });
        }, 0);
      }
    };

    // A browser refresh starts a new App instance. Deliberately discard the
    // persisted session instead of restoring it, so refresh and development
    // remounts return directly to Login. Subsequent auth events still keep the
    // active page aligned after an intentional sign-in or sign-out.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        passwordRecoveryRef.current = true;
        setPasswordRecovery(true);
        setAccount(null);
        return;
      }

      if (event === 'INITIAL_SESSION') {
        setAccount(null);
        if (session) {
          // Local scope clears this browser immediately without affecting a
          // separate device where the same account may be signed in.
          initialSignOutTimer = window.setTimeout(() => {
            initialSignOutTimer = null;
            void supabase.auth.signOut({ scope: 'local' });
          }, 0);
        }
        return;
      }

      // If the user intentionally signs in before the scheduled startup task
      // runs, never let the stale task sign the new session back out.
      if (initialSignOutTimer !== null) {
        window.clearTimeout(initialSignOutTimer);
        initialSignOutTimer = null;
      }
      applySession(session);
    });

    return () => {
      mounted = false;
      if (initialSignOutTimer !== null) window.clearTimeout(initialSignOutTimer);
      subscription.unsubscribe();
    };
  }, []);

  const requestLogout = () => setShowLogoutConfirm(true);

  const handlePasswordReset = async () => {
    // A recovery link creates a temporary authenticated session. End it after
    // the password changes so the user deliberately signs in with the new one.
    await supabase.auth.signOut();
    passwordRecoveryRef.current = false;
    setPasswordRecovery(false);
    setAccount(null);
    window.history.replaceState({}, document.title, window.location.pathname);
  };

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

          <LogoutConfirmationDialog
            open={showLogoutConfirm}
            loggingOut={loggingOut}
            onOpenChange={setShowLogoutConfirm}
            onConfirm={handleLogout}
          />
        </AccountProvider>
      ) : (
        <Login
          onLogin={setAccount}
          passwordRecovery={passwordRecovery}
          onPasswordReset={handlePasswordReset}
        />
      )}
      <Toaster className={account ? 'dashboard-toaster' : undefined} />
    </>
  );
}
