import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import SuperkalanLogo from '../../imports/Superkalan_Gaz.png';

type Branch = 'Quezon City Branch' | 'Makati Branch' | 'Mandaluyong Branch';

interface LoginProps {
  onLogin: (branches: Branch[]) => void;
}

const DEMO_ACCOUNTS = {
  'maria.santos': {
    password: 'password',
    branches: ['Quezon City Branch'] as Branch[],
    name: 'Maria Santos - Single Branch Owner',
  },
  'juan.reyes': {
    password: 'password',
    branches: ['Quezon City Branch', 'Makati Branch', 'Mandaluyong Branch'] as Branch[],
    name: 'Juan Reyes - Multi-Branch Owner',
  },
};

export function Login({ onLogin }: LoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const account = DEMO_ACCOUNTS[username as keyof typeof DEMO_ACCOUNTS];

    if (account && account.password === password) {
      onLogin(account.branches);
    } else {
      setError('Invalid username or password');
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

      <div className="w-full max-w-7xl mx-auto flex items-center relative z-10">
        {/* Left side - Logo */}
        <div className="hidden lg:flex absolute left-0 top-1/2 -translate-y-1/2 w-1/2 justify-center">
          <img
            src={SuperkalanLogo}
            alt="Superkalan Gaz"
            className="w-80 h-auto"
          />
        </div>

        {/* Right side - Login Form Card */}
        <div className="bg-white rounded-3xl shadow-xl p-12 w-full max-w-md ml-auto mr-auto lg:ml-[55%]">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <img
              src={SuperkalanLogo}
              alt="Superkalan Gaz"
              className="w-56 h-auto mx-auto"
            />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 mb-4 text-center">Login</h1>

          <div className="mb-8 p-4 bg-blue-50 rounded-lg text-xs text-gray-700">
            <div className="font-medium mb-2">Demo Accounts:</div>
            <div className="space-y-1">
              <div><span className="font-medium">Single Branch:</span> maria.santos / password</div>
              <div><span className="font-medium">Multi-Branch:</span> juan.reyes / password</div>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              {error}
            </div>
          )}

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

            <div className="mb-10">
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
                    <Eye className="w-5 h-5" />
                  ) : (
                    <EyeOff className="w-5 h-5" />
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="w-full bg-[#007BC1] text-white py-3.5 rounded-md font-medium hover:bg-[#006399] transition-colors text-base"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
