import { useState, useEffect } from 'react';
import { Login } from './components/Login';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { OrderAnalytics } from './components/OrderAnalytics';
import { SalesOverview } from './components/SalesOverview';
import { OperationalExpenses } from './components/OperationalExpenses';
import { CSATSatisfaction } from './components/CSATSatisfaction';
import { LoyaltyProgram } from './components/LoyaltyProgram';
import { SupplyChain } from './components/SupplyChain';
import { ReportGeneration } from './components/ReportGeneration';
import { FleetOverview } from './components/FleetOverview';
import { UserManagement } from './components/UserManagement';
import { BranchSettings } from './components/BranchSettings';
import { DeliveryCompletionFull } from './components/DeliveryCompletionFull';
import { ComplaintLogFull } from './components/ComplaintLogFull';
import { PurchaseTrackerFull } from './components/PurchaseTrackerFull';
import { RedemptionHistoryFull } from './components/RedemptionHistoryFull';
import { ReorderLogFull } from './components/ReorderLogFull';
import { CustomerRatingsFull } from './components/CustomerRatingsFull';
import { SalesFull } from './components/SalesFull'; 
import { ExpensesLogFull } from './components/ExpensesLogFull'; 
import { BranchProvider } from './contexts/BranchContext';
import { Toaster } from './components/ui/sonner';

type Branch = 'Quezon City Branch' | 'Makati Branch' | 'Mandaluyong Branch';

export default function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [activeScreen, setActiveScreen] = useState('dashboard');
  const [userBranches, setUserBranches] = useState<Branch[]>(['Quezon City Branch']);

  useEffect(() => {
    const handleNavigate = (e: Event) => {
      const customEvent = e as CustomEvent;
      setActiveScreen(customEvent.detail);
    };

    window.addEventListener('navigate', handleNavigate);
    return () => window.removeEventListener('navigate', handleNavigate);
  }, []);

  const handleLogin = (branches: Branch[]) => {
    setUserBranches(branches);
    setIsLoggedIn(true);
  };

  if (!isLoggedIn) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <BranchProvider initialBranches={userBranches}>
      <Toaster richColors position="top-right" />
      <div className="flex h-screen bg-gray-50">
        <Sidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />

        <div className="flex-1 flex flex-col overflow-hidden">
          {activeScreen === 'dashboard' && <Dashboard />}
          {activeScreen === 'order-analytics' && <OrderAnalytics />}
          {activeScreen === 'sales-overview' && <SalesOverview />}
          {activeScreen === 'operational-expenses' && <OperationalExpenses />}
          {activeScreen === 'csat' && <CSATSatisfaction />}
          {activeScreen === 'loyalty' && <LoyaltyProgram />}
          {activeScreen === 'supply-chain' && <SupplyChain />}
          {activeScreen === 'reports' && <ReportGeneration />}
          {activeScreen === 'fleet-overview' && <FleetOverview />}
          {activeScreen === 'user-management' && <UserManagement />}
          {activeScreen === 'settings' && <BranchSettings />}
          
          {activeScreen === 'sales-full' && <SalesFull onBack={() => setActiveScreen('sales-overview')} />}
          {activeScreen === 'expenses-log-full' && <ExpensesLogFull onBack={() => setActiveScreen('operational-expenses')} />} {/* 👈 ADDED RENDER */}
          
          {activeScreen === 'delivery-completion-full' && <DeliveryCompletionFull onBack={() => setActiveScreen('order-analytics')} />}
          {activeScreen === 'complaint-log-full' && <ComplaintLogFull onBack={() => setActiveScreen('csat')} />}
          {activeScreen === 'purchase-tracker-full' && <PurchaseTrackerFull onBack={() => setActiveScreen('loyalty')} />}
          {activeScreen === 'redemption-history-full' && <RedemptionHistoryFull onBack={() => setActiveScreen('loyalty')} />}
          {activeScreen === 'reorder-log-full' && <ReorderLogFull onBack={() => setActiveScreen('supply-chain')} />}
          {activeScreen === 'customer-ratings-full' && <CustomerRatingsFull onBack={() => setActiveScreen('csat')} />}
        </div>
      </div>
    </BranchProvider>
  );
}