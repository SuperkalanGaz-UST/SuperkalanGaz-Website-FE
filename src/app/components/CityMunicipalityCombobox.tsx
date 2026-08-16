import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { citiesMunicipalitiesForProvince } from '../lib/phCitiesMunicipalities';

interface CityMunicipalityComboboxProps {
  /** Province whose cities and municipalities should be offered. */
  province: string;
  /** Currently selected city or municipality. */
  value: string;
  /** Fired only when an item from the province-specific list is selected. */
  onChange: (cityMunicipality: string) => void;
  placeholder?: string;
}

function normalizedSearchText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

/**
 * Searchable city/municipality picker constrained by the selected province.
 * Keeping this a closed list prevents mismatched province/city pairs from
 * reaching the branch-registration review step.
 */
export function CityMunicipalityCombobox({
  province,
  value,
  onChange,
  placeholder,
}: CityMunicipalityComboboxProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const choices = useMemo(() => citiesMunicipalitiesForProvince(province), [province]);
  const normalizedQuery = normalizedSearchText(query.trim());
  const filtered = useMemo(
    () =>
      normalizedQuery === ''
        ? choices
        : choices.filter((choice) =>
            normalizedSearchText(choice).includes(normalizedQuery),
          ),
    [choices, normalizedQuery],
  );
  const disabled = choices.length === 0;

  // A province change invalidates both the open results and any typed filter.
  useEffect(() => {
    setOpen(false);
    setQuery('');
  }, [province]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
        setQuery('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const openPanel = () => {
    if (disabled) return;
    setOpen(true);
    setQuery('');
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  const handleSelect = (choice: string) => {
    onChange(choice);
    setOpen(false);
    setQuery('');
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A09C] pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={(event) => {
            if (!open) setOpen(true);
            setQuery(event.target.value);
          }}
          onFocus={openPanel}
          placeholder={
            disabled
              ? 'Select province first'
              : placeholder ?? 'Search city or municipality…'
          }
          disabled={disabled}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          autoComplete="off"
          className="w-full h-[34px] pl-8 pr-8 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5] disabled:text-[#A0A09C] disabled:cursor-not-allowed"
        />
        <ChevronDown
          className={`absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A09C] pointer-events-none transition-transform ${
            open ? 'rotate-180' : ''
          }`}
        />
      </div>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="absolute z-[60] mt-1 w-full bg-white border border-[#E4E4E0] rounded-lg shadow-lg max-h-[240px] overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-2.5 text-[12px] text-[#6B6B67]">
              No matching cities or municipalities.
            </div>
          ) : (
            filtered.map((choice) => {
              const selected = choice === value;
              return (
                <button
                  key={choice}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => handleSelect(choice)}
                  className="w-full text-left px-3 py-2 border-b border-[#F0F0EE] last:border-b-0 flex items-center gap-2 hover:bg-[#F7F7F6] cursor-pointer transition-colors"
                >
                  <span className="flex-1 min-w-0 text-[13px] text-[#1A1A18] truncate">
                    {choice}
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
