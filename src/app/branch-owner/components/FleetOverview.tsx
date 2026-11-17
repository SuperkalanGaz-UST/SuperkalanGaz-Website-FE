import { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { Users, Navigation, AlertTriangle, Loader2, Truck } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import type { FleetRider } from '../../lib/fleetPresentationData';
import { fetchJson } from '../../lib/api';
import { DeliveryRiderAccess } from './DeliveryRiderAccess';
import { VehicleOverview } from './VehicleOverview';
import { FleetTabs, type FleetTab } from '../../components/FleetTabs';
import VehicleRouteHistory from '../../branch-manager/screens/fleet/VehicleRouteHistory';
import { vehicleFixTime, type VehicleLocationsResponse } from '../../branch-manager/screens/fleet/vehicleLocations';

type ApiRiderStatus = 'Available' | 'On Delivery' | 'Maintenance Due' | 'Offline';

interface ApiRiderRow {
  id: string;
  branch_id: string;
  name: string;
  plate: string;
  status: ApiRiderStatus;
  created_at: string;
  updated_at: string;
  current_order: string | null;
}

function isApiRiderStatus(value: unknown): value is ApiRiderStatus {
  return (
    value === 'Available' ||
    value === 'On Delivery' ||
    value === 'Maintenance Due' ||
    value === 'Offline'
  );
}

function isApiRiderRow(value: unknown): value is ApiRiderRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    typeof row.branch_id === 'string' &&
    typeof row.name === 'string' &&
    typeof row.plate === 'string' &&
    isApiRiderStatus(row.status) &&
    typeof row.created_at === 'string' &&
    typeof row.updated_at === 'string' &&
    (row.current_order === null || typeof row.current_order === 'string')
  );
}

function toFleetStatus(status: ApiRiderStatus): FleetRider['status'] {
  return status === 'Available' || status === 'On Delivery' ? 'active' : 'inactive';
}

function formatStatus(status: ApiRiderStatus): string {
  switch (status) {
    case 'Available':
      return 'Available';
    case 'On Delivery':
      return 'On Delivery';
    case 'Maintenance Due':
      return 'Maintenance Due';
    case 'Offline':
      return 'Offline';
  }
}

