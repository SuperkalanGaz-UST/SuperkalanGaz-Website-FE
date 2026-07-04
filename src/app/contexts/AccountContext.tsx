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

/**
 * Logout is provided alongside the account so every persona's chrome can
 * render a logout control without threading a callback through each app.
 * The handler ends the real Supabase session and returns to the login screen.
 */
const LogoutContext = createContext<(() => void) | undefined>(undefined);

interface AccountProviderProps {
  account: Account;
  onLogout: () => void;
  children: ReactNode;
}

export function AccountProvider({ account, onLogout, children }: AccountProviderProps) {
  return (
    <AccountContext.Provider value={account}>
      <LogoutContext.Provider value={onLogout}>{children}</LogoutContext.Provider>
    </AccountContext.Provider>
  );
}

export function useAccount(): Account {
  const account = useContext(AccountContext);
  if (!account) {
    throw new Error('useAccount must be used within an AccountProvider');
  }
  return account;
}

export function useLogout(): () => void {
  const logout = useContext(LogoutContext);
  if (!logout) {
    throw new Error('useLogout must be used within an AccountProvider');
  }
  return logout;
}
