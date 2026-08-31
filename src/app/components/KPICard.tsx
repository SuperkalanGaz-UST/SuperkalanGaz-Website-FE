import { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

export interface KPITrend {
  /** e.g. "+10.2% from yesterday" */
  text: string;
  direction: 'up' | 'down';
  /**
   * Whether the movement is good news (green) or bad (red). Kept separate
   * from direction because e.g. expenses going down is positive.
   * NOTE: color is now driven by direction — up = green, down = red —
   * so `positive` is retained only for semantic tagging and future use.
   */
  positive: boolean;
}

interface KPICardProps {
  title: string;
  value: string;
  subtitle?: string;
  /** Rendered inside the circular chip in the top-right corner. */
  icon?: ReactNode;
  alert?: boolean;
  /** Tints the icon chip; defaults to brand blue. */
  accentColor?: string;
  trend?: KPITrend;
}

export function KPICard({ title, value, subtitle, icon, alert, accentColor = '#007BC1', trend }: KPICardProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 relative flex flex-col min-h-[120px] h-full">
      {icon && (
        <div
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}26` }}
        >
          {icon}
        </div>
      )}

      <div className={`text-sm font-medium text-gray-500 ${icon ? 'pr-12' : ''}`}>{title}</div>
      <div className={`text-3xl font-bold mt-2 leading-none ${alert ? 'text-[#CC1903]' : 'text-gray-900'}`}>
        {value}
      </div>

      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}

      {trend && (
        <div
          className={`flex items-center gap-1 text-xs font-medium mt-auto pt-3 ${
            trend.positive ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {trend.direction === 'up' ? (
            <ArrowUpRight className="w-3.5 h-3.5" />
          ) : (
            <ArrowDownRight className="w-3.5 h-3.5" />
          )}
          <span>{trend.text}</span>
        </div>
      )}
    </div>
  );
}
