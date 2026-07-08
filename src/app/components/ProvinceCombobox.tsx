import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { PH_PROVINCES } from '../lib/phProvinces';

interface ProvinceComboboxProps {
  /** Currently selected province name (empty string when none). */
  value: string;
  /** Fired when a province is chosen from the list. */
  onChange: (province: string) => void;
  placeholder?: string;
  /** Overrides the input styling so it can blend into a host modal. */
  className?: string;
}

/**
 * Searchable province picker styled to match {@link StoreLocationCombobox} (the
 * Branch name field): a search input that filters the fixed PH province list
 * (Metro Manila included) into a floating panel, with a check on the current
 * selection. This is a closed set — unlike the branch-name combobox there is no
 * "create new" affordance; you can only pick a real province.
 */
export function ProvinceCombobox({
  value,
  onChange,
  placeholder,
  className,
}: ProvinceComboboxProps) {
  const [open, setOpen] = useState(false);
  // Free-text filter, live only while the panel is open. When closed, the input
  // shows the committed selection instead (see `inputValue`).
  const [query, setQuery] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const term = query.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      term === ''
        ? PH_PROVINCES
        : PH_PROVINCES.filter((p) => p.name.toLowerCase().includes(term)),
    [term],
  );

  // Close (and drop any half-typed filter) when clicking outside the component.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const openPanel = () => {
    setOpen(true);
    setQuery('');
    // Defer focus until the input is interactable this tick.
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
    setQuery('');
  };

  // While open the input is a filter box (shows what the user types); while
  // closed it reflects the committed selection.
  const inputValue = open ? query : value;

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A09C] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          onChange={(e) => {
            if (!open) setOpen(true);
            setQuery(e.target.value);
          }}
          onFocus={() => {
            if (!open) openPanel();
          }}
          placeholder={placeholder ?? 'Select province…'}
          className={
            className ??
            'w-full h-[34px] pl-8 pr-8 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]'
          }
          autoComplete="off"
        />
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A09C] pointer-events-none transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </div>

      {open && (
        <div className="absolute z-[60] mt-1 w-full bg-white border border-[#E4E4E0] rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-[12px] text-[#6B6B67]">
              No matching provinces.
            </div>
          ) : (
            filtered.map((p) => {
              const selected = p.name === value;
              return (
                <button
                  key={p.name}
                  type="button"
                  onClick={() => handleSelect(p.name)}
                  className="w-full text-left px-3 py-2 border-b border-[#F0F0EE] last:border-b-0 flex items-center gap-2 hover:bg-[#F7F7F6] cursor-pointer transition-colors"
                >
                  <span className="flex-1 min-w-0 text-[13px] text-[#1A1A18] truncate">
                    {p.name}
                  </span>
                  <Check
                    className={`flex-shrink-0 w-3.5 h-3.5 ${
                      selected ? 'text-[#185FA5]' : 'text-transparent'
                    }`}
                  />
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
