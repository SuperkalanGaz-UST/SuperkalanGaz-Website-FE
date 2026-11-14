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
}

export function useSubmitGovernanceRequest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (submission: GovernanceSubmission) => {
      const response = await apiFetch('/governance/requests', {
        method: 'POST',
        body: JSON.stringify(submission),
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
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
