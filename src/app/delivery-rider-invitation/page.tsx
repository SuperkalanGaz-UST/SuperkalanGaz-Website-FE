import type { Metadata } from 'next';
import { DeliveryRiderWebRegistration } from './DeliveryRiderWebRegistration';

const INVITATION_TOKEN = /^[A-Za-z0-9_-]{32,256}$/;

type InvitationPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Delivery Rider registration | Superkalan Gaz',
  description: 'Complete a secure Superkalan Gaz Delivery Rider invitation.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};

function singleValue(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function safeDownloadUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export default async function DeliveryRiderInvitationPage({
  searchParams,
}: InvitationPageProps) {
  const params = await searchParams;
  const candidate = singleValue(params.token).trim();
  const token = INVITATION_TOKEN.test(candidate) ? candidate : null;
  const sessionMode = !token && singleValue(params.session) === 'verified';
  return (
    <DeliveryRiderWebRegistration
      token={token}
      sessionMode={sessionMode}
      androidDownloadUrl={safeDownloadUrl(process.env.MOBILE_APP_ANDROID_DOWNLOAD_URL)}
      iosDownloadUrl={safeDownloadUrl(process.env.MOBILE_APP_IOS_DOWNLOAD_URL)}
    />
  );
}
