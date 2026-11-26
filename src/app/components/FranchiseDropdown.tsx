'use client';

import * as Select from '@radix-ui/react-select';
import { ChevronDown } from 'lucide-react';

interface FranchiseDropdownProps {
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
  id?: string;
  'aria-label'?: string;
  placeholder?: string;
  className?: string;
  wrapperClassName?: string;
  matchTriggerWidth?: boolean;
  disabled?: boolean;
  required?: boolean;
}

/** Dashboard dropdown styling with native form and keyboard support. */
export function FranchiseDropdown({ value, onChange, options, id, 'aria-label': ariaLabel, placeholder, className = '', wrapperClassName = '', matchTriggerWidth = false, disabled, required }: FranchiseDropdownProps) {
  // Radix reserves empty item values; keep the original values at the call sites.
  const encode = (optionValue: string) => `choice:${optionValue}`;
  const selected = options.find(option => option.value === value);

  return (
    <div className={`relative min-w-0 ${wrapperClassName}`}>
    <Select.Root
      value={required && value === '' ? '' : encode(value)}
      onValueChange={nextValue => onChange(nextValue.slice('choice:'.length))}
      disabled={disabled}
      required={required}
    >
      <Select.Trigger
        id={id}
        aria-label={ariaLabel}
        className={`flex w-full items-center justify-between gap-1.5 rounded-lg border border-gray-300 bg-white px-4 py-2 text-left text-sm font-normal text-gray-700 transition-colors hover:bg-gray-50 outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1]/30 disabled:cursor-not-allowed disabled:opacity-40 ${className}`}
      >
        <span className="min-w-0 truncate">
          <Select.Value placeholder={placeholder ?? selected?.label}>{selected?.label}</Select.Value>
        </span>
        <Select.Icon asChild>
          <ChevronDown aria-hidden="true" className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          position="popper"
          align="end"
          sideOffset={4}
          className={`z-[100] ${matchTriggerWidth ? 'w-[var(--radix-select-trigger-width)] min-w-0' : 'w-max min-w-[max(180px,var(--radix-select-trigger-width))]'} max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg`}
        >
          <Select.Viewport className="scrollbar-hide max-h-[min(320px,var(--radix-select-content-available-height))] overflow-y-auto">
            {options.map(option => (
              <Select.Item
                key={option.value}
                value={encode(option.value)}
                className={`cursor-pointer whitespace-normal break-words px-4 py-3 text-left text-sm outline-none first:rounded-t-lg last:rounded-b-lg data-[highlighted]:bg-gray-50 ${value === option.value ? 'font-semibold text-[#007BC1]' : 'font-normal text-gray-700'}`}
              >
                <Select.ItemText>{option.label}</Select.ItemText>
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
    </div>
  );
}
