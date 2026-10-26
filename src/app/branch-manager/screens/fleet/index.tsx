'use client';

import { useMemo, useState } from "react";
import { useQuery } from '@tanstack/react-query';
import dynamic from "next/dynamic";
import { AlertCircle, Clock, MapPin, Navigation, ShieldAlert, Truck } from "lucide-react";
import { Badge } from "../../components/Badge";
import styles from "./screen.module.css";
import { fetchJson } from "../../../lib/api";
import {
    assignedBranchesFrom,
} from "../../../lib/branchGeofence";
import { useAccount } from "../../../contexts/AccountContext";
import { DeliveryRiderLocations } from '../orders/DeliveryRiderLocations';
import type { DispatchRider } from '../../../lib/deliveryRiderLocation';

/** Rider status as returned by the NestJS Fleet API. */
type ApiRiderStatus = 'Available' | 'On Delivery' | 'Maintenance Due' | 'Offline';

interface ApiRiderRow extends DispatchRider {
    id: string;
    branch_id: string;
    name: string;
    plate: string;
    status: ApiRiderStatus;
    created_at: string;
    updated_at: string;
}

interface SRRow {
    id: string;
    rider_id: string | null;
    status: string;
    cylinder_size: string;
}

/** Presentation status for the Fleet UI. */
type FleetRiderStatus = 'active' | 'inactive' | 'outside-geofence';

interface FleetRider {
    id: string;
    name: string;
    plateNumber: string;
    status: FleetRiderStatus;
    currentOrder: string | null;
    lastUpdated: string;
}

const FleetMap = dynamic(() => import("./FleetMap"), { ssr: false, loading: () => <div style={{ height: "100%", background: "var(--muted)", borderRadius: "var(--radius-lg)" }} /> });

/** Map backend rider status to Fleet UI status. */
function toFleetStatus(status: ApiRiderStatus): FleetRiderStatus {
    switch (status) {
        case 'Available':
        case 'On Delivery':
            return 'active';
        case 'Maintenance Due':
        case 'Offline':
            return 'inactive';
    }
}

const getStatusBadgeVariant = (status: FleetRiderStatus) => {
    switch (status) {
        case "active": return "success" as const;
        case "outside-geofence": return "warning" as const;
        default: return "secondary" as const;
    }
};

const formatStatusText = (status: FleetRiderStatus) => {
    switch (status) {
        case "active": return "Active";
        case "outside-geofence": return "Outside";
        default: return "Inactive";
    }
};

