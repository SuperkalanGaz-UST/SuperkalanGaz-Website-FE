import { ReactNode } from 'react';

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  alert?: boolean;
  accentColor?: string;
}

export function KPICard({ title, value, subtitle, icon, alert, accentColor = '#007BC1' }: KPICardProps) {
  return (
    <div className="bg-white rounded-2xl border border-gray-200 relative p-6 flex flex-col" style={{ borderLeft: `4px solid ${accentColor}` }}>
      <div className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-3">{title}</div>
<div className="flex items-center gap-2 mt-auto">
        <div className="text-4xl font-semibold text-gray-900 leading-none">{value}</div>
        {icon && <div className="flex items-center gap-2">
          {icon}
          {subtitle && <div className="text-xs text-gray-500">{subtitle}</div>}
        </div>}
      </div>
      {!icon && subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
  );
}
