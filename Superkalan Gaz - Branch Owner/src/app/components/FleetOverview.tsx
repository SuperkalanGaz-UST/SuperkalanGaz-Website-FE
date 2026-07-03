import { useState, useMemo } from 'react';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { Users, Navigation, AlertTriangle, Clock, ChevronDown } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';

interface Rider {
  id: string;
  name: string;
  plateNumber: string;
  status: 'active' | 'inactive' | 'outside-geofence';
  currentOrder: string | null;
  lastUpdated: string;
  lat: number;
  lng: number;
  geofenceBreach?: boolean;
}

const riders: Rider[] = [
  {
    id: '1',
    name: 'Juan Dela Cruz',
    plateNumber: 'ABC-1234',
    status: 'active',
    currentOrder: 'ORD-1052',
    lastUpdated: '2 mins ago',
    lat: 14.6507,
    lng: 121.0494,
  },
  {
    id: '2',
    name: 'Pedro Santos',
    plateNumber: 'XYZ-5678',
    status: 'active',
    currentOrder: 'ORD-1053',
    lastUpdated: '5 mins ago',
    lat: 14.6520,
    lng: 121.0510,
  },
  {
    id: '3',
    name: 'Carlos Reyes',
    plateNumber: 'DEF-9012',
    status: 'outside-geofence',
    currentOrder: 'ORD-1054',
    lastUpdated: '1 min ago',
    lat: 14.6580,
    lng: 121.0450,
    geofenceBreach: true,
  },
  {
    id: '4',
    name: 'Miguel Torres',
    plateNumber: 'GHI-3456',
    status: 'active',
    currentOrder: null,
    lastUpdated: '10 mins ago',
    lat: 14.6495,
    lng: 121.0520,
  },
  {
    id: '5',
    name: 'Ramon Lopez',
    plateNumber: 'JKL-7890',
    status: 'inactive',
    currentOrder: null,
    lastUpdated: '45 mins ago',
    lat: 14.6510,
    lng: 121.0500,
  },
];

const activityLog = [
  { time: '10:42 AM', rider: 'Juan Dela Cruz', event: 'Delivered order ORD-1051 successfully' },
  { time: '10:38 AM', rider: 'Carlos Reyes', event: 'Left geofence boundary - En route to customer' },
  { time: '10:35 AM', rider: 'Pedro Santos', event: 'Picked up order ORD-1053 from branch' },
  { time: '10:30 AM', rider: 'Miguel Torres', event: 'Returned to branch' },
  { time: '10:25 AM', rider: 'Juan Dela Cruz', event: 'Picked up order ORD-1051 from branch' },
];

