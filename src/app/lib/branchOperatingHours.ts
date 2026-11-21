import { useQuery } from '@tanstack/react-query';
import { fetchJson } from './api';

export interface OperatingHours {
  openingTime: string;
  closingTime: string;
}

interface OperatingHoursResponse {
  operatingHours: OperatingHours | null;
}

export const operatingHoursKey = (accountId: string, branchId: string) =>
  ['branch-operating-hours', accountId, branchId] as const;

const operatingHoursPath = (branchId: string) => `/branches/${encodeURIComponent(branchId)}/operating-hours`;

export function useOperatingHours(accountId: string, branchId: string) {
  return useQuery({
    queryKey: operatingHoursKey(accountId, branchId),
    queryFn: ({ signal }) => fetchJson<OperatingHoursResponse>(operatingHoursPath(branchId), {
      signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
    }),
    retry: false,
  });
}

export function saveOperatingHours(branchId: string, hours: OperatingHours) {
  return fetchJson<OperatingHoursResponse>(operatingHoursPath(branchId), {
    method: 'PATCH',
    body: JSON.stringify(hours),
    signal: AbortSignal.timeout(10_000),
  });
}
