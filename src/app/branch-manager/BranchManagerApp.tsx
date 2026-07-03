'use client';

import { useState } from 'react';
import { Toaster } from 'sonner';
import BMSidebar from './components/BMSidebar';
import Overview from './screens/overview';
import Orders from './screens/orders';
import Inventory from './screens/inventory';
import Customers from './screens/customers';
import Fleet from './screens/fleet';
import Vehicles from './screens/vehicles';
import Analytics from './screens/analytics';
import './bm-theme.css';

export function BranchManagerApp() {
  const [activeScreen, setActiveScreen] = useState('overview');

  return (
    <div className="bm-root" style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>
      <Toaster richColors position="top-right" />
      <BMSidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />

      <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>
        {activeScreen === 'overview' && <Overview />}
        {activeScreen === 'orders' && <Orders />}
        {activeScreen === 'inventory' && <Inventory />}
        {activeScreen === 'customers' && <Customers />}
        {activeScreen === 'fleet' && <Fleet />}
        {activeScreen === 'vehicles' && <Vehicles />}
        {activeScreen === 'analytics' && <Analytics />}
      </main>
    </div>
  );
}
