import { apiErrorMessage, apiPublicFetch } from './api';

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
  token: string,
): Promise<DeliveryRiderInvitation> {
  const response = await apiPublicFetch(
    `/delivery-rider-invitations/acceptance?token=${encodeURIComponent(token)}`,
  );
  return responseData(response, 'This invitation is unavailable.');
}

export async function createDeliveryRiderAccount(
  token: string,
  password: string,
): Promise<ApiResult> {
  const response = await apiPublicFetch('/delivery-rider-invitations/account', {
    method: 'POST',
    body: JSON.stringify({ token, password }),
  });
  return responseData(response, 'Could not create the Delivery Rider account.');
}

export async function sendDeliveryRiderMobileCode(token: string): Promise<ApiResult> {
  const response = await apiPublicFetch('/delivery-rider-invitations/mobile-code', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  return responseData(response, 'Could not send the verification code.');
}

export async function verifyDeliveryRiderMobile(
  token: string,
  code: string,
): Promise<ApiResult> {
  const response = await apiPublicFetch('/delivery-rider-invitations/verify-mobile', {
    method: 'POST',
    body: JSON.stringify({ token, code }),
  });
  return responseData(response, 'The verification code could not be confirmed.');
}

export async function acceptDeliveryRiderInvitation(token: string): Promise<ApiResult> {
  const response = await apiPublicFetch('/delivery-rider-invitations/accept', {
    method: 'POST',
    body: JSON.stringify({ token }),
  });
  return responseData(response, 'Could not activate the Delivery Rider account.');
}
