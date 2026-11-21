'use client';

import { useAccount } from '../contexts/AccountContext';
import { useOperatingHours } from '../lib/branchOperatingHours';

function formatTime(time: string) {
  const [hours, minutes] = time.split(':');
  const hour = Number(hours);
  return `${hour % 12 || 12}:${minutes} ${hour < 12 ? 'AM' : 'PM'}`;
}

export function BranchOperatingHours({ branchId }: { branchId: string }) {
  const account = useAccount();
  const hours = useOperatingHours(account.id, branchId);

  if (hours.isPending) return <span role="status">Loading operating hours…</span>;
  if (hours.isError) return (
    <span role="status">
      Operating hours unavailable.{' '}
      <button type="button" className="underline" disabled={hours.isFetching} onClick={() => void hours.refetch()}>Retry</button>
    </span>
  );

  const schedule = hours.data.operatingHours;
  if (!schedule) return <span>Operating hours not set.</span>;

  const { openingTime, closingTime } = schedule;
  return (
    <span>
      {formatTime(openingTime)} – {formatTime(closingTime)}
      {closingTime < openingTime ? ' (next day)' : ''} Philippine time
    </span>
  );
}
