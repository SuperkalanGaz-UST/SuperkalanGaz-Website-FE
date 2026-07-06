import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Loader2, Plus, Search } from 'lucide-react';
import { apiFetch, apiErrorMessage } from '../lib/api';

/**
 * A known Superkalan store location, as served by GET /reference/store-locations.
 * This is franchise-global reference data captured once as a snapshot — never a
 * live call to superkalan.com.
 */
export interface StoreLocation {
  id: string;
  name: string;
  full_address: string;
  province: string | null;
  city: string | null;
  /** True when a branch was already provisioned from this reference — not selectable. */
  already_registered: boolean;
}

interface StoreLocationComboboxProps {
  /** Current Branch name text (this input IS the Branch name field). */
  value: string;
  /** Fired on user typing — the caller treats this as "no reference selected". */
  onChange: (value: string) => void;
  /** Fired when an existing reference location is chosen. */
  onSelectReference: (location: StoreLocation) => void;
  /** Fired when the user opts to create a brand-new branch from the typed name. */
  onCreateNew: (typed: string) => void;
  placeholder?: string;
  className?: string;
}

/** How long to wait after the last keystroke before hitting the API. */
const DEBOUNCE_MS = 250;

/**
 * Creatable combobox for the branch-registration "Branch name" field. Typing
 * filters known store locations (async, debounced); selecting one lets the
 * caller autofill address + province. Typing a name with no exact match surfaces
 * a "Create new branch" affordance for a free-text branch. Locations already
 * linked to a branch render disabled and cannot be re-provisioned.
 */
export function StoreLocationCombobox({
  value,
  onChange,
  onSelectReference,
  onCreateNew,
  placeholder,
  className,
}: StoreLocationComboboxProps) {
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<StoreLocation[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced search against the reference endpoint. A run counter guards
  // against out-of-order responses overwriting a newer query's results.
  const runId = useRef(0);
  useEffect(() => {
    if (!open) return;

    const term = value.trim();
    const currentRun = ++runId.current;
    setLoading(true);
    setError(null);

    const timer = setTimeout(async () => {
      try {
        const params = term ? `?search=${encodeURIComponent(term)}` : '';
        const res = await apiFetch(`/reference/store-locations${params}`);
        const data = await res.json().catch(() => null);
        if (currentRun !== runId.current) return; // a newer query superseded this one
        if (!res.ok) {
          setError(apiErrorMessage(data, 'Could not load store locations.'));
          setResults([]);
          return;
        }
        setResults((data?.locations ?? []) as StoreLocation[]);
      } catch {
        if (currentRun !== runId.current) return;
        setError('Could not reach the server.');
        setResults([]);
      } finally {
        if (currentRun === runId.current) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [value, open]);

  // Close the dropdown when clicking outside the component.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  const trimmed = value.trim();

  // Show "Create new" whenever there's typed text with no exact (case-insensitive)
  // name match among the results — the typed value would be a brand-new branch.
  const hasExactMatch = useMemo(
    () => results.some((r) => r.name.toLowerCase() === trimmed.toLowerCase()),
    [results, trimmed],
  );
  const showCreateNew = trimmed !== '' && !hasExactMatch;

  const handleSelect = (location: StoreLocation) => {
    if (location.already_registered) return; // disabled rows are not selectable
    onSelectReference(location);
    setOpen(false);
  };

  const handleCreateNew = () => {
    onCreateNew(trimmed);
    setOpen(false);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A09C] pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className={
            className ??
            'w-full h-[34px] pl-8 pr-3 text-[13px] border border-[#E4E4E0] rounded-lg bg-[#F7F7F6] outline-none focus:border-[#185FA5]'
          }
          autoComplete="off"
        />
        {loading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#A0A09C] animate-spin" />
        )}
      </div>

      {open && (
        <div className="absolute z-[60] mt-1 w-full bg-white border border-[#E4E4E0] rounded-lg shadow-lg max-h-[240px] overflow-y-auto">
          {error && (
            <div className="px-3 py-2.5 text-[12px] text-[#C0392B]">{error}</div>
          )}

          {!error && results.length === 0 && !loading && !showCreateNew && (
            <div className="px-3 py-2.5 text-[12px] text-[#6B6B67]">
              {trimmed === '' ? 'Start typing to search known locations…' : 'No matching locations.'}
            </div>
          )}

          {!error &&
            results.map((location) => {
              const disabled = location.already_registered;
              return (
                <button
                  key={location.id}
                  type="button"
                  disabled={disabled}
                  onClick={() => handleSelect(location)}
                  className={`w-full text-left px-3 py-2 border-b border-[#F0F0EE] last:border-b-0 flex items-start gap-2 transition-colors ${
                    disabled
                      ? 'opacity-55 cursor-not-allowed'
                      : 'hover:bg-[#F7F7F6] cursor-pointer'
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] text-[#1A1A18] truncate">{location.name}</div>
                    <div className="text-[11px] text-[#6B6B67] truncate">
                      {location.full_address}
                      {location.province ? ` · ${location.province}` : ''}
                    </div>
                  </div>
                  {disabled ? (
                    <span className="flex-shrink-0 px-2 py-0.5 bg-[#F0F0EE] text-[#6B6B67] text-[10px] rounded-md mt-0.5">
                      Already registered
                    </span>
                  ) : (
                    <Check className="flex-shrink-0 w-3.5 h-3.5 text-transparent mt-0.5" />
                  )}
                </button>
              );
            })}

          {!error && showCreateNew && (
            <button
              type="button"
              onClick={handleCreateNew}
              className="w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-[#E6F1FB] cursor-pointer border-t border-[#E4E4E0] transition-colors"
            >
              <Plus className="flex-shrink-0 w-3.5 h-3.5 text-[#185FA5]" />
              <span className="text-[13px] text-[#185FA5]">
                Create new branch: “{trimmed}”
              </span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}
