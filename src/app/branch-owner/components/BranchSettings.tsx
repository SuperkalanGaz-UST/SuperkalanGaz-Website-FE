'use client';

import { useState } from 'react';
import { Building2, UserRound } from 'lucide-react';
import { Header } from './Header';
import { BranchConfigurationSettings } from './settings/BranchConfigurationSettings';
import { BranchOwnerAccountSettings } from './settings/BranchOwnerAccountSettings';

type SettingsTab = 'account' | 'branch';

const tabs: { id: SettingsTab; label: string; icon: typeof UserRound }[] = [
  { id: 'account', label: 'My Account', icon: UserRound },
  { id: 'branch', label: 'Branch Settings', icon: Building2 },
];

/** Branch Owner settings are split between personal identity and branch-scoped configuration. */
export function BranchSettings() {
  const [activeTab, setActiveTab] = useState<SettingsTab>('account');

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <Header title="Settings" />

      <main className="px-8 pb-10">
        <div className="mb-5 border-b border-gray-200" aria-label="Settings categories">
          <div className="flex gap-8" role="tablist">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-controls={`${tab.id}-settings-panel`}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex h-12 items-center gap-2 text-sm font-medium transition-colors ${
                    isActive ? 'text-[#007BC1]' : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {tab.label}
                  {isActive && (
                    <span className="absolute inset-x-0 bottom-0 h-0.5 rounded-full bg-[#007BC1]" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === 'account' ? (
          <BranchOwnerAccountSettings />
        ) : (
          <BranchConfigurationSettings />
        )}
      </main>
    </div>
  );
}
