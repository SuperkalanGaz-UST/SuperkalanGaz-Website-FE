import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Account, signIn, DEMO_ACCOUNTS, ROLE_LABELS } from '../lib/auth';

interface LoginProps {
  onLogin: (account: Account) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
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

          <h1 className="text-3xl font-bold text-gray-900 mb-10">Login</h1>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label className="block text-sm font-normal text-gray-700 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none text-sm"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-normal text-gray-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-[#007BC1] focus:border-transparent outline-none pr-12 text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 mb-4" role="alert">
                {error}
              </p>
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
        </div>
      </div>
    </div>
  );
}
