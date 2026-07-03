'use client';

import React, { useState } from "react";
import dynamic from "next/dynamic";
import { AlertCircle, Clock, MapPin, Navigation, ShieldAlert, Truck } from "lucide-react";
import { Badge } from "@/components/Badge";
import styles from "./page.module.css";
import type { Rider, RiderStatus } from "./types";

const FleetMap = dynamic(() => import("./FleetMap"), { ssr: false, loading: () => <div style={{ height: "100%", background: "var(--muted)", borderRadius: "var(--radius-lg)" }} /> });

const MOCK_RIDERS: Rider[] = [
    { id: "1", name: "Juan Dela Cruz", plate: "NCD-1234", status: "active", lat: 14.555, lng: 121.021, currentOrder: "#1045", lastUpdated: "Just now" },
    { id: "2", name: "Pedro Santos", plate: "XYZ-9876", status: "active", lat: 14.551, lng: 121.018, currentOrder: "#1046", lastUpdated: "2 min ago" },
    { id: "3", name: "Miguel Reyes", plate: "ABC-1122", status: "idle", lat: 14.558, lng: 121.025, currentOrder: null, lastUpdated: "15 min ago" },
    { id: "4", name: "Carlo Bautista", plate: "QWE-5544", status: "outside", lat: 14.540, lng: 121.010, currentOrder: "#1043", lastUpdated: "5 min ago" },
    { id: "5", name: "Luis Gonzales", plate: "PLM-3321", status: "offline", lat: 14.553, lng: 121.020, currentOrder: null, lastUpdated: "2 hours ago" },
    { id: "6", name: "Ramon Villanueva", plate: "VBN-6677", status: "offline", lat: 14.553, lng: 121.021, currentOrder: null, lastUpdated: "3 hours ago" },
];

const MOCK_LOGS = [
    { id: "l1", time: "09:45 AM", rider: "Carlo Bautista", event: "Exited geofence perimeter" },
    { id: "l2", time: "09:30 AM", rider: "Juan Dela Cruz", event: "Delivered Order #1042" },
    { id: "l3", time: "09:15 AM", rider: "Pedro Santos", event: "Left store for delivery" },
    { id: "l4", time: "08:00 AM", rider: "Miguel Reyes", event: "Shift started, idle at store" },
];

const getStatusBadgeVariant = (status: RiderStatus) => {
    switch (status) {
        case "active": return "success" as const;
        case "outside": return "destructive" as const;
        case "idle": return "warning" as const;
        default: return "secondary" as const;
    }
};

const formatStatusText = (status: RiderStatus) => {
    switch (status) {
        case "active": return "Active";
        case "outside": return "Outside Zone";
        case "idle": return "Idle";
        default: return "Offline";
    }
};

export default function FleetPage() {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    const [selectedRiderId, setSelectedRiderId] = useState<string | null>(null);
    const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    const handleRiderClick = (rider: Rider) => {
        setSelectedRiderId(rider.id);
        setMapCenter([rider.lat, rider.lng]);
    };

    const activeRiders = MOCK_RIDERS.filter(r => r.status === "active" || r.status === "outside").length;
    const outsideRiders = MOCK_RIDERS.filter(r => r.status === "outside").length;

    return (
        <div className={styles.pageWrapper}>
            <div className={styles.header}>
                <h1 className={styles.pageTitle}>Fleet Management</h1>
                <p className={styles.pageDescription}>Real-time tracking and logistics overview</p>
            </div>

            <div className={styles.statsGrid}>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Total Riders</span><Truck className={styles.statIcon} size={20} /></div><div className={styles.statValue}>{MOCK_RIDERS.length}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Active Now</span><Navigation className={styles.statIcon} style={{ color: "var(--success)" }} size={20} /></div><div className={styles.statValue}>{activeRiders}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Outside Geofence</span><ShieldAlert className={styles.statIcon} style={{ color: "var(--error)" }} size={20} /></div><div className={styles.statValue}>{outsideRiders}</div></div>
                <div className={styles.statCard}><div className={styles.statHeader}><span className={styles.statLabel}>Past Curfew</span><Clock className={styles.statIcon} style={{ color: "var(--muted-foreground)" }} size={20} /></div><div className={styles.statValue}>0</div></div>
            </div>

            <div className={styles.mainLayout}>
                <div className={styles.mapPanel}>
                    <div className={styles.panelHeader}>
                        <h2 className={styles.panelTitle}>Live Tracking</h2>
                        <Badge variant="outline" className={styles.liveIndicator}><span className={styles.pulseDot}></span>Live Updates</Badge>
                    </div>
                    <div className={styles.mapContainer}>
                        <FleetMap riders={MOCK_RIDERS} mapCenter={mapCenter} />
                    </div>
                </div>

                <div className={styles.listPanel}>
                    <div className={styles.panelHeader}><h2 className={styles.panelTitle}>Fleet Roster</h2></div>
                    <div className={styles.riderList}>
                        {MOCK_RIDERS.map((rider) => (
                            <button key={rider.id} className={`${styles.riderCard} ${selectedRiderId === rider.id ? styles.riderCardSelected : ""}`} onClick={() => handleRiderClick(rider)} type="button">
                                <div className={styles.riderCardHeader}>
                                    <div className={styles.riderIdentity}>
                                        <span className={styles.riderName}>{rider.name}</span>
                                        <span className={styles.riderPlate}>{rider.plate}</span>
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
                                {rider.status === "outside" && (
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
                                <div className={styles.operatingHoursTime}>6:00 AM – 8:00 PM</div>
                            </div>
                        </div>
                        <div className={styles.alertList}>
                            {outsideRiders > 0 ? (
                                <div className={styles.criticalAlert}>
                                    <ShieldAlert size={18} className={styles.criticalAlertIcon} />
                                    <div>
                                        <div className={styles.criticalAlertTitle}>Geofence Breach Detected</div>
                                        <div className={styles.criticalAlertDesc}>Carlo Bautista (QWE-5544) has exited the standard delivery zone.</div>
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
                                {MOCK_LOGS.map((log) => (
                                    <tr key={log.id}>
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
