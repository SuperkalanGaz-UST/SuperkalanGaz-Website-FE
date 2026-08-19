'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Clock, MapPin, Navigation, ShieldAlert, Truck } from "lucide-react";
import { Badge } from "../../components/Badge";
import styles from "./screen.module.css";
import { apiErrorMessage, apiFetch } from "../../../lib/api";
import {
    assignedBranchesFrom,
    type BranchGeofence,
} from "../../../lib/branchGeofence";
import { useAccount } from "../../../contexts/AccountContext";

/** Rider status as returned by the NestJS Fleet API. */
type ApiRiderStatus = 'Available' | 'On Delivery' | 'Maintenance Due' | 'Offline';

interface ApiRiderRow {
    id: string;
    branch_id: string;
    name: string;
    plate: string;
    status: ApiRiderStatus;
    created_at: string;
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

interface PositionedFleetRider extends FleetRider {
    lat: number;
    lng: number;
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

/**
 * Temporary display positions derived from the branch geofence.
 * Replaced by Traccar GPS coordinates when hardware integration is enabled.
 */
function positionFleetRiders(
    riders: FleetRider[],
    geofence: BranchGeofence,
): PositionedFleetRider[] {
    const [latTotal, lngTotal] = geofence.points.reduce(
        ([lat, lng], point) => [lat + point[0], lng + point[1]],
        [0, 0],
    );
    const center: [number, number] = [
        latTotal / geofence.points.length,
        lngTotal / geofence.points.length,
    ];

    return riders.map((rider, index) => {
        const vertex = geofence.points[index % geofence.points.length];
        const factor = rider.status === 'outside-geofence' ? 1.18 : 0.22 + (index % 3) * 0.08;
        return {
            ...rider,
            lat: center[0] + (vertex[0] - center[0]) * factor,
            lng: center[1] + (vertex[1] - center[1]) * factor,
        };
    });
}

export default function FleetPage() {
    const account = useAccount();
    const branchName = account.branches[0];
    const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
    const [geofence, setGeofence] = useState<BranchGeofence | null>(null);
    const [geofenceLoading, setGeofenceLoading] = useState(true);
    const [geofenceError, setGeofenceError] = useState<string | null>(null);
    const [riders, setRiders] = useState<FleetRider[]>([]);
    const [ridersLoading, setRidersLoading] = useState(true);
    const [ridersError, setRidersError] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();

        async function loadGeofence() {
            setGeofenceLoading(true);
            setGeofenceError(null);
            try {
                const response = await apiFetch('/branches/assigned', { signal: controller.signal });
                const data: unknown = await response.json().catch(() => null);
                if (!response.ok) {
                    throw new Error(apiErrorMessage(data, 'Could not load the assigned geofence.'));
                }
                const assignedBranch = assignedBranchesFrom(data).find(
                    (branch) => branch.name === branchName,
                );
                setGeofence(assignedBranch?.geofence ?? null);
                if (!assignedBranch) {
                    setGeofenceError('The signed-in account has no active assigned branch.');
                }
            } catch (error) {
                if (controller.signal.aborted) return;
                setGeofence(null);
                setGeofenceError(error instanceof Error ? error.message : 'Could not reach the server.');
            } finally {
                if (!controller.signal.aborted) setGeofenceLoading(false);
            }
        }

        void loadGeofence();
        return () => controller.abort();
    }, [branchName]);

    const loadRiders = useCallback(async () => {
        setRidersLoading(true);
        setRidersError(null);
        try {
            const [ridersRes, srRes] = await Promise.all([
                apiFetch('/riders'),
                apiFetch('/service-requests'),
            ]);
            const ridersData = await ridersRes.json();
            const srData = await srRes.json();

            if (!ridersRes.ok) throw new Error(apiErrorMessage(ridersData, 'Failed to load riders'));

            const apiRiders = (ridersData.riders ?? []) as ApiRiderRow[];
            const serviceRequests = (srData.serviceRequests ?? []) as SRRow[];

            // Build a map of rider_id → current order info for Dispatched/En Route requests.
            const activeOrders = new Map<string, string>();
            for (const sr of serviceRequests) {
                if (sr.rider_id && (sr.status === 'Dispatched' || sr.status === 'En Route')) {
                    activeOrders.set(sr.rider_id, `${sr.cylinder_size} delivery`);
                }
            }

            const mapped: FleetRider[] = apiRiders.map((r) => ({
                id: r.id,
                name: r.name,
                plateNumber: r.plate,
                status: toFleetStatus(r.status),
                currentOrder: activeOrders.get(r.id) ?? null,
                lastUpdated: formatRelativeTime(r.created_at),
            }));
            setRiders(mapped);
        } catch (err) {
            setRidersError(err instanceof Error ? err.message : 'Failed to load riders');
            setRiders([]);
        } finally {
            setRidersLoading(false);
        }
    }, []);

    useEffect(() => { void loadRiders(); }, [loadRiders]);

    const positionedRiders = useMemo(
        () => geofence ? positionFleetRiders(riders, geofence) : [],
        [geofence, riders],
    );

    const handleRiderClick = (rider: FleetRider) => {
        setSelectedRiderId(rider.id);
        const positionedRider = positionedRiders.find((candidate) => candidate.id === rider.id);
        if (positionedRider) setMapCenter([positionedRider.lat, positionedRider.lng]);
    };

    const activeRiders = riders.filter(r => r.status === "active").length;
    const outsideRiders = riders.filter(r => r.status === "outside-geofence").length;
    const outsideRider = riders.find(r => r.status === "outside-geofence");

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.statsGrid}>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Total Riders</span><Truck className={styles.statIcon} size={20} /></div><div className={styles.statValue}>{riders.length}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Active Now</span><Navigation className={styles.statIcon} style={{ color: "var(--success)" }} size={20} /></div><div className={styles.statValue}>{activeRiders}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Outside Geofence</span><ShieldAlert className={styles.statIcon} style={{ color: "var(--warning)" }} size={20} /></div><div className={styles.statValue}>{outsideRiders}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Past Curfew</span><Clock className={styles.statIcon} style={{ color: "var(--muted-foreground)" }} size={20} /></div><div className={styles.statValue}>0</div></div>
            </div>

            <div className={styles.mainLayout}>
                <div className={styles.mapPanel}>
                    <div className={styles.panelHeader}>
                        <h2 className={styles.panelTitle}>Live GPS Tracking</h2>
                        <Badge variant="outline" className={styles.liveIndicator}><span className={styles.pulseDot}></span>Live Updates</Badge>
                    </div>
                    <div className={styles.mapContainer}>
                        {geofenceLoading ? (
                            <div className={styles.mapState}>Preparing branch map…</div>
                        ) : geofenceError ? (
                            <div className={`${styles.mapState} ${styles.mapStateError}`}>{geofenceError}</div>
                        ) : geofence ? (
                            <FleetMap riders={positionedRiders} geofence={geofence} mapCenter={mapCenter} />
                        ) : (
                            <div className={styles.mapState}>No geofence has been assigned to {branchName}.</div>
                        )}
                    </div>
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
                                        <span className={styles.riderTime}><Clock size={14} />{rider.lastUpdated}</span>
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
                                <div className={styles.allClear}>No active critical alerts.</div>
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
    const minutes = Math.floor(diff / 60_000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hr ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
}