function formatRelativeTime(iso: string): string {
  const timestamp = new Date(iso).getTime();
  if (!Number.isFinite(timestamp)) return 'Unknown';

  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const FleetMap = dynamic(
  () => import('../../branch-manager/screens/fleet/FleetMap'),
  { ssr: false },
);

export function FleetOverview({ vehiclesActive, onNavigate }: {
  vehiclesActive: boolean;
  onNavigate: (screen: string) => void;
}) {
  const {
    selectedBranchId,
    assignedBranches,
    assignedBranchesLoading,
    assignedBranchesError,
    refreshAssignedBranches,
  } = useBranch();
  const [overviewTab, setOverviewTab] = useState<'overview' | 'access'>('overview');
  const [rosterView, setRosterView] = useState<'riders' | 'vehicles'>('riders');
  const [vehicleSelection, setVehicleSelection] = useState<{ branchId: string; id: string } | null>(null);
  const [historySelection, setHistorySelection] = useState<{ branchId: string; id: string } | null>(null);
  const historyTriggerRef = useRef<HTMLButtonElement | null>(null);
  const activeTab = vehiclesActive ? 'vehicles' : overviewTab;
  const changeTab = (tab: FleetTab) => {
    if (tab === 'vehicles') {
      onNavigate('vehicles');
    } else {
      setOverviewTab(tab);
      if (vehiclesActive) onNavigate('fleet-overview');
    }
  };
  const queryClient = useQueryClient();

  const {
    data: ridersData,
    isLoading: isRidersLoadingQuery,
    error: ridersQueryError,
  } = useQuery({
    queryKey: ['riders', selectedBranchId],
    queryFn: () => fetchJson<{ riders: ApiRiderRow[] }>(`/riders?branchId=${encodeURIComponent(selectedBranchId!)}`),
    enabled: !!selectedBranchId && activeTab === 'overview',
    staleTime: 30_000,
  });

  const riders = useMemo(() => {
    const rawRiders = ridersData?.riders ?? [];
    return rawRiders.filter(isApiRiderRow).map((rider) => ({
      id: rider.id,
      name: rider.name,
      plateNumber: rider.plate,
      status: toFleetStatus(rider.status),
      apiStatus: rider.status,
      currentOrder: rider.current_order,
      lastUpdated: formatRelativeTime(rider.updated_at || rider.created_at),
    }));
  }, [ridersData]);

  const ridersLoading = isRidersLoadingQuery && !!selectedBranchId;
  const ridersError = ridersQueryError ? ridersQueryError.message || 'Could not load the Delivery Rider roster.' : null;

  const assignedBranch = assignedBranches?.find(
    (branch) => branch.id === selectedBranchId,
  );

  const geofence = assignedBranch?.geofence ?? null;
  const activeRiders = riders.filter((rider) => rider.status === 'active').length;
  const vehicleQuery = useQuery({
    queryKey: ['owner-vehicle-locations', selectedBranchId],
    queryFn: ({ signal }) => fetchJson<VehicleLocationsResponse>(
      `/vehicles/locations?branchId=${encodeURIComponent(selectedBranchId!)}`, { signal },
    ),
    enabled: !!selectedBranchId && !!assignedBranch && activeTab === 'overview',
    refetchInterval: query => query.state.data?.refresh_interval_ms ?? 30_000,
    refetchIntervalInBackground: false,
    retry: false,
  });
  const vehicleData = selectedBranchId && assignedBranch ? vehicleQuery.data : undefined;
  const vehicles = vehicleQuery.isError ? [] : vehicleData?.vehicles ?? [];
  const historyVehicle = historySelection?.branchId === selectedBranchId
    ? vehicleData?.vehicles.find(vehicle => vehicle.id === historySelection.id && vehicle.tracker_connected)
    : undefined;

  const refreshRiders = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['riders', selectedBranchId] });
  }, [queryClient, selectedBranchId]);

  return (
    <div className="flex-1 overflow-y-auto">
      <div style={{ position: 'static' }}>
        <Header title="Fleet" />
      </div>

      <div className="p-4 md:p-8">
        <FleetTabs activeTab={activeTab} onTabChange={changeTab} showAccess>
        {activeTab === 'overview' ? (
          <>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
            title="Vehicles"
            value={vehicleData && !vehicleQuery.isError ? String(vehicles.length) : '—'}
            icon={<Truck className="w-5 h-5 text-[#007BC1]" />}
            accentColor="#007BC1"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          <section className="lg:col-span-2 min-w-0 bg-white rounded-lg border border-gray-200 p-4 md:p-6" aria-label="Vehicle locations">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="font-semibold text-gray-900">Vehicle GPS Tracking</h3>
                <p className="text-xs text-gray-500 mt-1">SinoTrack ST-901 via Traccar · refreshes every {(vehicleData?.refresh_interval_ms ?? 30_000) / 1000} seconds</p>
              </div>
              <button type="button" aria-label="Refresh vehicle locations" disabled={!selectedBranchId || vehicleQuery.isFetching}
                onClick={() => void vehicleQuery.refetch()} className="rounded-md border border-gray-200 px-3 py-1.5 text-xs font-semibold text-[#007BC1] disabled:opacity-50">Refresh</button>
            </div>
            {vehicleQuery.isError && <p className="mb-3 text-sm text-red-600" role="alert">Vehicle positions unavailable. Use Refresh to retry.</p>}
            {vehicleData?.gps_unavailable && <p className="mb-3 text-sm text-amber-700" role="status">Some vehicle GPS data could not be loaded from Traccar. Use Refresh to retry.</p>}
            <div className="relative bg-gray-100 rounded-lg overflow-hidden">
              {assignedBranchesLoading ? (
                <div className="flex min-h-80 items-center justify-center gap-2 text-sm text-gray-500">
                  <Loader2 className="h-4 w-4 animate-spin text-[#007BC1]" />Preparing branch map…
                </div>
              ) : assignedBranchesError ? (
                <div className="flex min-h-80 flex-col items-center justify-center gap-3 px-8 text-center text-sm text-red-600">
                  <span>{assignedBranchesError}</span>
                  <button type="button" onClick={() => void refreshAssignedBranches()} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#007BC1] ring-1 ring-gray-200">Try again</button>
                </div>
              ) : !assignedBranch ? (
                <div className="flex min-h-80 items-center justify-center px-8 text-center text-sm text-gray-500">Select an assigned branch to view its vehicles.</div>
              ) : geofence || vehicles.some(vehicle => vehicle.position) ? (
                <FleetMap key={selectedBranchId} geofence={geofence} vehicles={vehicles}
                  selection={vehicleSelection?.branchId === selectedBranchId ? vehicleSelection : null} />
              ) : (
                <div className="flex min-h-80 items-center justify-center px-8 text-center text-sm text-gray-500">
                  {vehicleQuery.isLoading ? 'Loading vehicle positions…' : 'Vehicle pins appear when a connected SinoTrack ST-901 reports GPS.'}
                </div>
              )}
            </div>
          </section>

          <section className="min-w-0 bg-white rounded-lg border border-gray-200 p-4 md:p-6" aria-label="Fleet roster">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <h3 className="font-semibold text-gray-900">Fleet roster</h3>
              <select aria-label="Roster view" value={rosterView}
                onChange={event => setRosterView(event.target.value === 'vehicles' ? 'vehicles' : 'riders')}
                className="min-w-0 rounded-md border border-gray-200 bg-white px-2 py-1.5 text-sm text-gray-700">
                <option value="riders">Delivery Riders</option><option value="vehicles">Vehicles</option>
              </select>
            </div>
            <div className="space-y-3 max-h-[500px] overflow-y-auto">
              {rosterView === 'vehicles' ? (
                !selectedBranchId ? <p className="py-10 text-center text-sm text-gray-500">Select an assigned branch to view its vehicles.</p>
                  : vehicleQuery.isLoading ? <p className="py-10 text-center text-sm text-gray-500">Loading vehicles…</p>
                    : vehicleQuery.isError ? <p className="py-10 text-center text-sm text-red-600">Vehicle roster unavailable. Use Refresh to retry.</p>
                      : vehicles.length === 0 ? <p className="py-10 text-center text-sm text-gray-500">No registered vehicles in this branch.</p>
                        : vehicles.map(vehicle => (
                          <article key={vehicle.id} className="space-y-2 rounded-lg border border-gray-200 p-3" aria-label={`Vehicle ${vehicle.plate_number}`}>
                            <div>
                              {vehicle.position ? <button type="button" aria-label={`Show vehicle ${vehicle.plate_number} on map`}
                                className="text-sm font-semibold text-[#007BC1] underline underline-offset-2"
                                onClick={() => setVehicleSelection({ branchId: selectedBranchId, id: vehicle.id })}>{vehicle.plate_number}</button>
                                : <strong className="text-sm text-gray-900">{vehicle.plate_number}</strong>}
                              {vehicle.display_name && <p className="text-xs text-gray-500">{vehicle.display_name}</p>}
                            </div>
                            {vehicle.position ? <div className="space-y-1 text-xs text-gray-500">
                              <p>{vehicle.position.stale ? 'Last known fix' : 'GPS fix'} · {vehicleFixTime.format(new Date(vehicle.position.captured_at))}</p>
                              <p>{vehicle.position.latitude.toFixed(6)}, {vehicle.position.longitude.toFixed(6)}</p>
                            </div> : <p className="text-xs text-gray-500">{vehicle.tracker_connected ? 'GPS position unavailable' : 'Tracker setup incomplete'}</p>}
                            {vehicle.tracker_connected && <button type="button" aria-label={`View route history for ${vehicle.plate_number}`}
                              ref={element => { if (element && historySelection?.branchId === selectedBranchId && historySelection.id === vehicle.id) historyTriggerRef.current = element; }}
                              onClick={event => { historyTriggerRef.current = event.currentTarget; setHistorySelection({ branchId: selectedBranchId, id: vehicle.id }); }}
                              className="rounded-md border border-gray-200 px-2 py-1 text-xs font-semibold text-[#007BC1]">Route history</button>}
                          </article>
                        ))
              ) : ridersLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">Loading Delivery Riders…</div>
              ) : ridersError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-red-600">
                  <span>{ridersError}</span>
                  <button type="button" onClick={refreshRiders} className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#007BC1] ring-1 ring-gray-200">Try again</button>
                </div>
              ) : riders.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">No Delivery Riders found in this branch.</div>
              ) : riders.map(rider => (
                <div key={rider.id} className="p-3 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div><div className="text-sm font-medium text-gray-900">{rider.name}</div><div className="text-xs text-gray-500">{rider.plateNumber}</div></div>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${rider.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>{formatStatus(rider.apiStatus)}</span>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">Order: {rider.currentOrder || 'None'}</div>
                  <div className="text-[10px] text-gray-400">Updated: {rider.lastUpdated}</div>
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="grid grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <h3 className="font-semibold text-gray-900 mb-4">Curfew & Active Alerts</h3>
            <div className="mb-4 pb-4 border-b border-gray-200">
              <div className="text-xs text-gray-500 mb-2">Branch Operating Hours</div>
              <div className="text-sm text-gray-500 font-medium">Not configured</div>
              <div className="text-xs text-gray-500 mt-1">Curfew settings are not available for this branch.</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-3">Active Geofence Alerts</div>
              <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-gray-400" />
                <div className="text-sm text-gray-500">
                  Vehicle geofence event history is unavailable.
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Delivery Rider Status</h3>
            </div>

            <div className="space-y-3">
              {ridersLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">Loading Delivery Rider status…</div>
              ) : riders.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">No rider status to display.</div>
              ) : (
                riders.map((rider) => (
                  <div key={rider.id} className="flex gap-3 border-b border-gray-100 pb-3 last:border-0">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-medium text-gray-900">{rider.name}</div>
                      <div className="text-xs text-gray-600">
                        {rider.currentOrder ? `Current Service Request: ${rider.currentOrder}` : 'No active Service Request'}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-medium text-gray-700">{formatStatus(rider.apiStatus)}</div>
                      <div className="text-[10px] text-gray-400">Updated: {rider.lastUpdated}</div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
          </>
        ) : activeTab === 'vehicles' ? (
          <VehicleOverview />
        ) : (
          <DeliveryRiderAccess />
        )}
        </FleetTabs>
        {activeTab === 'overview' && historyVehicle && selectedBranchId && (
          <VehicleRouteHistory key={`owner:${selectedBranchId}:${historyVehicle.id}`} vehicle={historyVehicle}
            scope={`owner:${selectedBranchId}`} branchId={selectedBranchId} onClose={() => setHistorySelection(null)}
            onReturnFocus={() => historyTriggerRef.current?.focus()} />
        )}
      </div>
    </div>
  );
}
