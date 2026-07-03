'use client';

import { useState } from 'react';
import { Login } from './components/Login';
import { PersonaSwitcher } from './components/PersonaSwitcher';
import { FranchiseAdminApp } from './franchise-admin/FranchiseAdminApp';
import { BranchOwnerApp } from './branch-owner/BranchOwnerApp';
import { BranchManagerApp } from './branch-manager/BranchManagerApp';
import { Account, Role, ALL_BRANCHES } from './lib/auth';

export default function App() {
  const [account, setAccount] = useState<Account | null>(null);
  const [activePersona, setActivePersona] = useState<Role>('franchise-admin');

  const handleLogin = (loggedIn: Account) => {
    setAccount(loggedIn);
    setActivePersona(loggedIn.role);
  };

  const handleLogout = () => {
    setAccount(null);
  };

  if (!account) {
    return <Login onLogin={handleLogin} />;
  }

  // When the demo switcher shows the BO view to a non-BO account, fall back to
  // all branches so the multi-branch UI is demoable; a real BO sees only theirs.
  const ownerBranches =
    account.role === 'branch-owner' ? account.branches : ALL_BRANCHES;

  return (
    <>
      {activePersona === 'franchise-admin' && <FranchiseAdminApp />}
      {activePersona === 'branch-owner' && (
        // Remount when the branch set changes so BranchProvider re-initializes.
        <BranchOwnerApp key={ownerBranches.join('|')} branches={ownerBranches} />
      )}
      {activePersona === 'branch-manager' && <BranchManagerApp />}

      <PersonaSwitcher
        activePersona={activePersona}
        loggedInAs={account.displayName}
        onSwitch={setActivePersona}
        onLogout={handleLogout}
      />
    </>
  );
}
