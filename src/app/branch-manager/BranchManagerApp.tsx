'use client';

import { useState } from 'react';
import BMSidebar from './components/BMSidebar';
import { AppHeader } from '../components/AppHeader';
import { useAccount } from '../contexts/AccountContext';
import Overview from './screens/overview';
import Orders from './screens/orders';
import Inventory from './screens/inventory';
import Customers from './screens/customers';
import Rewards from './screens/rewards';
import Fleet from './screens/fleet';
import Vehicles from './screens/vehicles';
import Analytics from './screens/analytics';
import './bm-theme.css';

/** Page titles rendered in the shared header; screens no longer carry their own. */
const SCREEN_TITLES: Record<string, string> = {
  overview: 'Overview',
  orders: 'Order Management',
  inventory: 'Inventory',
  customers: 'Customers & Loyalty',
  rewards: 'Reward Redemptions',
  fleet: 'Fleet Management',
  vehicles: 'Vehicle Management',
  analytics: 'Branch Performance',
};

export function BranchManagerApp() {
  const [activeScreen, setActiveScreen] = useState('overview');
  // BM is strictly single-branch (AGENTS.md §5) — show it as a static chip.
  const account = useAccount();
  const branch = account.branches[0];

  return (
    <div className="bm-root" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <BMSidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppHeader
          title={SCREEN_TITLES[activeScreen] ?? 'Overview'}
          badge={
            branch ? (
              <div className="flex items-center px-3 py-1 rounded-full border border-gray-200 bg-white text-[#007BC1] text-xs font-bold whitespace-nowrap">
                {branch}
              </div>
            ) : undefined
          }
        />

        <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
          {activeScreen === 'overview' && <Overview />}
          {activeScreen === 'orders' && <Orders />}
          {activeScreen === 'inventory' && <Inventory />}
          {activeScreen === 'customers' && <Customers />}
          {activeScreen === 'rewards' && <Rewards />}
          {activeScreen === 'fleet' && <Fleet />}
          {activeScreen === 'vehicles' && <Vehicles />}
          {activeScreen === 'analytics' && <Analytics />}
        </main>
      </div>
    </div>
  );
}
