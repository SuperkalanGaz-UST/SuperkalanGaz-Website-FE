'use client';

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Clock, MapPin, Navigation, ShieldAlert, Truck } from "lucide-react";
import { Badge } from "../../components/Badge";
import styles from "./screen.module.css";
import { apiErrorMessage, apiFetch } from "../../../lib/api";
import {
    assignedBranchesFrom,
    type BranchGeofence,
} from "../../../lib/branchGeofence";
import {
    FLEET_ACTIVITY,
    FLEET_RIDERS,
    positionFleetRiders,
    type FleetRider,
    type FleetRiderStatus,
} from "../../../lib/fleetPresentationData";
import { useAccount } from "../../../contexts/AccountContext";

const FleetMap = dynamic(() => import("./FleetMap"), { ssr: false, loading: () => <div style={{ height: "100%", background: "var(--muted)", borderRadius: "var(--radius-lg)" }} /> });

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
    const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
    const [geofence, setGeofence] = useState<BranchGeofence | null>(null);
    const [geofenceLoading, setGeofenceLoading] = useState(true);
    const [geofenceError, setGeofenceError] = useState<string | null>(null);

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

    const positionedRiders = useMemo(
        () => geofence ? positionFleetRiders(FLEET_RIDERS, geofence) : [],
        [geofence],
    );

    const handleRiderClick = (rider: FleetRider) => {
        setSelectedRiderId(rider.id);
        const positionedRider = positionedRiders.find((candidate) => candidate.id === rider.id);
        if (positionedRider) setMapCenter([positionedRider.lat, positionedRider.lng]);
    };

    const activeRiders = FLEET_RIDERS.filter(r => r.status === "active").length;
    const outsideRiders = FLEET_RIDERS.filter(r => r.status === "outside-geofence").length;
    const outsideRider = FLEET_RIDERS.find(r => r.status === "outside-geofence");

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.statsGrid}>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Total Riders</span><Truck className={styles.statIcon} size={20} /></div><div className={styles.statValue}>{FLEET_RIDERS.length}</div></div>
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
                        {FLEET_RIDERS.map((rider) => (
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
                        ))}
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
                            <thead><tr><th>Time</th><th>Rider</th><th>Event Description</th></tr></thead>
                            <tbody>
                                {FLEET_ACTIVITY.map((log) => (
                                    <tr key={`${log.time}-${log.rider}`}>
                                        <td className={styles.logTime}>{log.time}</td>
                                        <td className={styles.logRider}>{log.rider}</td>
                                        <td className={styles.logEvent}>{log.event}</td>
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
