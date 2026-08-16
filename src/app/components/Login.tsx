import { useState } from 'react';
import { ArrowLeft, CheckCircle2, Eye, EyeOff, Mail } from 'lucide-react';
import {
  Account,
  DEMO_ACCOUNTS,
  requestPasswordReset,
  ROLE_LABELS,
  signIn,
  updatePassword,
} from '../lib/auth';

interface LoginProps {
  onLogin: (account: Account) => void;
  passwordRecovery?: boolean;
  onPasswordReset?: () => Promise<void>;
}

export function Login({
  onLogin,
  passwordRecovery = false,
  onPasswordReset,
}: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [forgotPassword, setForgotPassword] = useState(false);
  const [resetLinkSent, setResetLinkSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [resetComplete, setResetComplete] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { account, error: signInError } = await signIn(username, password);
    setLoading(false);

    if (account) {
      onLogin(account);
    } else {
      setError(signInError ?? 'Invalid username or password');
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!username.trim()) {
      setError('Enter your username or email address.');
      return;
    }

    setLoading(true);
    const redirectTo = `${window.location.origin}${window.location.pathname}`;
    const { error: resetError } = await requestPasswordReset(username, redirectTo);
    setLoading(false);

    if (resetError) {
      setError(resetError);
    } else {
      setResetLinkSent(true);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    const { error: resetError } = await updatePassword(newPassword);
    if (resetError) {
      setError(resetError);
      setLoading(false);
      return;
    }

    await onPasswordReset?.();
    setLoading(false);
    setResetComplete(true);
  };

  const returnToLogin = () => {
    setForgotPassword(false);
    setResetLinkSent(false);
    setError('');
  };

  const passwordField = (
    id: string,
    value: string,
    onChange: (value: string) => void,
    visible: boolean,
    onToggleVisibility: () => void,
    autoComplete: 'current-password' | 'new-password',
  ) => (
    <div className="relative">
      <input
        id={id}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        required
        className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none pr-12 text-sm"
      />
      <button
        type="button"
        onClick={onToggleVisibility}
        aria-label={visible ? 'Hide password' : 'Show password'}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
      >
        {visible ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
      </button>
    </div>
  );

  const renderCardContent = () => {
    if (resetComplete) {
      return (
        <div className="py-6 text-center">
          <CheckCircle2 className="mx-auto mb-5 h-12 w-12 text-emerald-600" aria-hidden="true" />
          <h1 className="text-3xl font-bold text-gray-900">Password updated</h1>
          <p className="mt-3 text-sm leading-6 text-gray-600">
            Your password has been changed. You can now sign in with your new password.
          </p>
          <button
            type="button"
            onClick={() => window.location.assign(window.location.pathname)}
            className="mt-8 w-full rounded-md bg-[#007BC1] py-3.5 text-base font-medium text-white transition-colors hover:bg-[#006399]"
          >
            Return to login
          </button>
        </div>
      );
    }

    if (passwordRecovery) {
      return (
        <>
          <h1 className="text-3xl font-bold text-gray-900">Set a new password</h1>
          <p className="mt-3 mb-8 text-sm leading-6 text-gray-600">
            Choose a new password for your Superkalan Gaz account.
          </p>
          <form onSubmit={handlePasswordReset}>
            <div className="mb-5">
              <label htmlFor="new-password" className="block text-sm font-normal text-gray-700 mb-2">
                New password
              </label>
              {passwordField(
                'new-password',
                newPassword,
                setNewPassword,
                showNewPassword,
                () => setShowNewPassword((visible) => !visible),
                'new-password',
              )}
              <p className="mt-2 text-xs text-gray-500">Use at least 6 characters.</p>
            </div>

            <div className="mb-6">
              <label htmlFor="confirm-password" className="block text-sm font-normal text-gray-700 mb-2">
                Confirm new password
              </label>
              {passwordField(
                'confirm-password',
                confirmPassword,
                setConfirmPassword,
                showNewPassword,
                () => setShowNewPassword((visible) => !visible),
                'new-password',
              )}
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#007BC1] text-white py-3.5 rounded-md font-medium hover:bg-[#006399] transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Updating password…' : 'Update password'}
            </button>
          </form>
        </>
      );
    }

    if (forgotPassword) {
      if (resetLinkSent) {
        return (
          <div className="py-6 text-center">
            <Mail className="mx-auto mb-5 h-12 w-12 text-[#007BC1]" aria-hidden="true" />
            <h1 className="text-3xl font-bold text-gray-900">Check your email</h1>
            <p className="mt-3 text-sm leading-6 text-gray-600">
              If an account matches the username or email you entered, we sent it a password reset link.
            </p>
            <button
              type="button"
              onClick={returnToLogin}
              className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-[#007BC1] hover:text-[#006399]"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to login
            </button>
          </div>
        );
      }

      return (
        <>
          <button
            type="button"
            onClick={returnToLogin}
            className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-[#007BC1]"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to login
          </button>
          <h1 className="text-3xl font-bold text-gray-900">Forgot password?</h1>
          <p className="mt-3 mb-8 text-sm leading-6 text-gray-600">
            Enter your username or account email and we’ll send you a reset link.
          </p>
          <form onSubmit={handleForgotPassword}>
            <div className="mb-6">
              <label htmlFor="recovery-username" className="block text-sm font-normal text-gray-700 mb-2">
                Username or email
              </label>
              <input
                id="recovery-username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
              />
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#007BC1] text-white py-3.5 rounded-md font-medium hover:bg-[#006399] transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {loading ? 'Sending reset link…' : 'Send reset link'}
            </button>
          </form>
        </>
      );
    }

    return (
      <>
        <h1 className="text-3xl font-bold text-gray-900 mb-10">Login</h1>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label htmlFor="username" className="block text-sm font-normal text-gray-700 mb-2">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              required
              className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
            />
          </div>

          <div className="mb-2">
            <label htmlFor="password" className="block text-sm font-normal text-gray-700 mb-2">
              Password
            </label>
            {passwordField(
              'password',
              password,
              setPassword,
              showPassword,
              () => setShowPassword((visible) => !visible),
              'current-password',
            )}
          </div>

          <div className="mb-6 text-right">
            <button
              type="button"
              onClick={() => {
                setForgotPassword(true);
                setError('');
              }}
              className="text-sm font-medium text-[#007BC1] hover:text-[#006399] hover:underline"
            >
              Forgot password?
            </button>
          </div>

          {error && (
            <p className="text-sm text-red-600 mb-4" role="alert">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#007BC1] text-white py-3.5 rounded-md font-medium hover:bg-[#006399] transition-colors text-base disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loading ? 'Signing in…' : 'Login'}
          </button>
        </form>

        {/* Demo credentials — remove together with lib/auth.ts when API auth lands */}
        <div className="mt-8 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Demo accounts
          </p>
          <ul className="space-y-1">
            {DEMO_ACCOUNTS.map((demo) => (
              <li key={demo.username} className="text-xs text-gray-600 flex justify-between gap-2">
                <span className="font-mono">{demo.username} / {demo.password}</span>
                <span className="text-gray-400">{ROLE_LABELS[demo.role]}</span>
              </li>
            ))}
          </ul>
        </div>
      </>
    );
  };

  return (
    <div className="min-h-screen bg-[#e8e8e8] flex items-center justify-center p-8 relative overflow-hidden">
      {/* Decorative waves at bottom */}
      <div className="absolute bottom-0 left-0 w-full pointer-events-none">
        <svg viewBox="0 0 1440 320" className="w-full" preserveAspectRatio="none">
          <path fill="#d4e8f7" fillOpacity="1" d="M0,160L48,176C96,192,192,224,288,224C384,224,480,192,576,181.3C672,171,768,181,864,197.3C960,213,1056,235,1152,229.3C1248,224,1344,192,1392,176L1440,160L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          <path fill="#a8d5f2" fillOpacity="1" d="M0,224L48,213.3C96,203,192,181,288,186.7C384,192,480,224,576,234.7C672,245,768,235,864,213.3C960,192,1056,160,1152,165.3C1248,171,1344,213,1392,234.7L1440,256L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
          <path fill="#7bc2ed" fillOpacity="1" d="M0,256L48,261.3C96,267,192,277,288,266.7C384,256,480,224,576,208C672,192,768,192,864,202.7C960,213,1056,235,1152,240C1248,245,1344,235,1392,229.3L1440,224L1440,320L1392,320C1344,320,1248,320,1152,320C1056,320,960,320,864,320C768,320,672,320,576,320C480,320,384,320,288,320C192,320,96,320,48,320L0,320Z"></path>
        </svg>
      </div>

      <div className="w-full max-w-6xl mx-auto flex items-center justify-between gap-20 relative z-10">
        {/* Left side - Logo */}
        <div className="hidden lg:flex flex-1 justify-center">
          <img
            src="/superkalan-gaz.png"
            alt="Superkalan Gaz"
            className="w-96 h-auto"
          />
        </div>

        {/* Right side - Login Form Card */}
        <div className="bg-white rounded-3xl shadow-xl p-12 w-full max-w-md flex-shrink-0">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <img
              src="/superkalan-gaz.png"
              alt="Superkalan Gaz"
              className="w-56 h-auto mx-auto"
            />
          </div>

          {renderCardContent()}
        </div>
      </div>
    </div>
  );
}
