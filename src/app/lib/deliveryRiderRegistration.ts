import { apiErrorMessage, apiFetch, apiPublicFetch } from './api';
import { supabase } from './supabase/client';

export type DeliveryRiderRegistrationCredential =
  | { mode: 'token'; token: string }
  | { mode: 'session' };

export interface DeliveryRiderInvitation {
  invitationId: string;
  recipientName: string;
  email: string;
  mobile: string;
  branchName: string;
  expiresAt: string;
  emailVerified: boolean;
  accountCreated: boolean;
  mobileVerified: boolean;
}

interface ApiResult {
  message?: string;
}

async function responseData<T>(response: Response, fallback: string): Promise<T> {
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) throw new Error(apiErrorMessage(data, fallback));
  return data as T;
}

export async function getDeliveryRiderInvitation(
  credential: DeliveryRiderRegistrationCredential,
): Promise<DeliveryRiderInvitation> {
  const response = credential.mode === 'session'
    ? await apiFetch('/delivery-rider-invitations/session/acceptance')
    : await apiPublicFetch(
        `/delivery-rider-invitations/acceptance?token=${encodeURIComponent(credential.token)}`,
      );
  return responseData(response, 'This invitation is unavailable.');
}

export async function createDeliveryRiderAccount(
  credential: DeliveryRiderRegistrationCredential,
  password: string,
): Promise<ApiResult> {
  const request = credential.mode === 'session' ? apiFetch : apiPublicFetch;
  const path = credential.mode === 'session'
    ? '/delivery-rider-invitations/session/account'
    : '/delivery-rider-invitations/account';
  const body = credential.mode === 'session'
    ? { password }
    : { token: credential.token, password };
  const response = await request(path, {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return responseData(response, 'Could not create the Delivery Rider account.');
}

export async function acceptDeliveryRiderInvitation(
  credential: DeliveryRiderRegistrationCredential,
): Promise<ApiResult> {
  const request = credential.mode === 'session' ? apiFetch : apiPublicFetch;
  const path = credential.mode === 'session'
    ? '/delivery-rider-invitations/session/accept'
    : '/delivery-rider-invitations/accept';
  const response = await request(path, {
    method: 'POST',
    ...(credential.mode === 'token'
      ? { body: JSON.stringify({ token: credential.token }) }
      : {}),
  });
  return responseData(response, 'Could not accept the Delivery Rider invitation.');
}

/** Delivery Riders have no web workspace, so registration ends the browser session. */
export async function clearDeliveryRiderWebSession(): Promise<void> {
  await supabase.auth.signOut({ scope: 'local' });
}
