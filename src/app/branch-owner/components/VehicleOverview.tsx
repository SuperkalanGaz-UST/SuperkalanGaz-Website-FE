'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Eye, History, ShieldCheck, Truck } from 'lucide-react';
import { useBranch } from '../contexts/BranchContext';
import { fetchJson } from '../../lib/api';
import { gpsRegistrationBadge } from '../../branch-manager/screens/vehicles/traccar-setup';
import styles from './VehicleOverview.module.css';

interface VehicleRow {
  id: string;
  plate_number: string;
  vehicle_type: string | null;
  assigned_rider_name: string | null;
  status: 'active' | 'maintenance' | 'inactive';
  gps_provisioning_status: 'unconfigured' | 'pending' | 'provisioned' | 'failed';
  current_odometer_km: number;
  km_since_last_pms: number;
  maintenance_threshold_km: number;
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
      {isLoading ? <p>Loading maintenance history…</p>
        : error ? <p role="alert">Could not load maintenance history. <button type="button" onClick={() => void refetch()}>Try again</button></p>
          : !data?.maintenanceLogs.length ? <p>No mileage entries logged yet.</p>
            : <table>
              <caption className="sr-only">Maintenance history</caption>
              <thead><tr><th>Date</th><th>Odometer</th><th>Fuel</th></tr></thead>
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
  const due = vehicle.status === 'maintenance';
  const status = due ? 'Maintenance Due' : vehicle.status === 'inactive' ? 'Inactive' : 'Healthy';
  const gps = gpsRegistrationBadge(vehicle.gps_provisioning_status);
  const percent = vehicle.maintenance_threshold_km > 0
    ? Math.min(100, Math.max(0, vehicle.km_since_last_pms / vehicle.maintenance_threshold_km * 100)) : 0;

  return (
    <article className={styles.vehicle} aria-label={`Vehicle ${vehicle.plate_number}`}>
      <div className={styles.cardHeader}>
        <div><h3>{vehicle.assigned_rider_name ?? 'Unassigned'}</h3><p className={styles.plate}>{vehicle.plate_number}{vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ''}</p></div>
        <div className={styles.badges}>
          <span className={due ? styles.due : vehicle.status === 'inactive' ? styles.neutral : styles.healthy}>{status}</span>
          <span className={styles.neutral} title={vehicle.gps_provisioning_status === 'provisioned' ? 'Device registration succeeded; this does not confirm live GPS reception.' : undefined}>{gps.label}</span>
        </div>
      </div>
      <div className={styles.metrics}>
        <div><span>Current odometer</span><strong>{vehicle.current_odometer_km.toLocaleString()} <small>km</small></strong></div>
        <div><span>Since last PMS</span><strong className={due ? styles.dueText : undefined}>{vehicle.km_since_last_pms.toLocaleString()} <small>km</small></strong></div>
      </div>
      <div>
        <div className={styles.progressLabel}><span>PMS Interval: {vehicle.maintenance_threshold_km.toLocaleString()} km</span><strong>{Math.round(percent)}%</strong></div>
        <div className={styles.progress} role="progressbar" aria-label="Distance toward next PMS" aria-valuenow={Math.round(percent)} aria-valuemin={0} aria-valuemax={100}><div style={{ width: `${percent}%` }} /></div>
      </div>
      <div className={styles.actions}>
        <button type="button" aria-expanded={historyOpen} aria-controls={`history-${vehicle.id}`} onClick={() => setHistoryOpen(open => !open)}><History size={16} />{historyOpen ? 'Hide History' : 'View History'}</button>
        {historyOpen && <div id={`history-${vehicle.id}`}><VehicleHistory vehicleId={vehicle.id} branchId={branchId} /></div>}
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
  const stats = [
    { label: 'Total Fleet', value: vehicles.length, icon: Truck },
    { label: 'Healthy Vehicles', value: vehicles.filter(vehicle => vehicle.status === 'active').length, icon: ShieldCheck, color: '#22c55e' },
    { label: 'PMS Due / Overdue', value: vehicles.filter(vehicle => vehicle.status === 'maintenance').length, icon: AlertTriangle, color: '#ef123c' },
  ];

  return (
      <section className={styles.main} aria-label="Vehicles">
        <div className={styles.toolbar}>
          <div><h2>Branch Vehicle Roster</h2><p>View delivery vehicles and their recorded PMS mileage. Vehicle updates are managed by your Branch Manager.</p></div>
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
