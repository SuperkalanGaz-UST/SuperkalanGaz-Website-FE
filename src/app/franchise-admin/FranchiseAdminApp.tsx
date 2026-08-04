'use client';

import { useState, useEffect } from 'react';
import { Sidebar } from '../components/Sidebar';
import { Dashboard } from '../components/Dashboard';
import { OrderAnalytics } from '../components/OrderAnalytics';
import { CSATSatisfaction } from '../components/CSATSatisfaction';
import { LoyaltyProgram } from '../components/LoyaltyProgram';
import { SupplyChain } from '../components/SupplyChain';
import { ReportGeneration } from '../components/ReportGeneration';
import { BranchSettings } from '../components/BranchSettings';
import { PriceConfiguration } from '../components/PriceConfiguration';
import { DeliveryCompletionFull } from '../components/DeliveryCompletionFull';
import { ComplaintLogFull } from '../components/ComplaintLogFull';
import { PurchaseTrackerFull } from '../components/PurchaseTrackerFull';
import { RedemptionHistoryFull } from '../components/RedemptionHistoryFull';
import { ReorderLogFull } from '../components/ReorderLogFull';
import { CustomerRatingsFull } from '../components/CustomerRatingsFull';
import { CustomerList } from '../components/CustomerList';
import { CustomerDetail } from '../components/CustomerDetail';
import { FranchiseAdminSettings } from './components/FranchiseAdminSettings';

export function FranchiseAdminApp() {
  const [activeScreen, setActiveScreen] = useState('dashboard');

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveScreen(customEvent.detail);
    };

    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  // Keep sidebar highlight on 'customers' when viewing customer detail
  const sidebarActive = activeScreen === 'customer-detail' ? 'customers' : activeScreen;

  return (
    <div className="flex h-screen bg-gray-50">
      <Sidebar activeScreen={sidebarActive} onNavigate={setActiveScreen} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {activeScreen === 'dashboard' && <Dashboard />}
        {activeScreen === 'order-analytics' && <OrderAnalytics />}
        {activeScreen === 'customers' && <CustomerList onViewCustomer={() => setActiveScreen('customer-detail')} />}
        {activeScreen === 'customer-detail' && <CustomerDetail onBack={() => setActiveScreen('customers')} />}
        {activeScreen === 'csat' && <CSATSatisfaction />}
        {activeScreen === 'loyalty' && <LoyaltyProgram />}
        {activeScreen === 'supply-chain' && <SupplyChain />}
        {activeScreen === 'reports' && <ReportGeneration />}
        {activeScreen === 'franchise-registry' && <BranchSettings />}
        {activeScreen === 'price-config' && <PriceConfiguration />}
        {activeScreen === 'account-settings' && <FranchiseAdminSettings />}
        {activeScreen === 'delivery-completion-full' && <DeliveryCompletionFull onBack={() => setActiveScreen('order-analytics')} />}
        {activeScreen === 'complaint-log-full' && <ComplaintLogFull onBack={() => setActiveScreen('csat')} />}
        {activeScreen === 'purchase-tracker-full' && <PurchaseTrackerFull onBack={() => setActiveScreen('loyalty')} />}
        {activeScreen === 'redemption-history-full' && <RedemptionHistoryFull onBack={() => setActiveScreen('loyalty')} />}
        {activeScreen === 'reorder-log-full' && <ReorderLogFull onBack={() => setActiveScreen('supply-chain')} />}
        {activeScreen === 'customer-ratings-full' && <CustomerRatingsFull onBack={() => setActiveScreen('csat')} />}
      </div>
    </div>
  );
}
