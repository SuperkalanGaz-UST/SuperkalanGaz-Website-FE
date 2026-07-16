import { useMemo, useState } from 'react';
import { BadgePercent, CheckCircle2, CircleDollarSign, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { Header } from './Header';
import { useBranch } from '../contexts/BranchContext';

interface PriceRow {
  id: string;
  size: string;
  basePrice: number;
  defaultMarkup: number;
}

// Demo pricing until API wiring lands; FA-owned base prices must come from the backend.
const PRICE_ROWS: PriceRow[] = [
  { id: '50kg', size: '50kg Cylinder', basePrice: 1500, defaultMarkup: 120 },
  { id: '22kg', size: '22kg Cylinder', basePrice: 1100, defaultMarkup: 85 },
  { id: '11kg', size: '11kg Cylinder', basePrice: 650, defaultMarkup: 55 },
  { id: '5kg', size: '5kg Cylinder', basePrice: 350, defaultMarkup: 30 },
  { id: '2.7kg', size: '2.7kg Cylinder', basePrice: 200, defaultMarkup: 20 },
];

type MarkupState = Record<string, string>;
type BranchMarkupState = Record<string, MarkupState>;

const currencyFormatter = new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 2,
});

function buildDefaultMarkups(): MarkupState {
  return PRICE_ROWS.reduce<MarkupState>((markups, row) => {
    markups[row.id] = row.defaultMarkup.toString();
    return markups;
  }, {});
}

function parseMarkup(value: string): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

export function BranchPricing() {
  const { selectedBranch } = useBranch();
  const [branchMarkups, setBranchMarkups] = useState<BranchMarkupState>(() => ({
    [selectedBranch]: buildDefaultMarkups(),
  }));
  const markups = branchMarkups[selectedBranch] ?? buildDefaultMarkups();

  const totalBasePrice = useMemo(
    () => PRICE_ROWS.reduce((total, row) => total + row.basePrice, 0),
    [],
  );

  const totalMarkup = useMemo(
    () => PRICE_ROWS.reduce((total, row) => total + parseMarkup(markups[row.id]), 0),
    [markups],
  );

  const averageMarkupRate = totalBasePrice === 0 ? 0 : (totalMarkup / totalBasePrice) * 100;

  const handleMarkupChange = (id: string, value: string) => {
    const normalized = value.replace(/[^\d.]/g, '');
    setBranchMarkups((current) => ({
      ...current,
      [selectedBranch]: {
        ...(current[selectedBranch] ?? buildDefaultMarkups()),
        [id]: normalized,
      },
    }));
  };

  const handleReset = () => {
    setBranchMarkups((current) => ({
      ...current,
      [selectedBranch]: buildDefaultMarkups(),
    }));
  };

  const handleSave = () => {
    toast.success(`${selectedBranch} pricing markup saved`, {
      style: {
        background: '#22c55e',
        color: '#ffffff',
        border: 'none',
      },
    });
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Pricing" />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Base Catalog</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  {currencyFormatter.format(totalBasePrice)}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-blue-50 flex items-center justify-center text-[#007BC1]">
                <CircleDollarSign className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Branch Markup</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  {currencyFormatter.format(totalMarkup)}
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center text-orange-600">
                <BadgePercent className="w-4 h-4" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-100 shadow-sm p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-gray-500">Average Markup</p>
                <p className="text-2xl font-semibold text-gray-900 mt-2">
                  {averageMarkupRate.toFixed(1)}%
                </p>
              </div>
              <div className="w-9 h-9 rounded-full bg-green-50 flex items-center justify-center text-green-600">
                <CheckCircle2 className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Branch Retail Pricing</h3>
              <p className="text-sm text-gray-500 mt-1">
                Base prices are set by the Franchise Administrator. Markup applies only to {selectedBranch}.
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Cylinder Size
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    FA Base Price
                  </th>
                  <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Branch Markup
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Branch Price
                  </th>
                  <th className="text-right px-6 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                    Markup Rate
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {PRICE_ROWS.map((row) => {
                  const markup = parseMarkup(markups[row.id]);
                  const branchPrice = row.basePrice + markup;
                  const markupRate = row.basePrice === 0 ? 0 : (markup / row.basePrice) * 100;

                  return (
                    <tr key={row.id} className="hover:bg-gray-50/70">
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">{row.size}</td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right">
                        {currencyFormatter.format(row.basePrice)}
                      </td>
                      <td className="px-6 py-4">
                        <label className="sr-only" htmlFor={`markup-${row.id}`}>
                          {row.size} markup
                        </label>
                        <div className="relative w-40">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-500">
                            ₱
                          </span>
                          <input
                            id={`markup-${row.id}`}
                            type="text"
                            inputMode="decimal"
                            value={markups[row.id]}
                            onChange={(event) => handleMarkupChange(row.id, event.target.value)}
                            className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-3 text-sm text-gray-900 outline-none focus:border-transparent focus:ring-2 focus:ring-[#007BC1]"
                          />
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900 text-right">
                        {currencyFormatter.format(branchPrice)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700 text-right">
                        {markupRate.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 border-t border-gray-100 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex items-center justify-center rounded-lg bg-[#007BC1] px-5 py-2 text-sm font-medium text-white hover:bg-[#00568A] transition-colors"
            >
              Save Markup
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
