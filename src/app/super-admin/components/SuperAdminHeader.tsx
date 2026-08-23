'use client';

import type { ReactNode } from 'react';
import { AppHeader } from '../../components/AppHeader';

export function SuperAdminHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <AppHeader
      title={title}
      description={description}
      actions={actions}
      badge={
        <div className="flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-[#007BC1]">
          Main Office
        </div>
      }
    />
  );
}
