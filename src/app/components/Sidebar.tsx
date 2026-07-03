import { LayoutDashboard, TrendingUp, Star, Settings, Users } from 'lucide-react';

const PesoIcon = ({ className }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M5 7h8a4 4 0 0 1 0 8H5V7z" />
    <line x1="5" y1="7" x2="5" y2="20" />
    <line x1="3" y1="11" x2="11" y2="11" />
    <line x1="3" y1="14" x2="11" y2="14" />
  </svg>
);

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard',          id: 'dashboard' },
    { icon: TrendingUp,      label: 'Branch Accounts',    id: 'order-analytics' },
    { icon: Users,           label: 'Customers',          id: 'customers' },
    { icon: Star,            label: 'System CSAT',        id: 'csat' },
    { icon: Settings,        label: 'Franchise Registry', id: 'settings' },
    { icon: PesoIcon,        label: 'Price Configuration',id: 'price-config' },
  ];

  return (
    <div className="w-[240px] bg-[#007BC1] text-white h-screen flex flex-col">
      {/* Header Section - Logo & Badge */}
      <div className="p-4 flex flex-col gap-4">
        <div className="bg-white rounded-lg p-3 flex items-center justify-center">
          <img
            src="/superkalan-gaz.png"
            alt="Superkalan Gaz"
            className="w-full h-auto"
          />
        </div>

        <div className="bg-[#1E3A5F] text-white text-xs px-3 py-1 rounded-full inline-block font-medium self-center">
          Main Office
        </div>
      </div>

      {/* Navigation Section - fills available space */}
      <nav className="flex-1 px-4 py-2 flex flex-col gap-2">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
              activeScreen === item.id
                ? 'bg-white text-[#007BC1]'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <item.icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      {/* User Profile Section - anchored to bottom */}
      <div className="p-4 border-t border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#76B4DD] rounded-full flex items-center justify-center text-[#007BC1] font-semibold text-sm flex-shrink-0">
            JA
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium truncate">Juan Alvarez</div>
            <div className="text-xs text-white/80 truncate">
              Franchise Admin
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}