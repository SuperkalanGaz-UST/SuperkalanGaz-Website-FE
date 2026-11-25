'use client';

import { useEffect, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { Gift, ImagePlus, Plus } from 'lucide-react';
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
const card = 'rounded-xl border border-gray-100 bg-white p-5 shadow-sm sm:p-6';
const primaryAction = 'rounded-lg bg-[#007BC1] font-semibold text-white hover:bg-[#006aa6] focus-visible:ring-[#007BC1]/35';
const secondaryAction = 'rounded-lg border-[#007BC1]/25 bg-white font-semibold text-[#00568A] hover:bg-blue-50 hover:text-[#00568A] focus-visible:ring-[#007BC1]/35';
const field = 'rounded-lg border-gray-300 bg-white focus-visible:border-[#007BC1] focus-visible:ring-[#007BC1]/20';
const photoLimit = 2 * 1024 * 1024;
const photoMaxEdge = 1200;
const tab = 'h-10 rounded-lg data-[state=active]:bg-[#007BC1] data-[state=active]:text-white text-gray-700 focus-visible:ring-[#007BC1]/30';
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
    <div className="flex-1 overflow-y-auto bg-gray-50">
      <Header title="Household Rewards" />
      <main className="p-4 sm:p-8">
        <Tabs defaultValue="catalog" className="gap-5">
          <TabsList aria-label="Household rewards configuration" className="h-auto max-w-full gap-1 rounded-xl border border-gray-100 bg-white p-1 shadow-sm">
            <TabsTrigger value="catalog" className={tab}>Rewards Catalog</TabsTrigger>
            <TabsTrigger value="rates" className={tab}>Points per Cylinder</TabsTrigger>
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
    queryFn: () => fetchRewardsConfiguration<{ catalogItems: RewardItem[]; photo_upload_supported?: boolean }>(catalogPath),
  });
  const save = useMutation({
    mutationFn: ({ id, form }: { id?: string; form: FormData }) => {
      if (form.has('photo') && !catalog.data?.photo_upload_supported) {
        throw new Error('Photo uploads are unavailable on the connected API. Refresh after the update, then retry.');
      }
      return fetchJson<{ catalogItem: RewardItem }>(id ? `${catalogPath}/${id}` : catalogPath, {
        method: id ? 'PATCH' : 'POST',
        // Keep JSON for edits without a photo, including clients on the prior API.
        body: form.has('photo') ? form : JSON.stringify({
          name: form.get('name'),
          description: form.get('description'),
          pointsCost: Number(form.get('pointsCost')),
          isActive: form.get('isActive') === 'true',
        }),
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

  return (
    <section className={card}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Rewards Catalog</h2>
          <p className="mt-1 text-sm text-gray-600">Names, point costs, and availability apply across the franchise. Branch Managers receive reward stock through Inventory.</p>
        </div>
        {!editing && <Button className={primaryAction} onClick={() => selectItem('new')} disabled={catalog.isPending || catalog.isError}><Plus aria-hidden /> Add reward</Button>}
      </div>
      {editing && (
        <RewardEditor
          key={editing === 'new' ? 'new' : editing.id}
          item={editing === 'new' ? null : editing}
          saving={save.isPending}
          error={save.error?.message}
          onCancel={() => selectItem(null)}
          onSubmit={(form) => save.mutate({ id: editing === 'new' ? undefined : editing.id, form })}
        />
      )}
      {catalog.isPending && <p className="mt-6 text-sm text-gray-600">Loading catalog…</p>}
      {catalog.error && <div role="alert" className="mt-6 flex items-center gap-3 text-sm text-red-700">{catalog.error.message}<Button variant="outline" className={secondaryAction} onClick={() => void catalog.refetch()}>Retry</Button></div>}
      {catalog.isSuccess && (catalog.data.catalogItems.length ? (
        <div className="mt-5 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-gray-100 text-gray-500">
              <tr><th scope="col" className="py-3">Reward</th><th scope="col">Point cost</th><th scope="col">Availability</th><th scope="col"><span className="sr-only">Edit</span></th></tr>
            </thead>
            <tbody>
              {catalog.data.catalogItems.map((reward) => (
                <tr key={reward.id} className="border-b border-gray-100 last:border-0">
                  <td className="py-3 pr-3">
                    <div className="flex items-center gap-3">
                      <RewardThumbnail path={reward.photo_path} name={reward.name} />
                      <div>
                        <p className="font-semibold text-gray-900">{reward.name}</p>
                        {reward.description && <p className="mt-0.5 text-gray-500">{reward.description}</p>}
                      </div>
                    </div>
                  </td>
                  <td className="pr-3">{reward.points_cost.toLocaleString()} pts</td>
                  <td className="pr-3">
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${reward.is_active ? 'bg-blue-50 text-[#00568A]' : 'bg-gray-100 text-gray-700'}`}>
                      {reward.is_active ? 'Available' : 'Unavailable'}
                    </span>
                  </td>
                  <td className="text-right"><Button variant="outline" className={secondaryAction} size="sm" disabled={save.isPending} onClick={() => selectItem(reward)} aria-label={`Edit ${reward.name}`}>Edit</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="mt-6 text-sm text-gray-600">No rewards in the catalog yet.</p>)}
    </section>
  );
}

const bundledRewardPhotos: Record<string, string> = {
  'notebook and pen': '/catalog/reward-notebook.png',
  'desk calendar': '/catalog/reward-calendar.png',
  umbrella: '/catalog/reward-umbrella.png',
  mug: '/catalog/reward-mug.png',
};

function RewardThumbnail({
  path, name, preview, large = false,
}: {
  path?: string | null;
  name?: string;
  preview?: File | null;
  large?: boolean;
}) {
  const photo = useQuery({
    queryKey: ['franchise-reward-photo', path],
    enabled: !!path && !preview,
    staleTime: Infinity,
    retry: false,
    queryFn: async ({ signal }) => {
      const response = await apiFetch(path!, { signal });
      if (!response.ok) throw new Error('Could not load reward photo.');
      return response.blob();
    },
  });
  const blob = preview ?? photo.data;
  const [objectUrl, setObjectUrl] = useState<string>();
  useEffect(() => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    setObjectUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [blob]);

  const source = blob ? objectUrl : bundledRewardPhotos[name?.toLowerCase() ?? ''];
  const size = large ? 96 : 56;
  return (
    <span className={`grid shrink-0 place-items-center overflow-hidden rounded-lg border border-gray-100 bg-gray-50 ${large ? 'size-24' : 'size-14'}`}>
      {source ? (
        <Image src={source} alt={large ? 'Reward photo preview' : ''} width={size} height={size}
          className="size-full object-contain p-1" unoptimized={source.startsWith('blob:')} />
      ) : <Gift aria-hidden className="size-5 text-gray-400" />}
    </span>
  );
}

function RewardEditor({
  item, saving, error, onCancel, onSubmit,
}: {
  item: RewardItem | null;
  saving: boolean;
  error?: string;
  onCancel: () => void;
  onSubmit: (form: FormData) => void;
}) {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoError, setPhotoError] = useState<string>();
  const [checkingPhoto, setCheckingPhoto] = useState(false);

  async function checkPhoto(input: HTMLInputElement) {
    const file = input.files?.[0] ?? null;
    setPhoto(null);
    setPhotoError(undefined);
    if (!file) return;
    if (!['image/jpeg', 'image/png'].includes(file.type) || file.size > photoLimit || !file.size) {
      setPhotoError('Choose a JPEG or PNG photo up to 2 MB.');
      return;
    }
    setCheckingPhoto(true);
    const url = URL.createObjectURL(file);
    try {
      const image = new window.Image();
      image.src = url;
      await image.decode();
      if (image.naturalWidth > photoMaxEdge || image.naturalHeight > photoMaxEdge) {
        setPhotoError(`Choose a photo within ${photoMaxEdge} × ${photoMaxEdge} pixels.`);
      } else {
        setPhoto(file);
      }
    } catch {
      setPhotoError('This photo could not be opened. Choose a valid JPEG or PNG.');
    } finally {
      URL.revokeObjectURL(url);
      setCheckingPhoto(false);
    }
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || checkingPhoto || photoError) return;
    const form = new FormData(event.currentTarget);
    form.set('isActive', String(form.get('isActive') === 'on'));
    if (photo) form.set('photo', photo);
    else form.delete('photo');
    onSubmit(form);
  }

  return (
    <form onSubmit={submit} className="my-5 grid gap-4 rounded-xl border border-gray-100 bg-gray-50 p-5">
      <h3 className="font-semibold text-gray-900">{item ? `Edit ${item.name}` : 'Add reward'}</h3>
      <fieldset disabled={saving} className="grid gap-5 sm:grid-cols-2">
        <label className={label}>Reward name<Input className={field} name="name" required maxLength={100} defaultValue={item?.name} /></label>
        <label className={label}>Point cost<Input className={field} name="pointsCost" type="number" required min={1} max={2147483647} step={1} defaultValue={item?.points_cost} /></label>
        <label className={label}>Description<Input className={field} name="description" maxLength={500} defaultValue={item?.description ?? ''} /></label>
        <label className="flex items-end gap-2 pb-2 text-sm text-gray-700"><input className="accent-[#007BC1]" type="checkbox" name="isActive" defaultChecked={item?.is_active ?? true} /> Available for redemption</label>
        <div className="flex flex-wrap items-center gap-4 sm:col-span-2">
          <RewardThumbnail key={photo ? `${photo.name}-${photo.lastModified}` : item?.photo_path ?? 'existing'} path={item?.photo_path} name={item?.name} preview={photo} large />
          <div className="grid gap-2">
            <label className={label} htmlFor="reward-photo">Reward photo <span className="sr-only">(optional)</span></label>
            <Input
              id="reward-photo"
              name="photo"
              type="file"
              accept="image/jpeg,image/png"
              aria-describedby="reward-photo-hint"
              aria-invalid={!!photoError}
              className={`${field} max-w-xs file:text-[#00568A]`}
              disabled={checkingPhoto}
              onChange={(event) => void checkPhoto(event.currentTarget)}
            />
            <p id="reward-photo-hint" className="flex items-center gap-1.5 text-xs text-gray-500"><ImagePlus size={14} aria-hidden /> Optional · JPEG or PNG · 2 MB · 1200 × 1200 px max</p>
            {photoError && (
              <button type="button" className="w-fit text-sm font-medium text-[#00568A] underline" onClick={(event) => {
                const input = event.currentTarget.form?.elements.namedItem('photo');
                if (input instanceof HTMLInputElement) input.value = '';
                setPhotoError(undefined);
              }}>Clear selection</button>
            )}
            {photoError && <p role="alert" className="text-sm text-[#CC1903]">{photoError}</p>}
          </div>
        </div>
      </fieldset>
      {error && <p role="alert" className="text-sm text-[#CC1903]">{error}</p>}
      <div className="flex gap-2">
        <Button className={primaryAction} type="submit" disabled={saving || checkingPhoto || !!photoError}>{saving ? 'Saving…' : 'Save reward'}</Button>
        <Button type="button" variant="outline" className={secondaryAction} disabled={saving} onClick={onCancel}>Cancel</Button>
      </div>
    </form>
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
      {rates.error && <div role="alert" className="mt-6 flex items-center gap-3 text-sm text-red-700">{rates.error.message}<Button variant="outline" className={secondaryAction} onClick={() => void rates.refetch()}>Retry</Button></div>}
      {rates.isSuccess && (
        <form key={JSON.stringify(rates.data.point_rates)} onSubmit={submit} className="mt-6">
          <fieldset disabled={save.isPending} className="grid grid-cols-1 gap-4 min-[420px]:grid-cols-2 md:grid-cols-3 xl:grid-cols-5">
            {CYLINDER_SIZES.map((size) => (
              <label key={size} className="grid gap-3 rounded-xl border border-gray-100 bg-white p-4 text-sm font-semibold text-gray-900">
                <span className="grid h-28 place-items-center rounded-lg bg-gray-50">
                  <span className="relative block h-24 w-24">
                    <Image src={`/catalog/${size}.png`} alt="" fill sizes="96px" className="object-contain" />
                  </span>
                </span>
                <span>{size.replace('kg', ' kg')} cylinder</span>
                <span className="flex items-center gap-2">
                  <Input className={field} aria-label={`Points per ${size.replace('kg', ' kg')} cylinder`} name={size} type="number" min={0} max={10000} step={1} required defaultValue={rates.data.point_rates[size]} />
                  <span className="font-normal text-gray-500" aria-hidden>pts</span>
                </span>
              </label>
            ))}
          </fieldset>
          {save.error && <p role="alert" className="mt-4 text-sm text-red-700">{save.error.message}</p>}
          <Button type="submit" className={`mt-5 ${primaryAction}`} disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save point rates'}</Button>
        </form>
      )}
    </section>
  );
}
