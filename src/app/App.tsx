'use client';

import { useEffect, useRef, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { Login } from './components/Login';
import { LogoutConfirmationDialog } from './components/LogoutConfirmationDialog';
import { AccountProvider } from './contexts/AccountContext';
import { Account, accountFromUser, signOut } from './lib/auth';
import { supabase } from './lib/supabase/client';

// Lazy-load each persona app so a page load only compiles/downloads the one
// that's actually shown instead of every dashboard bundle.
const SuperAdminApp = dynamic(
  () => import('./super-admin/SuperAdminApp').then((m) => m.SuperAdminApp),
  { ssr: false },
);
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

const AUTH_RESTORE_TIMEOUT_MS = 10_000;

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const passwordRecoveryRef = useRef(false);

  useEffect(() => {
    let mounted = true;
    let restoreTimedOut = false;
    const restoreTimer = window.setTimeout(() => {
      if (!mounted) return;
      restoreTimedOut = true;
      setAccount(null);
      setAuthReady(true);

      // Fail closed when session restoration stalls. Local scope clears only
      // this browser; a separate device remains signed in.
      void supabase.auth.signOut({ scope: 'local' });
    }, AUTH_RESTORE_TIMEOUT_MS);

    const applySession = (session: Session | null) => {
      if (!mounted) return;
      window.clearTimeout(restoreTimer);

      if (!session || passwordRecoveryRef.current) {
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

    // Restore a valid persisted session on normal refresh. If INITIAL_SESSION
    // arrives only after the timeout above, ignore it and keep the user logged
    // out; later SIGNED_IN events are still accepted as intentional logins.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.clearTimeout(restoreTimer);
        passwordRecoveryRef.current = true;
        setPasswordRecovery(true);
        setAccount(null);
        setAuthReady(true);
        return;
      }

      if (event === 'INITIAL_SESSION' && restoreTimedOut) {
        if (session) {
          window.setTimeout(() => {
            void supabase.auth.signOut({ scope: 'local' });
          }, 0);
        }
        return;
      }

      applySession(session);
    });

    return () => {
      mounted = false;
      window.clearTimeout(restoreTimer);
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
          {account.role === 'super-admin' && <SuperAdminApp />}
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
