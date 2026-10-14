import App from './App';
import { redirect } from 'next/navigation';

const INVITATION_TOKEN = /^[A-Za-z0-9_-]{32,256}$/;

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const rawToken = params.token;
  const token = Array.isArray(rawToken) ? rawToken[0] : rawToken;

  // Preserve older invitation URLs that targeted the web root so they never
  // fall through to the internal staff login screen.
  if (token && INVITATION_TOKEN.test(token)) {
    redirect(`/delivery-rider-invitation?token=${encodeURIComponent(token)}`);
  }

  return <App />;
}
