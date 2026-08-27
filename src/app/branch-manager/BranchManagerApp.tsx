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
import Csat from './screens/csat';
import Fleet from './screens/fleet';
import Vehicles from './screens/vehicles';
import Analytics from './screens/analytics';
import MonthlyExpenses from './screens/monthly-expenses';
import BranchManagerAccountSettings from './screens/settings';
import './bm-theme.css';

/** Page titles rendered in the shared header; screens no longer carry their own. */
const SCREEN_TITLES: Record<string, string> = {
  overview: 'Overview',
  orders: 'Order Management',
  inventory: 'Inventory',
  customers: 'Customers & Loyalty',
  rewards: 'Reward Redemptions',
  csat: 'Customer Feedback',
  fleet: 'Fleet Management',
  vehicles: 'Vehicle Management',
  analytics: 'Branch Performance',
  expenses: 'Monthly Expenses',
  settings: 'Account settings',
};

export function BranchManagerApp() {
  const [activeScreen, setActiveScreen] = useState('overview');
  // Set when the Customers screen's "view order history" link is clicked;
  // seeds the Orders screen's own search box so it lands pre-filtered to that
  // customer, then behaves like any other manual search from there on.
  const [ordersCustomerSearch, setOrdersCustomerSearch] = useState<string | null>(null);
  const viewCustomerOrders = (customerName: string) => {
    setOrdersCustomerSearch(customerName);
    setActiveScreen('orders');
  };
  // BM is strictly single-branch (AGENTS.md §5) — show it as a static chip.
  const account = useAccount();
  const branch = account.branches[0];

  return (
    <div className="bm-root" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <BMSidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <AppHeader
          title={SCREEN_TITLES[activeScreen] ?? 'Overview'}
          description={
            activeScreen === 'expenses'
              ? 'Record and review your branch expenses for the current month.'
              : activeScreen === 'settings'
                ? 'Manage your personal details and account security.'
              : undefined
          }
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
          {activeScreen === 'orders' && <Orders initialSearch={ordersCustomerSearch} />}
          {activeScreen === 'inventory' && <Inventory />}
          {activeScreen === 'customers' && <Customers onViewOrders={viewCustomerOrders} />}
          {activeScreen === 'rewards' && <Rewards />}
          {activeScreen === 'csat' && <Csat />}
          {activeScreen === 'fleet' && <Fleet />}
          {activeScreen === 'vehicles' && <Vehicles />}
          {activeScreen === 'analytics' && <Analytics />}
          {activeScreen === 'expenses' && <MonthlyExpenses />}
          {activeScreen === 'settings' && <BranchManagerAccountSettings />}
        </main>
      </div>
    </div>
  );
}