export function FleetOverview() {
  const { selectedBranch } = useBranch();
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  
  // State for filtering activity log by driver
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const activeRiders = riders.filter(r => r.status === 'active').length;
  const outsideGeofence = riders.filter(r => r.status === 'outside-geofence').length;
  const pastCurfew = 0;

  // Memoized filter logic for the activity log
  const filteredActivityLog = useMemo(() => {
    if (activityFilter === 'all') return activityLog;
    return activityLog.filter(log => log.rider === activityFilter);
  }, [activityFilter]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header
          title="Fleet"
          subtitle="Read-only tracking and fleet activity for your branch"
        />
      </div>

      <div className="p-8">
        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Riders"
            value={String(riders.length)}
            icon={<Users className="w-5 h-5 text-[#007BC1]" />}
            accentColor="#007BC1"
          />
          <KPICard
            title="Active Now"
            value={String(activeRiders)}
            icon={<Navigation className="w-5 h-5 text-green-600" />}
            accentColor="#22c55e"
          />
          <KPICard
            title="Outside Geofence"
            value={String(outsideGeofence)}
            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
            accentColor="#f59e0b"
          />
          <KPICard
            title="Past Curfew"
            value={String(pastCurfew)}
            icon={<Clock className="w-5 h-5 text-red-600" />}
            accentColor="#ef4444"
          />
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Live GPS Tracking</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-xs text-gray-500">Live Updates</span>
              </div>
            </div>
            <div className="relative bg-gray-100 rounded-lg overflow-hidden" style={{ height: '500px' }}>
              <svg width="100%" height="100%" viewBox="0 0 800 500">
                <rect width="800" height="500" fill="#e5e7eb" />

                <polygon
                  points="150,100 650,100 650,400 150,400"
                  fill="#007BC1"
                  fillOpacity="0.1"
                  stroke="#007BC1"
                  strokeWidth="2"
                  strokeDasharray="5,5"
                />

                {riders.map((rider) => {
                  const x = 150 + (rider.lng - 121.045) * 10000;
                  const y = 100 + (14.660 - rider.lat) * 10000;

                  let markerColor = '#22c55e';
                  if (rider.status === 'inactive') markerColor = '#9ca3af';
                  if (rider.status === 'outside-geofence') markerColor = '#f59e0b';

                  return (
                    <g key={rider.id}>
                      <circle
                        cx={x}
                        cy={y}
                        r="8"
                        fill={markerColor}
                        stroke="white"
                        strokeWidth="2"
                        className="cursor-pointer"
                        onClick={() => setSelectedRider(selectedRider === rider.id ? null : rider.id)}
                      />
                      {selectedRider === rider.id && (
                        <g>
                          <rect
                            x={x + 15}
                            y={y - 40}
                            width="180"
                            height="80"
                            fill="white"
                            stroke="#e5e7eb"
                            strokeWidth="1"
                            rx="4"
                          />
                          <text x={x + 25} y={y - 20} fontSize="12" fontWeight="600" fill="#111827">
                            {rider.name}
                          </text>
                          <text x={x + 25} y={y - 5} fontSize="11" fill="#6b7280">
                            {rider.plateNumber}
                          </text>
                          <text x={x + 25} y={y + 10} fontSize="11" fill="#6b7280">
                            Order: {rider.currentOrder || 'None'}
                          </text>
                          <text x={x + 25} y={y + 25} fontSize="10" fill="#9ca3af">
                            Updated: {rider.lastUpdated}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}

                <text x="20" y="30" fontSize="12" fill="#6b7280">
                  Geofence Boundary
                </text>
              </svg>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Fleet Roster</h3>
            <div className="space-y-3" style={{ maxHeight: '500px', overflowY: 'auto' }}>
              {riders.map((rider) => (
                <div
                  key={rider.id}
                  onClick={() => setSelectedRider(rider.id)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedRider === rider.id
                      ? 'border-[#007BC1] bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{rider.name}</div>
                      <div className="text-xs text-gray-500">{rider.plateNumber}</div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        rider.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : rider.status === 'outside-geofence'
                          ? 'bg-orange-100 text-orange-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {rider.status === 'active' ? 'Active' : rider.status === 'outside-geofence' ? 'Outside' : 'Inactive'}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    Order: {rider.currentOrder || 'None'}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Updated: {rider.lastUpdated}
                  </div>
                  {rider.geofenceBreach && (
                    <div className="mt-2 flex items-center gap-1 text-[10px] text-orange-600">
                      <AlertTriangle className="w-3 h-3" />
                      <span>Geofence breach</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Curfew & Active Alerts</h3>
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Branch Operating Hours</div>
              <div className="text-sm text-gray-900 font-medium">6:00 AM — 10:00 PM</div>
              <div className="text-xs text-gray-500 mt-1">All riders must return before curfew</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-3">Active Geofence Alerts</div>
              {riders
                .filter(r => r.geofenceBreach)
                .map(rider => (
                  <div key={rider.id} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg mb-2">
                    <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />
                    <div className="flex-1">
                      <div className="text-sm font-medium text-gray-900">{rider.name}</div>
                      <div className="text-xs text-gray-600">
                        Outside geofence boundary — {rider.currentOrder ? `Delivering ${rider.currentOrder}` : 'No active order'}
                      </div>
                      <div className="text-[10px] text-gray-500 mt-1">{rider.lastUpdated}</div>
                    </div>
                  </div>
                ))}
              {riders.filter(r => r.geofenceBreach).length === 0 && (
                <div className="text-sm text-gray-500">No active alerts</div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Today's Fleet Activity</h3>
              
              {/* Driver Filter Dropdown */}
              <div className="relative">
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-md pl-2 pr-8 py-1.5 focus:ring-[#007BC1] focus:border-[#007BC1] outline-none cursor-pointer"
                >
                  <option value="all">All Riders</option>
                  {riders.map(r => (
                    <option key={r.id} value={r.name}>{r.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-gray-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>

            <div className="space-y-3">
              {filteredActivityLog.length > 0 ? (
                filteredActivityLog.map((log, index) => (
                  <div key={index} className="flex gap-3 pb-3 border-b border-gray-100 last:border-0">
                    <div className="text-xs text-gray-500 w-16 flex-shrink-0">{log.time}</div>
                    <div className="flex-1">
                      <div className="text-xs font-medium text-gray-900">{log.rider}</div>
                      <div className="text-xs text-gray-600">{log.event}</div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-sm text-gray-400 text-center py-10 italic">
                  No activity found for this rider today.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}