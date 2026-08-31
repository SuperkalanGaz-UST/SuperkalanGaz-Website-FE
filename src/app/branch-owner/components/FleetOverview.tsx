import { useCallback, useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { Header } from './Header';
import { KPICard } from './KPICard';
import { Users, Navigation, AlertTriangle, Clock, Loader2 } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import type {
  FleetRider,
  PositionedFleetRider,
} from '../../lib/fleetPresentationData';
import { apiErrorMessage, apiFetch } from '../../lib/api';
import { DeliveryRiderAccess } from './DeliveryRiderAccess';

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

interface BranchOwnerFleetRider extends FleetRider {
  apiStatus: ApiRiderStatus;
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
  const [activeTab, setActiveTab] = useState<'overview' | 'access'>('overview');
  const [riders, setRiders] = useState<BranchOwnerFleetRider[]>([]);
  const [ridersLoading, setRidersLoading] = useState(true);
  const [ridersError, setRidersError] = useState<string | null>(null);
  const [ridersRefreshKey, setRidersRefreshKey] = useState(0);
  const assignedBranch = assignedBranches?.find(
    (branch) => branch.id === selectedBranchId,
  );
  const geofence = assignedBranch?.geofence ?? null;
  const activeRiders = riders.filter((rider) => rider.status === 'active').length;

  const loadRiders = useCallback(async (signal: AbortSignal) => {
    if (!selectedBranchId) {
      setRiders([]);
      setRidersError(null);
      setRidersLoading(false);
      return;
    }

    setRidersLoading(true);
    setRidersError(null);

    try {
      const response = await apiFetch(
        `/riders?branchId=${encodeURIComponent(selectedBranchId)}`,
        { signal },
      );
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Could not load the Delivery Rider roster.'));
      }

      const rawRiders =
        data && typeof data === 'object' && Array.isArray((data as { riders?: unknown }).riders)
          ? (data as { riders: unknown[] }).riders
          : [];
      const mapped = rawRiders.filter(isApiRiderRow).map((rider) => ({
        id: rider.id,
        name: rider.name,
        plateNumber: rider.plate,
        status: toFleetStatus(rider.status),
        apiStatus: rider.status,
        currentOrder: rider.current_order,
        lastUpdated: formatRelativeTime(rider.updated_at || rider.created_at),
      }));
      setRiders(mapped);
    } catch (error) {
      if (signal.aborted) return;
      setRiders([]);
      setRidersError(error instanceof Error ? error.message : 'Could not load the Delivery Rider roster.');
    } finally {
      if (!signal.aborted) setRidersLoading(false);
    }
  }, [selectedBranchId]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    void loadRiders(controller.signal);
    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [loadRiders, ridersRefreshKey]);

  // Positions are intentionally empty until the API receives authoritative
  // SinoTrack ST-901 → Traccar vehicle telemetry. Never place riders at a
  // fabricated point inside the branch geofence.
  const positionedRiders: PositionedFleetRider[] = [];

  const refreshRiders = useCallback(() => {
    setRidersRefreshKey((current) => current + 1);
  }, []);

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
            value="—"
            subtitle="Awaiting vehicle telemetry"
            icon={<AlertTriangle className="w-5 h-5 text-orange-500" />}
            accentColor="#f59e0b"
          />
          <KPICard
            title="Past Curfew"
            value="—"
            subtitle="Curfew data unavailable"
            icon={<Clock className="w-5 h-5 text-red-600" />}
            accentColor="#ef4444"
          />
        </div>

        <div className="grid grid-cols-3 gap-6 mb-8">
          <div className="col-span-2 bg-white rounded-lg border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900">Vehicle GPS Tracking</h3>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                <span className="text-xs text-gray-500">Telemetry unavailable</span>
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
              {ridersLoading ? (
                <div className="py-10 text-center text-sm text-gray-500">Loading Delivery Riders…</div>
              ) : ridersError ? (
                <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-red-600">
                  <span>{ridersError}</span>
                  <button
                    type="button"
                    onClick={refreshRiders}
                    className="rounded-md bg-white px-3 py-1.5 text-xs font-semibold text-[#007BC1] shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-blue-50"
                  >
                    Try again
                  </button>
                </div>
              ) : riders.length === 0 ? (
                <div className="py-10 text-center text-sm text-gray-500">
                  No Delivery Riders found in this branch.
                </div>
              ) : riders.map((rider) => (
                <div key={rider.id} className="p-3 rounded-lg border border-gray-200">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{rider.name}</div>
                      <div className="text-xs text-gray-500">{rider.plateNumber}</div>
                    </div>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                        rider.status === 'active'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {formatStatus(rider.apiStatus)}
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mb-1">
                    Order: {rider.currentOrder || 'None'}
                  </div>
                  <div className="text-[10px] text-gray-400">
                    Updated: {rider.lastUpdated}
                  </div>
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
              <div className="text-sm text-gray-500 font-medium">Not configured</div>
              <div className="text-xs text-gray-500 mt-1">Curfew settings are not available for this branch.</div>
            </div>
            <div>
              <div className="text-xs text-gray-500 mb-3">Active Geofence Alerts</div>
              <div className="flex items-start gap-3 rounded-lg bg-gray-50 p-3">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-gray-400" />
                <div className="text-sm text-gray-500">
                  Geofence alerts will appear when SinoTrack ST-901 vehicle telemetry is available.
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
        ) : (
          <DeliveryRiderAccess />
        )}
      </div>
    </div>
  );
}
