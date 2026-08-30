import { useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { Users, Navigation, AlertTriangle, Clock, ChevronDown, Loader2 } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import {
  FLEET_ACTIVITY,
  FLEET_RIDERS,
  positionFleetRiders,
} from '../../lib/fleetPresentationData';
import { DeliveryRiderAccess } from './DeliveryRiderAccess';

const BranchOwnerFleetMap = dynamic(
  () => import('./BranchOwnerFleetMap').then((module) => module.BranchOwnerFleetMap),
  { ssr: false },
);

export function FleetOverview() {
  const {
    selectedBranch,
    selectedBranchId,
    assignedBranches,
    assignedBranchesLoading,
    assignedBranchesError,
    refreshAssignedBranches,
  } = useBranch();
  const [selectedRider, setSelectedRider] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'access'>('overview');
  
  // State for filtering activity log by driver
  const [activityFilter, setActivityFilter] = useState<string>('all');

  const riders = FLEET_RIDERS;
  const activeRiders = riders.filter(r => r.status === 'active').length;
  const outsideGeofence = riders.filter(r => r.status === 'outside-geofence').length;
  const pastCurfew = 0;
  const assignedBranch = assignedBranches?.find(
    (branch) => branch.id === selectedBranchId,
  );
  const geofence = assignedBranch?.geofence ?? null;
  const positionedRiders = useMemo(
    () => geofence ? positionFleetRiders(riders, geofence) : [],
    [geofence, riders],
  );

  // Memoized filter logic for the activity log
  const filteredActivityLog = useMemo(() => {
    if (activityFilter === 'all') return FLEET_ACTIVITY;
    return FLEET_ACTIVITY.filter(log => log.rider === activityFilter);
  }, [activityFilter]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Fleet" />
      </div>

      <div className="p-8">
        <div
          className="mb-6 flex items-center gap-6 border-b border-gray-200"
          role="tablist"
          aria-label="Fleet sections"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'overview'}
            onClick={() => setActiveTab('overview')}
            className={`border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'overview'
                ? 'border-[#007BC1] text-[#007BC1]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Fleet Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'access'}
            onClick={() => setActiveTab('access')}
            className={`flex items-center gap-2 border-b-2 px-1 pb-3 text-sm font-semibold transition-colors ${
              activeTab === 'access'
                ? 'border-[#007BC1] text-[#007BC1]'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Delivery Rider Access
          </button>
        </div>

        {activeTab === 'overview' ? (
          <>
        <div className="grid grid-cols-4 gap-6 mb-8">
          <KPICard
            title="Total Delivery Riders"
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
              {assignedBranchesLoading ? (
                <div className="flex h-full items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin text-[#007BC1]" />
                  Preparing branch map…
                </div>
              ) : assignedBranchesError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center text-sm text-red-600">
                  <span>{assignedBranchesError}</span>
                  <button
                    type="button"
                    onClick={() => void refreshAssignedBranches()}
                    className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#007BC1] shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-blue-50"
                  >
                    Try again
                  </button>
                </div>
              ) : !assignedBranch ? (
                <div className="flex h-full items-center justify-center px-8 text-center text-sm text-red-600">
                  The selected branch is not assigned to this account.
                </div>
              ) : geofence ? (
                <BranchOwnerFleetMap
                  geofence={geofence}
                  riders={positionedRiders}
                  selectedRider={selectedRider}
                  onSelectRider={setSelectedRider}
                />
              ) : (
                <div className="flex h-full items-center justify-center px-8 text-center text-sm text-gray-500">
                  No geofence has been assigned to {selectedBranch}. Contact the Franchise Administrator.
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Delivery Rider Roster</h3>
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
              <div className="text-xs text-gray-500 mt-1">All Delivery Riders must return before curfew</div>
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
              <h3 className="font-semibold text-gray-900">Today&apos;s Fleet Activity</h3>
              
              {/* Driver Filter Dropdown */}
              <div className="relative">
                <select
                  value={activityFilter}
                  onChange={(e) => setActivityFilter(e.target.value)}
                  className="appearance-none bg-gray-50 border border-gray-200 text-gray-700 text-xs rounded-md pl-2 pr-8 py-1.5 focus:ring-[#007BC1] focus:border-[#007BC1] outline-none cursor-pointer"
                >
                  <option value="all">All Delivery Riders</option>
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
          </>
        ) : (
          <DeliveryRiderAccess />
        )}
      </div>
    </div>
  );
}
