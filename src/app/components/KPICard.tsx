import React, { ReactNode } from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

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
  titleClassName?: string;
  /** Extra detail shown in a popup on hover — a breakdown, context, etc. */
  tooltip?: ReactNode;
}

export function KPICard({ title, value, subtitle, icon, alert, accentColor = '#007BC1', trend, titleClassName = '', tooltip }: KPICardProps) {
  const card = (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-3.5 relative flex flex-col h-full">
      <div className="flex items-start justify-between mb-1">
        <div className="flex items-start gap-1.5 pt-1.5">
          <div className={`text-sm font-medium text-gray-500 ${titleClassName}`}>{title}</div>
        </div>
        {icon && (
          <div className="w-8 h-8 rounded-[8px] border border-gray-100 flex items-center justify-center shadow-sm text-[#007BC1]">
            {React.isValidElement(icon) ? React.cloneElement(icon as React.ReactElement, { className: `${(icon as React.ReactElement).props.className || ''} !text-[#007BC1]`.replace(/text-\[[^\]]+\]/g, '') }) : icon}
          </div>
        )}
      </div>

      <div className={`text-3xl font-bold mt-2 leading-none ${alert ? 'text-[#CC1903]' : 'text-gray-900'}`}>
        {value}
      </div>

      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}

      {trend && (
        <div className="flex items-center gap-2 mt-auto pt-2">
          {(() => {
            const match = trend.text.match(/^([+-]?\d+(?:\.\d+)?%?)\s+(.*)$/);
            const isUp = trend.direction === 'up';
            const isPositive = trend.positive;
            
            const pillBg = isPositive ? 'bg-[#e8faef]' : 'bg-[#fee2e2]';
            const pillText = isPositive ? 'text-[#16a34a]' : 'text-[#ef4444]';
            const IconComponent = isUp ? ArrowUpRight : ArrowDownRight;

            if (match) {
              const [, percent, textPart] = match;
              return (
                <>
                  <span className="text-xs text-gray-400 font-medium">{textPart}</span>
                  <div className={`flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-semibold ${pillBg} ${pillText}`}>
                    {percent}
                    <IconComponent className="w-3 h-3" />
                  </div>
                </>
              );
            } else {
              return (
                <span className="text-xs text-gray-400 font-medium">{trend.text}</span>
              );
            }
          })()}
        </div>
      )}
    </div>
  );

  if (!tooltip) return card;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{card}</TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px] text-left leading-relaxed">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
