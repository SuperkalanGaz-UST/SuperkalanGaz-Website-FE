'use client';

import type { ReactNode } from 'react';
import * as Tabs from '@radix-ui/react-tabs';

export type FleetTab = 'overview' | 'vehicles' | 'access';

export function FleetTabs({ activeTab, onTabChange, showAccess = false, children }: {
  activeTab: FleetTab;
  onTabChange: (tab: FleetTab) => void;
  showAccess?: boolean;
  children: ReactNode;
}) {
  const tabs: { value: FleetTab; label: string }[] = [
    { value: 'overview', label: 'Fleet Overview' },
    { value: 'vehicles', label: 'Vehicles' },
    ...(showAccess ? [{ value: 'access' as const, label: 'Delivery Rider Access' }] : []),
  ];

  return (
    <Tabs.Root value={activeTab} onValueChange={value => onTabChange(value as FleetTab)} className="min-w-0">
      <Tabs.List aria-label="Fleet sections" className="mb-6 flex gap-6 overflow-x-auto border-b border-gray-200">
        {tabs.map(tab => (
          <Tabs.Trigger
            key={tab.value}
            value={tab.value}
            className="shrink-0 whitespace-nowrap border-b-2 border-transparent px-1 pb-3 text-sm font-semibold text-gray-500 transition-colors hover:text-gray-800 focus-visible:outline-2 focus-visible:outline-[#007BC1] focus-visible:outline-offset-[-2px] data-[state=active]:border-[#007BC1] data-[state=active]:text-[#007BC1]"
          >
            {tab.label}
          </Tabs.Trigger>
        ))}
      </Tabs.List>
      <Tabs.Content value={activeTab} className="min-w-0 focus-visible:outline-2 focus-visible:outline-[#007BC1]">
        {children}
      </Tabs.Content>
    </Tabs.Root>
  );
}
