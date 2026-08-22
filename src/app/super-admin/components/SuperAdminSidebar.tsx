'use client';

import {
  ClipboardCheck,
  FileClock,
  LayoutDashboard,
  Settings,
  ShieldCheck,
  Tags,
  UserCog,
} from 'lucide-react';
import { AppSidebar, SidebarNavEntry } from '../../components/AppSidebar';

const NAV_ENTRIES: SidebarNavEntry[] = [
  { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
  { icon: ClipboardCheck, label: 'Approval Requests', id: 'approval-requests' },
  { icon: UserCog, label: 'Admin Accounts', id: 'admin-accounts' },
  { icon: Tags, label: 'Price Change Logs', id: 'price-change-logs' },
  { icon: FileClock, label: 'Branch Owner Logs', id: 'branch-owner-logs' },
  { icon: ShieldCheck, label: 'Audit & Security', id: 'audit-security' },
  { icon: Settings, label: 'System Settings', id: 'settings' },
];

export function SuperAdminSidebar({
  activeScreen,
  onNavigate,
}: {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}) {
  return (
    <AppSidebar
      entries={NAV_ENTRIES}
      activeScreen={activeScreen}
      onNavigate={onNavigate}
    />
  );
}
