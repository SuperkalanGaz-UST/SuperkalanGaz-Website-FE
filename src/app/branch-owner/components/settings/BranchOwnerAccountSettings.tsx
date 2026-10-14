'use client';

import { FormEvent, useMemo, useState } from 'react';
import { Check, Eye, EyeOff, KeyRound, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount, useUpdateAccount } from '../../../contexts/AccountContext';
import { apiErrorMessage, apiFetch } from '../../../lib/api';
import { ROLE_LABELS } from '../../../lib/auth';
import { formatPhMobileNational, toE164PhMobile } from '../../../lib/phMobile';

interface ProfileResponse {
  user: {
    id: string;
    email: string | null;
    username: string | null;
    display_name: string | null;
    role: 'branch-owner';
    phone: string | null;
    status: 'Active' | 'Inactive';
  };
}

interface ProfileForm {
  fullName: string;
  email: string;
  mobile: string;
}

interface ProfileErrors {
  fullName?: string;
  email?: string;
  mobile?: string;
}

const fieldClassName =
  'mt-2 h-11 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

function initials(name: string): string {
  const letters = name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('');
  return letters.toUpperCase() || 'BO';
}

/** Self-service identity and credential controls for the authenticated Branch Owner. */
export function BranchOwnerAccountSettings() {
  const account = useAccount();
  const updateAccount = useUpdateAccount();
  const fallbackName = account.displayName || account.username;

  const [profile, setProfile] = useState<ProfileResponse['user']>(() => ({
    id: account.id,
    email: account.email,
    username: account.username,
    display_name: account.displayName,
    role: 'branch-owner',
    phone: account.phone,
    status: account.status,
  }));
  const [form, setForm] = useState<ProfileForm>({
    fullName: fallbackName,
    email: account.email,
    mobile: formatPhMobileNational(account.phone ?? ''),
  });
  const [savedForm, setSavedForm] = useState<ProfileForm>({
    fullName: fallbackName,
    email: account.email,
    mobile: formatPhMobileNational(account.phone ?? ''),
  });
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saving, setSaving] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const applyProfile = (user: ProfileResponse['user']) => {
    const nextForm: ProfileForm = {
      fullName: user.display_name || user.username || fallbackName,
      email: user.email ?? '',
      mobile: formatPhMobileNational(user.phone ?? ''),
    };
    setProfile(user);
    setForm(nextForm);
    setSavedForm(nextForm);
  };

  const profileInitials = useMemo(() => initials(form.fullName), [form.fullName]);

  const validateProfile = (): ProfileErrors => {
    const next: ProfileErrors = {};
    if (!form.fullName.trim()) next.fullName = 'Full name is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      next.email = 'Enter a valid email address';
    }
    if (form.mobile.trim() && !toE164PhMobile(form.mobile)) {
      next.mobile = 'Enter a valid PH mobile number';
    }
    return next;
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateProfile();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSaving(true);
    try {
      const response = await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: form.fullName.trim(),
          email: form.email.trim(),
          phone: form.mobile.trim() ? toE164PhMobile(form.mobile) : null,
        }),
      });
      const data = (await response.json().catch(() => null)) as ProfileResponse | null;
      if (!response.ok || !data?.user) {
        toast.error(apiErrorMessage(data, 'Could not save your account details.'));
        return;
      }

      applyProfile(data.user);
      updateAccount({
        displayName: data.user.display_name || form.fullName.trim(),
        email: data.user.email ?? form.email.trim(),
        phone: data.user.phone,
        status: data.user.status,
      });
      toast.success('Account details updated.');
    } catch {
      toast.error('Could not reach the server.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password.length < 8) {
      setPasswordError('Use at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setPasswordError('Passwords do not match');
      return;
    }

    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const response = await apiFetch('/users/me/password', {
        method: 'PATCH',
        body: JSON.stringify({ password }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setPasswordError(apiErrorMessage(data, 'Could not change your password.'));
        return;
      }

      setPassword('');
      setConfirmPassword('');
      setShowPassword(false);
      toast.success('Password updated.');
    } catch {
      setPasswordError('Could not reach the server.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div id="account-settings-panel" role="tabpanel" className="mx-auto grid max-w-7xl gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,0.85fr)]">
      <form onSubmit={handleProfileSubmit} noValidate className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Profile information</h2>
            <p className="mt-1 text-sm text-gray-500">Manage the details linked to your account.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-3 py-1 text-xs font-medium text-green-700">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" aria-hidden="true" />
            {profile.status}
          </span>
        </div>

        <div className="mt-6 flex items-center gap-4 rounded-xl bg-[#F4FAFE] p-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#DDF1FC] text-xl font-semibold text-[#007BC1]">
            {profileInitials}
          </div>
          <div className="min-w-0">
            <p className="truncate text-base font-semibold text-gray-900">{form.fullName}</p>
            <p className="mt-0.5 text-sm text-gray-500">{ROLE_LABELS[account.role]}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="block text-sm font-medium text-gray-700 md:col-span-2">
            Full name
            <input
              value={form.fullName}
              onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))}
              className={fieldClassName}
              aria-invalid={!!errors.fullName}
            />
            {errors.fullName && <span className="mt-1.5 block text-xs text-red-600">{errors.fullName}</span>}
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Email address
            <input
              type="email"
              value={form.email}
              onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
              className={fieldClassName}
              aria-invalid={!!errors.email}
            />
            {errors.email && <span className="mt-1.5 block text-xs text-red-600">{errors.email}</span>}
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Mobile number
            <span className="mt-2 flex h-11 overflow-hidden rounded-lg border border-gray-300 bg-white transition focus-within:border-[#007BC1] focus-within:ring-2 focus-within:ring-[#007BC1]/15">
              <span className="flex shrink-0 items-center border-r border-gray-300 bg-gray-50 px-3.5 text-sm text-gray-700" aria-hidden="true">
                +63
              </span>
              <input
                inputMode="numeric"
                value={form.mobile}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  mobile: formatPhMobileNational(event.target.value),
                }))}
                placeholder="9XX XXX XXXX"
                className="min-w-0 flex-1 bg-transparent px-3.5 text-sm text-gray-900 outline-none"
                aria-label="Philippine mobile subscriber number"
                aria-invalid={!!errors.mobile}
              />
            </span>
            {errors.mobile ? (
              <span className="mt-1.5 block text-xs text-red-600">{errors.mobile}</span>
            ) : (
              <span className="mt-1.5 block text-xs font-normal text-gray-500">Used for account recovery and security alerts.</span>
            )}
          </label>

          <label className="block text-sm font-medium text-gray-700 md:col-span-2">
            Role
            <span className="relative block">
              <input value={ROLE_LABELS[account.role]} disabled className={`${fieldClassName} pr-10`} />
              <LockKeyhole className="absolute bottom-3.5 right-3.5 h-4 w-4 text-gray-400" aria-hidden="true" />
            </span>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-5">
          <button
            type="submit"
            disabled={saving}
            className="h-10 rounded-lg bg-[#007BC1] px-5 text-sm font-medium text-white transition hover:bg-[#0068A4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Saving…' : 'Save profile'}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setForm(savedForm);
              setErrors({});
            }}
            className="h-10 px-2 text-sm font-medium text-[#007BC1] transition hover:text-[#005A8E] disabled:opacity-50"
          >
            Discard changes
          </button>
        </div>
      </form>

      <div className="space-y-6">
        <form onSubmit={handlePasswordSubmit} className="relative overflow-hidden rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <span className="absolute inset-y-0 left-0 w-1 bg-[#CFEAFA]" aria-hidden="true" />
          <div className="flex items-start gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6FC] text-[#007BC1]">
              <ShieldCheck className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Account security</h2>
              <p className="mt-1 text-sm text-gray-500">Update your sign-in password.</p>
            </div>
          </div>

          <label className="mt-6 block text-sm font-medium text-gray-700">
            New password
            <span className="relative block">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className={`${fieldClassName} pr-11`}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute bottom-1.5 right-1.5 flex h-8 w-8 items-center justify-center text-gray-400 hover:text-gray-600"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </span>
          </label>

          <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
            <Check className={`h-3.5 w-3.5 ${password.length >= 8 ? 'text-green-500' : 'text-gray-300'}`} aria-hidden="true" />
            At least 8 characters
          </div>

          <label className="mt-4 block text-sm font-medium text-gray-700">
            Confirm new password
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className={fieldClassName}
              autoComplete="new-password"
            />
          </label>

          {passwordError && <p className="mt-3 text-sm text-red-600">{passwordError}</p>}

          <button
            type="submit"
            disabled={passwordSaving}
            className="mt-5 h-10 rounded-lg bg-[#007BC1] px-5 text-sm font-medium text-white transition hover:bg-[#0068A4] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {passwordSaving ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm" aria-labelledby="account-session-heading">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#EAF6FC] text-[#007BC1]">
              <UserRound className="h-5 w-5" aria-hidden="true" />
            </span>
            <div>
              <h2 id="account-session-heading" className="text-base font-semibold text-gray-900">Session</h2>
              <p className="mt-0.5 text-sm text-gray-500">Signed in as Branch Owner</p>
            </div>
          </div>
          <p className="mt-4 flex items-center gap-2 text-xs text-gray-500">
            <KeyRound className="h-3.5 w-3.5" aria-hidden="true" />
            Account ID: <span className="truncate font-mono">{profile.id}</span>
          </p>
        </section>
      </div>
    </div>
  );
}
