'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Eye, EyeOff, KeyRound, LockKeyhole } from 'lucide-react';
import { toast } from 'sonner';
import { useAccount, useUpdateAccount } from '../../contexts/AccountContext';
import { apiErrorMessage, apiFetch } from '../../lib/api';
import { ROLE_LABELS } from '../../lib/auth';
import { formatPhMobileNational, toE164PhMobile } from '../../lib/phMobile';
import { SuperAdminHeader } from '../components/SuperAdminHeader';

interface ProfileResponse {
  user: {
    id: string;
    email: string | null;
    username: string | null;
    display_name: string | null;
    role: 'super-admin';
    phone: string | null;
    status: 'Active' | 'Inactive';
  };
}

interface ProfileForm {
  firstName: string;
  lastName: string;
  email: string;
  mobile: string;
}

interface FormErrors {
  firstName?: string;
  lastName?: string;
  email?: string;
  mobile?: string;
}

function splitDisplayName(displayName: string): Pick<ProfileForm, 'firstName' | 'lastName'> {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts.shift() ?? '',
    lastName: parts.join(' '),
  };
}

function initials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase() || 'SA';
}

const fieldClassName =
  'h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-gray-900 outline-none transition focus:border-[#007BC1] focus:ring-2 focus:ring-[#007BC1]/15 disabled:cursor-not-allowed disabled:bg-gray-50 disabled:text-gray-500';

