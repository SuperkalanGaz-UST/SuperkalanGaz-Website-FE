import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiErrorMessage, apiFetch } from '../lib/api';
import type { GovernanceRequest, GovernanceRequestType } from '../super-admin/types';

interface GovernanceSubmission {
  type: GovernanceRequestType;
  title: string;
  reason: string;
  riskLevel: GovernanceRequest['risk_level'];
  branchId?: string;
  payload: Record<string, unknown>;
  revisesRequestId?: string;
}

export function useSubmitGovernanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ revisesRequestId, ...submission }: GovernanceSubmission) => {
      const path = revisesRequestId
        ? `/governance/requests/${encodeURIComponent(revisesRequestId)}/revise`
        : '/governance/requests';
      const response = await apiFetch(path, {
        method: 'POST',
        body: JSON.stringify(submission),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        if (revisesRequestId && response.status === 404) {
          throw new Error('Revisions are temporarily unavailable. Please try again later.');
        }
        const body: unknown = await response.json().catch(() => null);
        throw new Error(apiErrorMessage(body, 'Could not submit the governance request.'));
      }
    },
    onSuccess: () => {
      toast.success('Request submitted for Super Administrator review.');
      window.dispatchEvent(new Event('notifications:refresh'));
      void queryClient.invalidateQueries({ queryKey: ['governance-requests'] });
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
}
