'use client';

import { useId, useState } from 'react';
import { Check, ChevronDown, MapPin } from 'lucide-react';
import { PricingRegion } from '../lib/pricing';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from './ui/command';
import { Popover, PopoverContent, PopoverTrigger } from './ui/popover';

export function PricingRegionSelect({
  value,
  regions,
  onChange,
  disabled = false,
}: {
  value: string;
  regions: PricingRegion[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listId = useId();
  const options = [{ code: '', name: 'System-wide default' }, ...regions];
  const label =
    options.find((region) => region.code === value)?.name ?? 'Select a region';
  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        setQuery('');
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-label="Region"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          disabled={disabled}
          className="flex h-11 w-full items-center gap-3 rounded-lg border border-gray-300 bg-white px-3 text-left text-sm font-medium text-gray-900 outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1]/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <MapPin
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-gray-500"
          />
          <span className="min-w-0 flex-1 truncate">{label}</span>
          <ChevronDown
            aria-hidden="true"
            className="h-4 w-4 shrink-0 text-gray-500"
          />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] max-w-[calc(100vw-2rem)] bg-white p-0"
      >
        <Command>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search Philippine regions…"
            aria-label="Search Philippine regions"
          />
          <CommandList id={listId}>
            <CommandEmpty>No matching regions.</CommandEmpty>
            <CommandGroup>
              {options.map((region) => (
                <CommandItem
                  key={region.code}
                  value={region.name}
                  onSelect={() => {
                    onChange(region.code);
                    setOpen(false);
                  }}
                  className="cursor-pointer py-3"
                >
                  <span className="flex-1">{region.name}</span>
                  <Check
                    aria-hidden="true"
                    className={`h-4 w-4 text-[#007BC1] ${value === region.code ? 'opacity-100' : 'opacity-0'}`}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
