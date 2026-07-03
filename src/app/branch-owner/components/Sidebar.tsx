import { useState, useRef, useEffect } from 'react';
import { LayoutDashboard, TrendingUp, BarChart3, Star, Gift, Package, FileText, Bike, Users, Settings, ChevronDown, Check, Receipt } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
const SuperkalanLogo = '/superkalan-gaz.png';

interface SidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export function Sidebar({ activeScreen, onNavigate }: SidebarProps) {
  const { selectedBranch, setSelectedBranch, availableBranches } = useBranch();
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const isSingleBranch = availableBranches.length === 1;

  const navItems = [
    { icon: LayoutDashboard, label: 'Dashboard', id: 'dashboard' },
    { icon: TrendingUp, label: 'Order Analytics', id: 'order-analytics' },
    { icon: BarChart3, label: 'Sales', id: 'sales-overview' },
    { icon: Receipt, label: 'Operational Expenses', id: 'operational-expenses' },
    { icon: Star, label: 'Ratings & Reviews', id: 'csat' },
    { icon: Gift, label: 'Loyalty Program', id: 'loyalty' },
    { icon: Package, label: 'Inventory', id: 'supply-chain' },
    { icon: Bike, label: 'Fleet', id: 'fleet-overview' },
    { icon: FileText, label: 'Reports', id: 'reports' },
    { icon: Users, label: 'User Management', id: 'user-management' },
    { icon: Settings, label: 'Settings', id: 'settings' },
  ];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    }

    if (!isSingleBranch) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isSingleBranch]);

  return (
    <div className="w-[220px] bg-[#007BC1] text-white h-screen flex flex-col">
      <div className="p-6">
        <div className="bg-white rounded-lg p-3 mb-4 flex items-center justify-center">
          <img
            src={SuperkalanLogo}
            alt="Superkalan Gaz"
            className="w-full h-auto"
          />
        </div>

        {isSingleBranch ? (
          <div className="w-full bg-[#CC1903] text-white text-xs px-3 py-1 rounded-full font-medium text-center flex items-center justify-center">
            {selectedBranch}
          </div>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full bg-[#CC1903] hover:bg-[#b01602] text-white text-xs px-3 py-1 rounded-full font-medium flex items-center justify-between transition-colors"
            >
              <span>{selectedBranch}</span>
              <ChevronDown className="w-3 h-3 ml-1" />
            </button>

            {showDropdown && (
              <div className="absolute top-full mt-2 left-0 right-0 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
                {availableBranches.map((branch) => (
                  <button
                    key={branch}
                    onClick={() => {
                      setSelectedBranch(branch);
                      setShowDropdown(false);
                    }}
                    className="w-full px-3 py-2 text-sm text-left text-gray-700 hover:bg-gray-100 flex items-center justify-between transition-colors"
                  >
                    <span>{branch}</span>
                    {selectedBranch === branch && (
                      <Check className="w-4 h-4 text-[#1e3a5f]" />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <nav className="flex-1 px-3">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => onNavigate(item.id)}
            className={`w-full flex items-center gap-2 px-3 py-[6px] rounded-lg mb-0.5 transition-colors ${
              activeScreen === item.id
                ? 'bg-white text-[#007BC1]'
                : 'text-white hover:bg-white/10'
            }`}
          >
            <item.icon className="w-3.5 h-3.5 shrink-0" />
            <span className="text-[12px] font-medium">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="px-4 py-2 border-t border-white/20">
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-[#76B4DD] rounded-full flex items-center justify-center text-[#007BC1] font-semibold text-[11px]">
            MS
          </div>
          <div className="flex-1">
            <div className="text-xs font-medium">Maria Santos</div>
            <div className="text-[11px] text-white/80">
              Branch Owner
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
