'use client';

import { createContext, useContext, ReactNode } from 'react';
import { Account } from '../lib/auth';

/**
 * Exposes the logged-in account to any screen or chrome (sidebar footer,
 * headers) without prop-drilling. The value always reflects the REAL
 * authenticated Supabase user — the demo switcher swaps the actual session,
 * so role/branches here are what the API will also derive from the JWT.
 */
const AccountContext = createContext<Account | undefined>(undefined);

export function AccountProvider({ account, children }: { account: Account; children: ReactNode }) {
  return <AccountContext.Provider value={account}>{children}</AccountContext.Provider>;
}

export function useAccount(): Account {
  const account = useContext(AccountContext);
  if (!account) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return account;
}
