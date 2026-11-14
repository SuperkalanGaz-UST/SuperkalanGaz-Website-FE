'use client';

import { useState, type FormEvent } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Header } from '../../components/Header';
import { Button } from '../../components/ui/button';
import { Input } from '../../components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { apiErrorMessage, apiFetch, fetchJson } from '../../lib/api';
import { CYLINDER_SIZES, type PointRates, type RewardItem } from '../../lib/household-rewards';

const catalogPath = '/loyalty/franchise/catalog';
const pointRatesPath = '/loyalty/franchise/point-rates';
const card = 'rounded-xl border border-gray-200 bg-white p-6';
const label = 'grid gap-1.5 text-sm font-medium text-gray-700';

async function fetchRewardsConfiguration<T>(path: string): Promise<T> {
  const response = await apiFetch(path);
  if (response.status === 404) {
    throw new Error('Household Rewards is unavailable on the connected API. Try again after the API is updated.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(data, 'Could not load Household Rewards.'));
  return data as T;
}

export function HouseholdRewards() {
  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <Header title="Household Rewards" />
      <main className="mx-auto max-w-6xl px-8 pb-10">
        <Tabs defaultValue="catalog">
          <TabsList aria-label="Household rewards configuration">
            <TabsTrigger value="catalog">Rewards Catalog</TabsTrigger>
            <TabsTrigger value="rates">Points per Cylinder</TabsTrigger>
          </TabsList>
          <TabsContent value="catalog"><RewardsCatalog /></TabsContent>
          <TabsContent value="rates"><CylinderPointRates /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function RewardsCatalog() {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<RewardItem | 'new' | null>(null);
  const catalog = useQuery({
    queryKey: ['franchise-household-catalog'],
    queryFn: () => fetchRewardsConfiguration<{ catalogItems: RewardItem[] }>(catalogPath),
  });
  const save = useMutation({
    mutationFn: (input: { id?: string; name: string; description: string; pointsCost: number; isActive: boolean }) => {
      const { id, ...body } = input;
      return fetchJson<{ catalogItem: RewardItem }>(id ? `${catalogPath}/${id}` : catalogPath, {
        method: id ? 'PATCH' : 'POST',
        body: JSON.stringify(body),
      });
    },
    onSuccess: async ({ catalogItem }) => {
      await queryClient.invalidateQueries({ queryKey: ['franchise-household-catalog'] });
      setEditing(null);
      toast.success(`${catalogItem.name} saved.`);
    },
  });
  const selectItem = (item: RewardItem | 'new' | null) => {
    save.reset();
    setEditing(item);
  };
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const form = new FormData(event.currentTarget);
    save.mutate({
      id: editing && editing !== 'new' ? editing.id : undefined,
      name: String(form.get('name')).trim(),
      description: String(form.get('description')).trim(),
      pointsCost: Number(form.get('pointsCost')),
      isActive: form.get('isActive') === 'on',
    });
  }
  const item = editing === 'new' ? null : editing;

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rewards Catalog</h2>
          <p className="mt-1 text-sm text-gray-600">Names, point costs, and availability apply across the franchise. Branch Managers receive reward stock through Inventory.</p>
        </div>
        {!editing && <Button onClick={() => selectItem('new')} disabled={catalog.isPending || catalog.isError}>Add reward</Button>}
      </div>
      {editing && (
        <form key={item?.id ?? 'new'} onSubmit={submit} className="my-5 grid gap-4 rounded-lg border border-gray-200 bg-gray-50 p-4">
          <h3 className="font-semibold">{item ? `Edit ${item.name}` : 'Add reward'}</h3>
          <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2">
            <label className={label}>Reward name<Input name="name" required maxLength={100} defaultValue={item?.name} /></label>
            <label className={label}>Point cost<Input name="pointsCost" type="number" required min={1} max={2147483647} step={1} defaultValue={item?.points_cost} /></label>
            <label className={label}>Description<Input name="description" maxLength={500} defaultValue={item?.description ?? ''} /></label>
            <label className="flex items-end gap-2 pb-2 text-sm"><input type="checkbox" name="isActive" defaultChecked={item?.is_active ?? true} /> Available for redemption</label>
          </fieldset>
          {save.error && <p role="alert" className="text-sm text-red-700">{save.error.message}</p>}
          <div className="flex gap-2">
            <Button type="submit" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save reward'}</Button>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={() => selectItem(null)}>Cancel</Button>
          </div>
        </form>
      )}
      {catalog.isPending && <p className="mt-6 text-sm text-gray-600">Loading catalog…</p>}
      {catalog.error && <div role="alert" className="mt-6 flex items-center gap-3 text-sm text-red-700">{catalog.error.message}<Button variant="outline" onClick={() => void catalog.refetch()}>Retry</Button></div>}
      {catalog.isSuccess && (catalog.data.catalogItems.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b text-gray-600"><tr><th className="py-3">Reward</th><th>Point cost</th><th>Availability</th><th><span className="sr-only">Edit</span></th></tr></thead>
            <tbody>
              {catalog.data.catalogItems.map((reward) => (
                <tr key={reward.id} className="border-b last:border-0">
                  <td className="py-3 pr-3"><p className="font-medium text-gray-900">{reward.name}</p>{reward.description && <p className="text-gray-600">{reward.description}</p>}</td>
                  <td className="pr-3">{reward.points_cost.toLocaleString()} pts</td>
                  <td className="pr-3">{reward.is_active ? 'Available' : 'Unavailable'}</td>
                  <td className="text-right"><Button variant="outline" size="sm" disabled={save.isPending} onClick={() => selectItem(reward)} aria-label={`Edit ${reward.name}`}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-6 text-sm text-gray-600">No rewards in the catalog yet.</p>)}
    </section>
  );
}

function CylinderPointRates() {
  const queryClient = useQueryClient();
  const rates = useQuery({
    queryKey: ['franchise-household-rates'],
    queryFn: () => fetchRewardsConfiguration<{ point_rates: PointRates }>(pointRatesPath),
  });
  const save = useMutation({
    mutationFn: (pointRates: PointRates) => fetchJson<{ point_rates: PointRates }>(pointRatesPath, {
      method: 'PATCH',
      body: JSON.stringify(pointRates),
    }),
    onSuccess: (data) => {
      queryClient.setQueryData(['franchise-household-rates'], data);
      toast.success('Points per cylinder saved.');
    },
  });
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (save.isPending) return;
    const form = new FormData(event.currentTarget);
    const values = Object.fromEntries(CYLINDER_SIZES.map((size) => [size, Number(form.get(size))])) as PointRates;
    save.mutate(values);
  }

  return (
    <section className={card}>
      <h2 className="text-lg font-semibold text-gray-900">Points per Cylinder</h2>
      <p className="mt-1 text-sm text-gray-600">Each cylinder earns its size’s rate when the Service Request is delivered. New rates apply to future deliveries.</p>
      {rates.isPending && <p className="mt-6 text-sm text-gray-600">Loading rates…</p>}
      {rates.error && <div role="alert" className="mt-6 flex items-center gap-3 text-sm text-red-700">{rates.error.message}<Button variant="outline" onClick={() => void rates.refetch()}>Retry</Button></div>}
      {rates.isSuccess && (
        <form key={JSON.stringify(rates.data.point_rates)} onSubmit={submit} className="mt-6">
          <fieldset disabled={save.isPending} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {CYLINDER_SIZES.map((size) => (
              <label key={size} className={label}>{size}<Input name={size} type="number" min={0} max={10000} step={1} required defaultValue={rates.data.point_rates[size]} /></label>
            ))}
          </fieldset>
          {save.error && <p role="alert" className="mt-4 text-sm text-red-700">{save.error.message}</p>}
          <Button type="submit" className="mt-5" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save point rates'}</Button>
        </form>
      )}
    </section>
  );
}
