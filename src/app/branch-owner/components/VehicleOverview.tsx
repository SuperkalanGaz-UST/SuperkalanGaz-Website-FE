'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Eye, History, ShieldCheck, Truck } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import { fetchJson } from '../../lib/api';
import { isVehicleServiceDue, VehicleMileageSummary, type VehicleMileageSummaryData } from '../../components/VehicleMileageSummary';
import styles from './VehicleOverview.module.css';

interface VehicleRow extends VehicleMileageSummaryData {
  id: string;
  plate_number: string;
  /** Optional Branch Manager label; Owners see it read-only. */
  display_name?: string | null;
  vehicle_type: string | null;
  assigned_rider_name: string | null;
}

interface MaintenanceLog {
  id: string;
  odometer_km: number;
  fuel_liters: number | null;
  logged_at: string;
}

function VehicleHistory({ vehicleId, branchId }: { vehicleId: string; branchId: string }) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['owner-vehicle-history', branchId, vehicleId],
    queryFn: ({ signal }) => fetchJson<{ maintenanceLogs: MaintenanceLog[] }>(
      `/vehicles/${vehicleId}?branchId=${encodeURIComponent(branchId)}`,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) },
    ),
    staleTime: 30_000,
  });

  return (
    <div className={styles.history} aria-live="polite">
      {isLoading ? <p>Loading saved readings…</p>
        : error ? <p role="alert">Couldn’t load saved readings. <button type="button" onClick={() => void refetch()}>Try again</button></p>
          : !data?.maintenanceLogs.length ? <p>No readings added by staff yet.</p>
            : <table>
              <caption className="sr-only">Readings added by staff</caption>
              <thead><tr><th>Date</th><th>Total distance</th><th>Fuel</th></tr></thead>
              <tbody>{data.maintenanceLogs.map(log => (
                <tr key={log.id}>
                  <td>{new Date(log.logged_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</td>
                  <td>{log.odometer_km.toLocaleString()} km</td>
                  <td>{log.fuel_liters === null ? '—' : `${log.fuel_liters} L`}</td>
                </tr>
              ))}</tbody>
            </table>}
    </div>
  );
}

function VehicleCard({ vehicle, branchId }: { vehicle: VehicleRow; branchId: string }) {
  const [historyOpen, setHistoryOpen] = useState(false);

  return (
    <article className={styles.vehicle} aria-label={`Vehicle ${vehicle.plate_number}`}>
      <header className={styles.cardHeader}>
        <h3>{vehicle.display_name || vehicle.plate_number}</h3>
        <p className={styles.plate}>
          {vehicle.display_name && vehicle.display_name !== vehicle.plate_number ? `${vehicle.plate_number} · ` : null}
          {vehicle.vehicle_type ? `${vehicle.vehicle_type} · ` : null}{vehicle.assigned_rider_name ?? 'No Delivery Rider assigned'}
        </p>
      </header>
      <VehicleMileageSummary vehicle={vehicle} />
      <div className={styles.actions}>
        <button type="button" aria-expanded={historyOpen} aria-controls={`history-${vehicle.id}`} onClick={() => setHistoryOpen(open => !open)}><History size={16} />{historyOpen ? 'Hide staff readings' : 'View staff readings'}</button>
        <div id={`history-${vehicle.id}`} hidden={!historyOpen}>{historyOpen ? <VehicleHistory vehicleId={vehicle.id} branchId={branchId} /> : null}</div>
      </div>
    </article>
  );
}

export function VehicleOverview() {
  const { selectedBranchId, assignedBranchesLoading, assignedBranchesError } = useBranch();
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['owner-vehicles', selectedBranchId],
    queryFn: ({ signal }) => fetchJson<{ vehicles: VehicleRow[] }>(
      `/vehicles?branchId=${encodeURIComponent(selectedBranchId!)}`,
      { signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]) },
    ),
    enabled: !!selectedBranchId,
    staleTime: 30_000,
    refetchInterval: 300_000,
    refetchIntervalInBackground: false,
  });
  // Older API releases may still include inactive (soft-archived) records.
  const vehicles = (data?.vehicles ?? []).filter(vehicle => vehicle.status !== 'inactive');
  const ready = !!selectedBranchId && !!data && !error;
  const serviceDueCount = vehicles.filter(isVehicleServiceDue).length;
  const stats = [
    { label: 'Vehicles', value: vehicles.length, icon: Truck },
    { label: 'Service up to date', value: vehicles.length - serviceDueCount, icon: ShieldCheck, color: '#15803d' },
    { label: 'Service due', value: serviceDueCount, icon: AlertTriangle, color: '#b91c1c' },
  ];

  return (
      <section className={styles.main} aria-label="Vehicles">
        <div className={styles.toolbar}>
          <div><h2>Branch vehicles</h2><p>See how far each vehicle has gone and when it needs service.</p></div>
          <span className={styles.viewOnly}><Eye size={16} />View-only</span>
        </div>
        <section className={styles.stats} aria-label="Fleet summary">
          {stats.map(stat => <div key={stat.label} className={styles.stat}>
            <div><span>{stat.label}</span><stat.icon size={20} style={{ color: stat.color }} /></div>
            <strong style={{ color: stat.color }}>{ready ? stat.value : '—'}</strong>
          </div>)}
        </section>
        {assignedBranchesLoading ? <p className={styles.empty}>Loading assigned branches…</p>
          : !selectedBranchId ? <p className={styles.empty}>{assignedBranchesError ? 'Assigned branches are unavailable. Use the branch selector to retry.' : 'Select an assigned branch to view its vehicles.'}</p>
            : error ? <div className={styles.empty} role="alert"><p>Could not load vehicles.</p><button type="button" onClick={() => void refetch()}>Try again</button></div>
              : isLoading ? <p className={styles.empty}>Loading vehicles…</p>
                : !vehicles.length ? <p className={styles.empty}>No vehicles on this branch&apos;s roster yet.</p>
                  : <section className={styles.grid} aria-label="Branch vehicles">{vehicles.map(vehicle => <VehicleCard key={`${selectedBranchId}:${vehicle.id}`} vehicle={vehicle} branchId={selectedBranchId} />)}</section>}
      </section>
  );
}
