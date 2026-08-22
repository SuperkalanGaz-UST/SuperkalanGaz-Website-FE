import { apiErrorMessage, apiFetch } from '../lib/api';
import type {
  AdminAccount,
  AuditCategory,
  AuditEvent,
  GovernanceDashboardData,
  GovernanceRequest,
  GovernanceRequestType,
  SecuritySummary,
} from './types';

async function json<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await apiFetch(path, {
      ...init,
      // A stopped or unhealthy API container must not leave the independent
      // web container spinning forever. Existing data stays rendered by each
      // screen while its retry state is shown.
      signal: init?.signal ?? AbortSignal.timeout(10_000),
    });
  } catch {
    throw new Error(
      'The governance API is unavailable. The web dashboard is still running; retry after the API recovers.',
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    if (response.status >= 500) {
      throw new Error(
        'The governance API could not complete this request. Other dashboard areas remain available.',
      );
    }
    throw new Error(apiErrorMessage(body, 'The governance request could not be completed.'));
  }
  return body as T;
}

export const governanceApi = {
  dashboard: () => json<GovernanceDashboardData>('/governance/dashboard'),

  requests: async (type?: GovernanceRequestType) => {
    const params = new URLSearchParams({ limit: '200' });
    if (type) params.set('type', type);
    const body = await json<{ requests: GovernanceRequest[] }>(
      `/governance/requests?${params.toString()}`,
    );
    return body.requests;
  },

  decide: (
    id: string,
    decision: 'approve' | 'reject' | 'request-revision',
    reason: string,
  ) =>
    json<{ request: GovernanceRequest; temporary_password?: string }>(
      `/governance/requests/${id}/decision`,
      {
        method: 'PATCH',
        body: JSON.stringify({ decision, reason }),
      },
    ),

  adminAccounts: () =>
    json<{ accounts: AdminAccount[]; requests: GovernanceRequest[] }>(
      '/governance/admin-accounts',
    ),

  audit: async (category?: AuditCategory) => {
    const params = new URLSearchParams({ limit: '500' });
    if (category) params.set('category', category);
    const body = await json<{ events: AuditEvent[] }>(
      `/governance/audit?${params.toString()}`,
    );
    return body.events;
  },

  security: () => json<SecuritySummary>('/governance/security'),
};