export default function FleetPage() {
    const account = useAccount();
    const branchName = account.branches[0];
    const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
    const { data: geofenceData, error: geofenceQueryError, isLoading: geofenceLoading } = useQuery({
        queryKey: ['assigned-branches'],
        queryFn: () => fetchJson<unknown>('/branches/assigned'),
    });

    const geofence = useMemo(() => {
        if (!geofenceData) return null;
        const assignedBranch = assignedBranchesFrom(geofenceData).find((branch) => branch.name === branchName);
        return assignedBranch?.geofence ?? null;
    }, [geofenceData, branchName]);

    const geofenceError = geofenceQueryError ? geofenceQueryError.message : (geofenceData && !geofence ? 'The signed-in account has no active assigned branch.' : null);

    const { data: ridersData, error: ridersQueryError, isLoading: ridersLoading, isFetching: ridersRefreshing, refetch: refreshRiders } = useQuery({
        queryKey: ['dispatch-riders'],
        queryFn: ({ signal }) => fetchJson<{ riders: ApiRiderRow[] }>('/riders', { signal }),
        staleTime: 0,
        refetchInterval: 15_000,
        retry: false,
    });

    const { data: srData } = useQuery({
        queryKey: ['service-requests'],
        queryFn: () => fetchJson<{ serviceRequests: SRRow[] }>('/service-requests'),
    });

    const ridersError = ridersQueryError ? ridersQueryError.message : null;

    const riders = useMemo(() => {
        const apiRiders = ridersData?.riders ?? [];
        const serviceRequests = srData?.serviceRequests ?? [];

        const activeOrders = new Map<string, string>();
        for (const sr of serviceRequests) {
            if (sr.rider_id && (sr.status === 'Dispatched' || sr.status === 'En Route')) {
                activeOrders.set(sr.rider_id, `${sr.cylinder_size} delivery`);
            }
        }

        return apiRiders.map((r) => ({
            id: r.id,
            name: r.name,
            plateNumber: r.plate,
            status: toFleetStatus(r.status),
            currentOrder: activeOrders.get(r.id) ?? null,
            lastUpdated: formatRelativeTime(r.updated_at),
        }));
    }, [ridersData, srData]);

    const handleRiderClick = (rider: FleetRider) => {
        setSelectedRiderId(rider.id);
    };

    const activeRiders = riders.filter(r => r.status === "active").length;
    const outsideRider = riders.find(r => r.status === "outside-geofence");

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.statsGrid}>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Delivery Riders</span><Truck className={styles.statIcon} size={20} /></div><div className={styles.statValue}>{riders.length}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Active Now</span><Navigation className={styles.statIcon} style={{ color: "var(--success)" }} size={20} /></div><div className={styles.statValue}>{activeRiders}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Vehicle Geofence</span><ShieldAlert className={styles.statIcon} style={{ color: "var(--warning)" }} size={20} /></div><div className={styles.riderOrderPlaceholder}>Position unavailable</div></div>
            </div>

            <div className={styles.mainLayout}>
                <div className={styles.mapPanel}>
                    <div className={styles.panelHeader}>
                        <h2 className={styles.panelTitle}>Vehicle GPS coverage</h2>
                        <Badge variant="outline">SinoTrack ST-901 / Traccar</Badge>
                    </div>
                    <div className={styles.mapContainer}>
                        {geofenceLoading ? (
                            <div className={styles.mapState}>Preparing branch map…</div>
                        ) : geofenceError ? (
                            <div className={`${styles.mapState} ${styles.mapStateError}`}>{geofenceError}</div>
                        ) : geofence ? (
                            <FleetMap riders={[]} geofence={geofence} mapCenter={null} />
                        ) : (
                            <div className={styles.mapState}>No geofence has been assigned to {branchName}.</div>
                        )}
                    </div>
                    <p style={{ padding: '0.75rem 1.25rem', fontSize: '0.75rem', color: 'var(--muted-foreground)' }}>Vehicle positions unavailable. This map shows the branch boundary only. Delivery Rider phone locations appear separately below.</p>
                </div>

                <div className={styles.listPanel}>
                    <div className={styles.panelHeader}><h2 className={styles.panelTitle}>Fleet Roster</h2></div>
                    <div className={styles.riderList}>
                        {ridersLoading ? (
                            <div className={styles.riderOrderPlaceholder}>Loading riders…</div>
                        ) : ridersError ? (
                            <div className={styles.riderOrderPlaceholder}>{ridersError}</div>
                        ) : riders.length === 0 ? (
                            <div className={styles.riderOrderPlaceholder}>No riders found in this branch.</div>
                        ) : (
                            riders.map((rider) => (
                                <button key={rider.id} className={`${styles.riderCard} ${selectedRiderId === rider.id ? styles.riderCardSelected : ""}`} onClick={() => handleRiderClick(rider)} type="button">
                                    <div className={styles.riderCardHeader}>
                                        <div className={styles.riderIdentity}>
                                            <span className={styles.riderName}>{rider.name}</span>
                                            <span className={styles.riderPlate}>{rider.plateNumber}</span>
                                        </div>
                                        <Badge variant={getStatusBadgeVariant(rider.status)}>{formatStatusText(rider.status)}</Badge>
                                    </div>
                                    <div className={styles.riderMeta}>
                                        {rider.currentOrder ? (
                                            <span className={styles.riderOrder}><MapPin size={14} />Delivering {rider.currentOrder}</span>
                                        ) : (
                                            <span className={styles.riderOrderPlaceholder}>No active order</span>
                                        )}
                                        <span className={styles.riderTime}><Clock size={14} />Roster updated {rider.lastUpdated}</span>
                                    </div>
                                    {rider.status === "outside-geofence" && (
                                        <div className={styles.riderAlert}><AlertCircle size={14} />Outside designated geofence</div>
                                    )}
                                </button>
                            ))
                        )}
                    </div>
                </div>
            </div>

            <DeliveryRiderLocations
                riders={ridersData?.riders ?? []}
                loading={ridersLoading}
                refreshing={ridersRefreshing}
                error={ridersError}
                onRefresh={() => { void refreshRiders(); }}
            />

            <div className={styles.bottomLayout}>
                <div className={styles.alertsPanel}>
                    <div className={styles.panelHeader}><h2 className={styles.panelTitle}>Curfew &amp; Active Alerts</h2></div>
                    <div className={styles.alertsContent}>
                        <div className={styles.operatingHours}>
                            <Clock size={16} className={styles.operatingHoursIcon} />
                            <div>
                                <div className={styles.operatingHoursTitle}>Branch Operating Hours</div>
                                <div className={styles.operatingHoursTime}>6:00 AM – 10:00 PM</div>
                            </div>
                        </div>
                        <div className={styles.alertList}>
                            {outsideRider ? (
                                <div className={styles.criticalAlert}>
                                    <ShieldAlert size={18} className={styles.criticalAlertIcon} />
                                    <div>
                                        <div className={styles.criticalAlertTitle}>Geofence Breach Detected</div>
                                        <div className={styles.criticalAlertDesc}>{outsideRider.name} ({outsideRider.plateNumber}) has exited the designated geofence.</div>
                                    </div>
                                </div>
                            ) : (
                                <div className={styles.allClear}>Vehicle geofence status is unavailable until hardware positions are received.</div>
                            )}
                        </div>
                    </div>
                </div>
                <div className={styles.logsPanel}>
                    <div className={styles.panelHeader}><h2 className={styles.panelTitle}>Today&apos;s Fleet Activity</h2></div>
                    <div className={styles.tableWrapper}>
                        <table className={styles.logTable}>
                            <thead><tr><th>Rider</th><th>Status</th><th>Current Order</th></tr></thead>
                            <tbody>
                                {riders.length === 0 ? (
                                    <tr><td colSpan={3} className={styles.riderOrderPlaceholder}>No rider activity to display.</td></tr>
                                ) : (
                                    riders.map((rider) => (
                                        <tr key={rider.id}>
                                            <td className={styles.logRider}>{rider.name}</td>
                                            <td><Badge variant={getStatusBadgeVariant(rider.status)}>{formatStatusText(rider.status)}</Badge></td>
                                            <td className={styles.logEvent}>{rider.currentOrder ?? '—'}</td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

/** ISO timestamp → relative "X ago" string for the fleet roster. */
function formatRelativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    if (!Number.isFinite(diff)) return 'Unavailable';
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
