'use client';

import { useQuery } from '@tanstack/react-query';
import { Button } from '../../components/ui/button';
import { fetchJson } from '../../lib/api';
import { CYLINDER_SIZES, type BranchRewardItem, type PointRates } from '../../lib/household-rewards';

export function HouseholdRewardDetails({ branchId }: { branchId: string }) {
  const configuration = useQuery({
    queryKey: ['owner-household-rewards', branchId],
    queryFn: async () => {
      const query = new URLSearchParams({ branchId });
      const [catalog, configuration] = await Promise.all([
        fetchJson<{ catalogItems: BranchRewardItem[] }>(`/loyalty/catalog?${query}`),
        fetchJson<{ settings: { point_rates: PointRates } }>(`/loyalty/settings?${query}`),
      ]);
      return { catalog: catalog.catalogItems, rates: configuration.settings.point_rates };
    },
  });

  return (
    <details className="mb-5 rounded-xl border border-gray-200 bg-white p-5">
      <summary className="cursor-pointer font-semibold text-gray-900">Household rewards catalog and point rates</summary>
      {configuration.isPending && <p className="mt-4 text-sm text-gray-600">Loading Household rewards…</p>}
      {configuration.error && (
        <div role="alert" className="mt-4 flex items-center gap-3 text-sm text-red-700">
          {configuration.error.message}
          <Button size="sm" variant="outline" onClick={() => void configuration.refetch()}>Retry</Button>
        </div>
      )}
      {configuration.data && (
        <div className="mt-4 space-y-4 text-sm">
          <p className="text-gray-600">The Franchise Administrator manages this catalog and the points earned per cylinder.</p>
          <dl className="flex flex-wrap gap-4">
            {CYLINDER_SIZES.map((size) => (
              <div key={size} className="rounded-lg bg-gray-50 px-4 py-2">
                <dt className="text-gray-600">{size}</dt>
                <dd className="font-semibold">{configuration.data.rates[size]} pts</dd>
              </div>
            ))}
          </dl>
          {configuration.data.catalog.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="border-b text-gray-600"><tr><th className="py-2">Reward</th><th>Point cost</th><th>Branch stock</th><th>Availability</th></tr></thead>
                <tbody>
                  {configuration.data.catalog.map((item) => (
                    <tr key={item.id} className="border-b last:border-0">
                      <td className="py-2 pr-3">{item.name}</td><td>{item.points_cost} pts</td><td>{item.stock_qty}</td>
                      <td>{!item.is_active ? 'Unavailable' : item.stock_qty > 0 ? 'Available' : 'Out of stock'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <p className="text-gray-600">No Household rewards have been configured.</p>}
        </div>
      )}
    </details>
  );
}
