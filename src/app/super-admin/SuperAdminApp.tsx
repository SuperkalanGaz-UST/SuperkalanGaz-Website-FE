'use client';

import { useState } from 'react';
import { SuperAdminSidebar } from './components/SuperAdminSidebar';
import { AdminAccounts } from './screens/AdminAccounts';
import { ApprovalRequests } from './screens/ApprovalRequests';
import { AuditLogs } from './screens/AuditLogs';
import { AuditSecurity } from './screens/AuditSecurity';
import { GovernanceDashboard } from './screens/GovernanceDashboard';
import { SuperAdminSettings } from './screens/SuperAdminSettings';

export function SuperAdminApp() {
  const [activeScreen, setActiveScreen] = useState('dashboard');
  return (
    <div className="flex h-screen bg-[#f7f8fa]">
      <SuperAdminSidebar activeScreen={activeScreen} onNavigate={setActiveScreen} />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {activeScreen === 'dashboard' && <GovernanceDashboard onNavigate={setActiveScreen} />}
        {activeScreen === 'approval-requests' && <ApprovalRequests />}
        {activeScreen === 'admin-accounts' && <AdminAccounts />}
        {activeScreen === 'account-approval-logs' && <AuditLogs category="admin-account" />}
        {activeScreen === 'price-change-logs' && <AuditLogs category="price-change" />}
        {activeScreen === 'branch-owner-logs' && <AuditLogs category="branch-owner-change" />}
        {activeScreen === 'audit-security' && <AuditSecurity />}
        {activeScreen === 'settings' && <SuperAdminSettings />}
      </div>
    </div>
  );
}
