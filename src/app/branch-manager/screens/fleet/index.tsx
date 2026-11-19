'use client';

import VehicleGeofenceAlerts from './VehicleGeofenceAlerts';

import { useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import dynamic from 'next/dynamic';
import { Clock, Navigation, RefreshCw, Truck, Users } from 'lucide-react';
import { Badge } from '../../components/Badge';
import { fetchJson } from '../../../lib/api';
import { assignedBranchesFrom } from '../../../lib/branchGeofence';
import { useAccount } from '../../../contexts/AccountContext';
import { DeliveryRiderLocations } from '../orders/DeliveryRiderLocations';
import type { DispatchRider } from '../../../lib/deliveryRiderLocation';
import { serviceRequestCylinderSummary, type ServiceRequestCylinderFields } from '../../../lib/serviceRequestItems';
import { vehicleFixTime, type VehicleLocationsResponse } from './vehicleLocations';
import styles from './screen.module.css';
import VehicleRouteHistory from './VehicleRouteHistory';

interface SRRow extends ServiceRequestCylinderFields {
    id: string;
    rider_id: string | null;
    status: string;
}

const FleetMap = dynamic(() => import('./FleetMap'), {
    ssr: false,
    loading: () => <div className={styles.mapState}>Loading vehicle map…</div>,
});

export default function FleetPage() {
    const account = useAccount();
    const [vehicleSelection, setVehicleSelection] = useState<{ id: string } | null>(null);
    const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);
    const historyTriggerRef = useRef<HTMLButtonElement | null>(null);
    const branchQuery = useQuery({
        queryKey: ['assigned-branches'],
        queryFn: ({ signal }) => fetchJson<unknown>('/branches/assigned', { signal }),
    });
    const branch = assignedBranchesFrom(branchQuery.data).find(branch => branch.id === account.branchIds[0]);

    const vehicleQuery = useQuery({
        queryKey: ['fleet-vehicle-locations', account.id, account.branchIds[0]],
        queryFn: ({ signal }) => fetchJson<VehicleLocationsResponse>('/vehicles/locations', { signal }),
        refetchInterval: query => query.state.data?.refresh_interval_ms ?? 30_000,
        refetchIntervalInBackground: false,
        retry: false,
    });
    const riderQuery = useQuery({
        queryKey: ['dispatch-riders'],
        queryFn: ({ signal }) => fetchJson<{ riders: DispatchRider[] }>('/riders', { signal }),
        staleTime: 0,
        refetchInterval: 15_000,
        retry: false,
    });
    const { data: srData } = useQuery({
        queryKey: ['service-requests'],
        queryFn: () => fetchJson<{ serviceRequests: SRRow[] }>('/service-requests'),
    });

    const activeOrders = new Map<string, string>();
    for (const sr of srData?.serviceRequests ?? []) {
        if (sr.rider_id && (sr.status === 'Dispatched' || sr.status === 'En Route')) {
            activeOrders.set(sr.rider_id, `${serviceRequestCylinderSummary(sr)} delivery`);
        }
    }

    const vehicles = vehicleQuery.isError ? [] : vehicleQuery.data?.vehicles ?? [];
    const historyVehicle = vehicleQuery.data?.vehicles.find(vehicle => vehicle.id === historyVehicleId && vehicle.tracker_connected);
    const riders = riderQuery.isError ? [] : riderQuery.data?.riders ?? [];
    const activeRiders = riders.filter(rider => rider.status === 'Available' || rider.status === 'On Delivery').length;
    const geofence = branchQuery.isError ? null : branch?.geofence ?? null;
    const mapAvailable = geofence || vehicles.some(vehicle => vehicle.position);

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.statsGrid}>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Vehicles</span><Truck className={styles.statIcon} size={20} /></div><div className={styles.statValue}>{vehicleQuery.data && !vehicleQuery.isError ? vehicles.length : '—'}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Delivery Riders</span><Users className={styles.statIcon} size={20} /></div><div className={styles.statValue}>{riderQuery.data && !riderQuery.isError ? riders.length : '—'}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Active Delivery Riders</span><Navigation className={styles.statIcon} style={{ color: 'var(--success)' }} size={20} /></div><div className={styles.statValue}>{riderQuery.data && !riderQuery.isError ? activeRiders : '—'}</div></div>
            </div>

            <section className={styles.mapPanel} aria-labelledby="vehicle-locations-title">
                <div className={styles.panelHeader}>
                    <div>
                        <h2 className={styles.panelTitle} id="vehicle-locations-title">Vehicle locations</h2>
                        <p className={styles.subtitle}>SinoTrack ST-901 via Traccar · refreshes every {(vehicleQuery.data?.refresh_interval_ms ?? 30_000) / 1000} seconds</p>
                    </div>
                    <button className={styles.refreshButton} type="button" disabled={vehicleQuery.isFetching} aria-label="Refresh vehicle locations" onClick={() => { void vehicleQuery.refetch(); }}>
                        <RefreshCw size={15} />Refresh
                    </button>
                </div>
                {vehicleQuery.isError ? (
                    <p className={styles.notice} role="alert">Vehicle locations unavailable. Use Refresh to retry.</p>
                ) : vehicleQuery.data?.gps_unavailable && (
                    <p className={styles.notice} role="status">Some vehicle GPS data could not be loaded from Traccar. Use Refresh to retry.</p>
                )}
                <VehicleGeofenceAlerts vehicles={vehicles} unavailable={vehicleQuery.isError || vehicleQuery.data?.gps_unavailable} />
                <div className={styles.mainLayout}>
                    {mapAvailable ? (
                        <FleetMap vehicles={vehicles} geofence={geofence} selection={vehicleSelection} />
                    ) : (
                        <div className={styles.mapState}>
                            {vehicleQuery.isLoading || branchQuery.isLoading ? 'Preparing vehicle map…' : 'Vehicle pins appear when a connected SinoTrack ST-901 reports GPS.'}
                        </div>
                    )}
                    <div className={styles.vehicleRoster} aria-label="Vehicle roster">
                        <h3 className={styles.rosterTitle}>Vehicle roster</h3>
                        {vehicleQuery.isLoading ? (
                            <p className={styles.rosterMessage}>Loading vehicles…</p>
                        ) : vehicleQuery.isError ? (
                            <p className={styles.rosterMessage}>Vehicle roster unavailable.</p>
                        ) : vehicles.length === 0 ? (
                            <p className={styles.rosterMessage}>No registered vehicles in this branch.</p>
                        ) : vehicles.map(vehicle => (
                            <div className={styles.vehicleCard} key={vehicle.id} data-selected={!!vehicle.position && vehicleSelection?.id === vehicle.id}>
                                {vehicle.position ? (
                                    <button type="button" className={styles.focusVehicle}
                                        aria-label={`Show vehicle ${vehicle.plate_number} on map`}
                                        onClick={() => setVehicleSelection({ id: vehicle.id })}>{vehicle.plate_number}</button>
                                ) : <strong>{vehicle.plate_number}</strong>}
                                {vehicle.display_name && <span>{vehicle.display_name}</span>}
                                {vehicle.position ? (
                                    <>
                                        <span className={vehicle.position.stale ? styles.staleFix : undefined}>
                                            {vehicle.position.stale ? 'Last known fix' : 'GPS fix'} · <time dateTime={vehicle.position.captured_at}>{vehicleFixTime.format(new Date(vehicle.position.captured_at))}</time>
                                        </span>
                                        <span className={styles.coordinates}>{vehicle.position.latitude.toFixed(6)}, {vehicle.position.longitude.toFixed(6)}</span>
                                    </>
                                ) : <span>{vehicle.tracker_connected ? 'GPS position unavailable' : 'Tracker setup incomplete'}</span>}
                                {vehicle.tracker_connected && (
                                    <button className={styles.refreshButton} type="button" aria-label={`View route history for ${vehicle.plate_number}`}
                                        ref={element => { if (element && vehicle.id === historyVehicleId) historyTriggerRef.current = element; }}
                                        onClick={event => { historyTriggerRef.current = event.currentTarget; setHistoryVehicleId(vehicle.id); }}>Route history</button>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
                {branchQuery.isError && <p className={styles.notice} role="status">Branch boundary unavailable.</p>}
            </section>

            {historyVehicle && <VehicleRouteHistory key={`${account.id}:${account.branchIds[0]}:${historyVehicle.id}`}
                vehicle={historyVehicle} scope={`${account.id}:${account.branchIds[0]}`} branchGeofence={geofence} onClose={() => setHistoryVehicleId(null)}
                onReturnFocus={() => historyTriggerRef.current?.focus()} />}

            <DeliveryRiderLocations
                riders={riders}
                loading={riderQuery.isLoading}
                refreshing={riderQuery.isFetching}
                error={riderQuery.error?.message ?? null}
                onRefresh={() => { void riderQuery.refetch(); }}
            />

            <div className={styles.bottomLayout}>
                <div className={styles.listPanel}>
                    <div className={styles.panelHeader}><h2 className={styles.panelTitle}>Branch Operating Hours</h2></div>
                    <div className={styles.operatingHours}><Clock size={16} />6:00 AM – 10:00 PM</div>
                </div>
                <div className={styles.listPanel}>
                    <div className={styles.panelHeader}><h2 className={styles.panelTitle}>Today&apos;s Fleet Activity</h2></div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.logTable}>
                            <thead><tr><th>Delivery Rider</th><th>Status</th><th>Assigned Vehicle</th><th>Current Order</th></tr></thead>
                            <tbody>
                                {riders.length === 0 ? (
                                    <tr><td colSpan={4} className={styles.rosterMessage}>{riderQuery.isError ? 'Delivery Rider roster unavailable.' : riderQuery.isLoading ? 'Loading Delivery Riders…' : 'No Delivery Riders in this branch.'}</td></tr>
                                ) : riders.map(rider => (
                                    <tr key={rider.id}>
                                        <td className={styles.logRider}>{rider.name}</td>
                                        <td><Badge variant={rider.status === 'Available' || rider.status === 'On Delivery' ? 'success' : 'secondary'}>{rider.status}</Badge></td>
                                        <td>{rider.assigned_vehicle?.plate_number ?? '—'}</td>
                                        <td>{activeOrders.get(rider.id) ?? '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}
