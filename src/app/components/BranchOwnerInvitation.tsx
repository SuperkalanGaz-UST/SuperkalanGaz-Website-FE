import { useEffect, useState } from 'react';
import { isAuthRetryableFetchError, type AuthError } from '@supabase/supabase-js';
import { isPendingBranchOwnerInvitation } from '../lib/auth';
import { supabase } from '../lib/supabase/client';
import { Login } from './Login';

const MAX_TOKEN_HASH_LENGTH = 256;
const LEGACY_CALLBACK_WAIT_MS = 4_000;
const BUTTON = 'block w-full rounded-md bg-[#007BC1] px-4 py-3.5 text-center font-medium text-white hover:bg-[#006399] disabled:opacity-60';

type InvitationState =
  | { step: 'checking' }
  | { step: 'unavailable' }
  | { step: 'retry' }
  | { step: 'password' }
  | { step: 'verify'; tokenHash: string; busy?: boolean; retry?: boolean };

function clearCallback(unavailable = false) {
  const url = new URL(window.location.href);
  url.hash = '';
  if (unavailable) url.search = '?invitation=branch-owner&link=unavailable';
  window.history.replaceState(window.history.state, '', url);
}

function canRetry(error: AuthError | null): boolean {
  return Boolean(error && (
    isAuthRetryableFetchError(error) || error.status === 429 || (error.status ?? 0) >= 500
  ));
}

export function BranchOwnerInvitation() {
  const [state, setState] = useState<InvitationState>({ step: 'checking' });

  useEffect(() => {
    const url = new URL(window.location.href);
    const fragment = new URLSearchParams(url.hash.slice(1));
    if (url.searchParams.get('link') === 'unavailable' ||
        ['error', 'error_code', 'error_description'].some(
          (key) => fragment.has(key) || url.searchParams.has(key),
        )) {
      clearCallback(true);
      setState({ step: 'unavailable' });
      return;
    }

    const tokenHash = fragment.get('token_hash');
    if (tokenHash !== null) {
      // Supabase owns the token format and verifies authenticity on click.
      if (tokenHash.length > 0 && tokenHash.length <= MAX_TOKEN_HASH_LENGTH) {
        setState({ step: 'verify', tokenHash });
      } else {
        clearCallback(true);
        setState({ step: 'unavailable' });
      }
      return;
    }

    let current = true;
    const timer = window.setTimeout(() => {
      current = false;
      setState({ step: 'retry' });
    }, LEGACY_CALLBACK_WAIT_MS);

    // Older emails already exchanged their token at Supabase. Inspect that
    // initialization result before reading storage so a failed callback never
    // falls back to a different account's previously saved session.
    void (async () => {
      try {
        const initialized = await supabase.auth.initialize();
        const { data, error } = initialized.error
          ? { data: null, error: initialized.error }
          : await supabase.auth.getSession();
        if (!current) return;
        if (canRetry(error)) {
          setState({ step: 'retry' });
        } else if (!error && data?.session && isPendingBranchOwnerInvitation(data.session.user)) {
          clearCallback();
          setState({ step: 'password' });
        } else {
          clearCallback(true);
          setState({ step: 'unavailable' });
        }
      } catch {
        if (current) setState({ step: 'retry' });
      } finally {
        window.clearTimeout(timer);
      }
    })();

    return () => {
      current = false;
      window.clearTimeout(timer);
    };
  }, []);

  const verifyInvitation = async () => {
    if (state.step !== 'verify' || state.busy) return;
    const { tokenHash } = state;
    setState({ step: 'verify', tokenHash, busy: true });
    try {
      // This POST runs only after the recipient clicks. Opening or scanning
      // the URL does not spend its single-use email token.
      const { data, error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: 'email' });
      if (canRetry(error)) {
        setState({ step: 'verify', tokenHash, retry: true });
      } else if (!error && data.session && isPendingBranchOwnerInvitation(data.session.user)) {
        clearCallback();
        setState({ step: 'password' });
      } else {
        clearCallback(true);
        setState({ step: 'unavailable' });
      }
    } catch {
      setState({ step: 'verify', tokenHash, retry: true });
    }
  };

  if (state.step === 'password') {
    return (
      <Login
        invitationActivation
        invitationRole="branch-owner"
        onInvitationActivation={() => window.location.replace('/branch-owner/dashboard')}
      />
    );
  }

  return (
    <Login invitationContent={
      <>
        <h1 className="text-3xl font-bold text-gray-900">
          {state.step === 'unavailable' ? 'Invitation unavailable' : 'Set Password'}
        </h1>
        {state.step === 'unavailable' ? (
          <>
            <p role="alert" className="my-6 text-sm leading-6 text-gray-700">
              This Branch Owner invitation is invalid, expired, or already used. If you still
              need to set your password, ask your Franchise Administrator to resend the invitation.
            </p>
            <button type="button" className={BUTTON} onClick={() => window.location.replace('/')}>Back to Sign In</button>
          </>
        ) : state.step === 'checking' ? (
          <p role="status" className="mt-4 text-sm text-gray-700">Checking your Branch Owner invitation…</p>
        ) : (
          <>
            <p className="my-6 text-sm leading-6 text-gray-700">
              Verify your Branch Owner invitation to choose your password.
            </p>
            {(state.step === 'retry' || state.retry) && (
              <p role="alert" className="mb-4 text-sm text-red-600">
                We couldn’t verify the invitation right now. Please try again.
              </p>
            )}
            {state.step === 'retry' ? (
              <button type="button" className={BUTTON} onClick={() => window.location.reload()}>Try again</button>
            ) : (
              <button type="button" className={BUTTON} disabled={state.busy} onClick={verifyInvitation}>
                {state.busy ? 'Verifying invitation…' : 'Verify invitation'}
              </button>
            )}
          </>
        )}
      </>
    } />
  );
}