/** Self-service profile controls for the authenticated Super Administrator. */
export function SuperAdminSettings() {
  const account = useAccount();
  const updateAccount = useUpdateAccount();
  const fallbackName = account.displayName || account.username;

  const [profile, setProfile] = useState<ProfileResponse['user'] | null>(null);
  const [form, setForm] = useState<ProfileForm>(() => ({
    ...splitDisplayName(fallbackName),
    email: account.email,
    mobile: formatPhMobileNational(account.phone ?? ''),
  }));
  const [savedForm, setSavedForm] = useState<ProfileForm | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  const applyProfile = useCallback((user: ProfileResponse['user']) => {
    const nextForm: ProfileForm = {
      ...splitDisplayName(user.display_name || user.username || fallbackName),
      email: user.email ?? '',
      mobile: formatPhMobileNational(user.phone ?? ''),
    };
    setProfile(user);
    setForm(nextForm);
    setSavedForm(nextForm);
  }, [fallbackName]);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const response = await apiFetch('/users/me');
      const data = (await response.json().catch(() => null)) as ProfileResponse | null;
      if (!response.ok || !data?.user) {
        setLoadError(apiErrorMessage(data, 'Could not load your account details.'));
        return;
      }
      applyProfile(data.user);
    } catch {
      setLoadError('Could not reach the server.');
    } finally {
      setLoading(false);
    }
  }, [applyProfile]);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const profileInitials = useMemo(
    () => initials(form.firstName, form.lastName),
    [form.firstName, form.lastName],
  );

  const validateProfile = (): FormErrors => {
    const next: FormErrors = {};
    if (!form.firstName.trim()) next.firstName = 'First name is required';
    if (!form.lastName.trim()) next.lastName = 'Last name is required';
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

    const fullName = `${form.firstName.trim()} ${form.lastName.trim()}`;
    setSaving(true);
    try {
      const response = await apiFetch('/users/me', {
        method: 'PATCH',
        body: JSON.stringify({
          name: fullName,
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
        displayName: data.user.display_name || fullName,
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

  const resetForm = () => {
    if (savedForm) setForm(savedForm);
    setErrors({});
  };

  const closePasswordDialog = () => {
    setPasswordOpen(false);
    setPassword('');
    setConfirmPassword('');
    setPasswordError(null);
    setShowPassword(false);
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
      closePasswordDialog();
      toast.success('Password updated.');
    } catch {
      setPasswordError('Could not reach the server.');
    } finally {
      setPasswordSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
      <SuperAdminHeader
        title="Account settings"
        description="Manage your personal details and account security."
      />

      <main className="px-8 pb-10">
        {loading ? (
          <div className="flex min-h-[420px] items-center justify-center text-sm text-gray-500">
            Loading account details…
          </div>
        ) : loadError ? (
          <div className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center">
            <p className="text-sm text-red-600">{loadError}</p>
            <button
              type="button"
              onClick={() => void loadProfile()}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Try again
            </button>
          </div>
        ) : profile ? (
          <div className="mx-auto max-w-6xl">
            <form onSubmit={handleProfileSubmit} noValidate>
              <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)]">
                <aside className="flex flex-col items-center pt-2 text-center">
                  <div className="flex h-36 w-36 items-center justify-center rounded-full bg-[#007BC1] text-5xl font-medium text-white shadow-sm">
                    {profileInitials}
                  </div>
                  <h2 className="mt-5 text-xl font-semibold leading-tight text-gray-900">
                    {form.firstName || 'Super'}{' '}
                    <span className="block">{form.lastName || 'Administrator'}</span>
                  </h2>
                  <span className="mt-4 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-[#007BC1]">
                    Super Administrator
                  </span>
                  <span className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-green-600">
                    <span className="h-2 w-2 rounded-full bg-green-500" aria-hidden="true" />
                    {profile.status}
                  </span>
                </aside>

                <section aria-labelledby="sa-personal-details-heading">
                  <h2 id="sa-personal-details-heading" className="text-xl font-semibold text-gray-900">
                    Personal details
                  </h2>

                  <div className="mt-6 grid gap-x-8 gap-y-6 md:grid-cols-2">
                    <label className="block text-sm font-medium text-gray-700">
                      First name
                      <input
                        value={form.firstName}
                        onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                        className={`${fieldClassName} mt-2`}
                        aria-invalid={!!errors.firstName}
                      />
                      {errors.firstName && <span className="mt-1.5 block text-xs text-red-600">{errors.firstName}</span>}
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Last name
                      <input
                        value={form.lastName}
                        onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                        className={`${fieldClassName} mt-2`}
                        aria-invalid={!!errors.lastName}
                      />
                      {errors.lastName && <span className="mt-1.5 block text-xs text-red-600">{errors.lastName}</span>}
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Email address
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                        className={`${fieldClassName} mt-2`}
                        aria-invalid={!!errors.email}
                      />
                      {errors.email && <span className="mt-1.5 block text-xs text-red-600">{errors.email}</span>}
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Mobile number
                      <span className="mt-2 flex h-12 overflow-hidden rounded-lg border border-gray-300 bg-white transition focus-within:border-[#007BC1] focus-within:ring-2 focus-within:ring-[#007BC1]/15">
                        <span className="flex shrink-0 items-center border-r border-gray-300 px-3.5 text-sm text-gray-700" aria-hidden="true">
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
                        <span className="mt-1.5 block text-xs font-normal text-gray-500">Philippine mobile number</span>
                      )}
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Role
                      <span className="relative mt-2 block">
                        <input
                          value={ROLE_LABELS[account.role]}
                          disabled
                          className={`${fieldClassName} pr-10`}
                        />
                        <LockKeyhole className="absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                      </span>
                      <span className="mt-1.5 block text-xs font-normal text-gray-500">Assigned by the system</span>
                    </label>

                    <label className="block text-sm font-medium text-gray-700">
                      Account ID
                      <input value={profile.id} disabled className={`${fieldClassName} mt-2 font-mono text-xs`} />
                    </label>
                  </div>
                </section>
              </div>

              <div className="mt-8 flex justify-end gap-3 border-b border-gray-200 pb-7">
                <button
                  type="button"
                  onClick={resetForm}
                  disabled={saving}
                  className="h-11 rounded-lg border border-[#007BC1] bg-white px-6 text-sm font-medium text-[#007BC1] transition hover:bg-blue-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="h-11 rounded-lg bg-[#007BC1] px-6 text-sm font-medium text-white transition hover:bg-[#0068A4] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>

            <section className="flex items-center justify-between gap-6 py-7" aria-labelledby="security-password-heading">
              <div className="flex min-w-0 items-center gap-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[#007BC1]">
                  <KeyRound className="h-5 w-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 id="security-password-heading" className="whitespace-nowrap text-lg font-semibold text-gray-900">
                    Security Password
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">Update your sign-in password.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPasswordOpen(true)}
                className="h-11 shrink-0 rounded-lg border border-[#007BC1] bg-white px-5 text-sm font-medium text-[#007BC1] transition hover:bg-blue-50"
              >
                Change password
              </button>
            </section>
          </div>
        ) : null}
      </main>

      {passwordOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" role="presentation">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="change-password-title">
            <h2 id="change-password-title" className="text-lg font-semibold text-gray-900">Change password</h2>
            <p className="mt-1 text-sm text-gray-500">Use at least 8 characters.</p>

            <form onSubmit={handlePasswordSubmit} className="mt-5">
              <label className="block text-sm font-medium text-gray-700">
                New password
                <span className="relative mt-2 block">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className={`${fieldClassName} pr-11`}
                    autoComplete="new-password"
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((visible) => !visible)}
                    className="absolute right-3 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center text-gray-400 hover:text-gray-600"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>

              <label className="mt-4 block text-sm font-medium text-gray-700">
                Confirm new password
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  className={`${fieldClassName} mt-2`}
                  autoComplete="new-password"
                />
              </label>

              {passwordError && <p className="mt-3 text-sm text-red-600">{passwordError}</p>}

              <div className="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={closePasswordDialog}
                  disabled={passwordSaving}
                  className="h-10 rounded-lg border border-gray-300 px-4 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={passwordSaving}
                  className="h-10 rounded-lg bg-[#007BC1] px-4 text-sm font-medium text-white hover:bg-[#0068A4] disabled:opacity-50"
                >
                  {passwordSaving ? 'Updating…' : 'Update password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
