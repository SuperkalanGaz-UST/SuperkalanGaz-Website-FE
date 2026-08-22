'use client';

import { AppHeader } from '../../components/AppHeader';

export function SuperAdminHeader({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <AppHeader
      title={title}
      description={description}
      badge={
        <div className="flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 text-xs font-bold text-[#007BC1]">
          Main Office
        </div>
      }
    />
  );
}
