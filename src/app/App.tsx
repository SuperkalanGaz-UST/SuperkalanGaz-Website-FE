'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Toaster } from './components/ui/sonner';
import { Login } from './components/Login';
import { PersonaSwitcher } from './components/PersonaSwitcher';
import { FranchiseAdminApp } from './franchise-admin/FranchiseAdminApp';
import { BranchOwnerApp } from './branch-owner/BranchOwnerApp';
import { BranchManagerApp } from './branch-manager/BranchManagerApp';
import { AccountProvider } from './contexts/AccountContext';
import { Account, DEMO_ACCOUNTS, signIn, signOut } from './lib/auth';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [switching, setSwitching] = useState(false);

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

  const handleLogout = async () => {
    await signOut();
    setAccount(null);
  };

  if (!account) {
    return (
      <>
        <Login onLogin={setAccount} />
        <Toaster richColors position="top-right" />
      </>
    );
  }

  return (
    <AccountProvider account={account}>
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
        onLogout={handleLogout}
      />
      <Toaster richColors position="top-right" />
    </AccountProvider>
  );
}
