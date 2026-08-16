'use client';

import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Wrench, PenLine, AlertTriangle, ShieldCheck, Truck, History } from "lucide-react";
import { Badge } from "../../components/Badge";
import { Button } from "../../components/Button";
import { Progress } from "../../components/Progress";
import { Input } from "../../components/Input";
import { apiFetch, apiErrorMessage } from "../../../lib/api";
import styles from "./screen.module.css";

/** A vehicle row from GET /vehicles (story BM-US-09). */
interface VehicleRow {
    id: string;
    branch_id: string;
    plate_number: string;
    vehicle_type: string | null;
    assigned_rider_id: string | null;
    assigned_rider_name: string | null;
    status: "active" | "maintenance" | "inactive";
    current_odometer_km: number;
    last_pms_odometer_km: number;
    km_since_last_pms: number;
    maintenance_threshold_km: number;
    updated_at: string;
}

/** A maintenance log entry from GET /vehicles/:id. */
interface MaintenanceLogRow {
    id: string;
    vehicle_id: string;
    odometer_km: number;
    fuel_liters: number | null;
    logged_by: string;
    logged_at: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function VehicleManagementPage() {
    const [mounted, setMounted] = useState(false);
    const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [updateDialogVehicleId, setUpdateDialogVehicleId] = useState<string | null>(null);
    const [odometerValue, setOdometerValue] = useState("");
    const [fuelValue, setFuelValue] = useState("");
    const [dateValue, setDateValue] = useState(todayIso());
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [resettingId, setResettingId] = useState<string | null>(null);

    const [historyVehicleId, setHistoryVehicleId] = useState<string | null>(null);
    const [historyLogs, setHistoryLogs] = useState<MaintenanceLogRow[]>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    useEffect(() => { setMounted(true); }, []);

    const loadVehicles = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await apiFetch('/vehicles');
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load vehicles'));
            setVehicles(data.vehicles as VehicleRow[]);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load vehicles');
            setVehicles([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { void loadVehicles(); }, [loadVehicles]);

    if (!mounted) {
        return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
    }

    const totalVehicles = vehicles.length;
    const overdueVehicles = vehicles.filter(v => v.status === "maintenance").length;
    const healthyVehicles = vehicles.filter(v => v.status !== "maintenance" && v.km_since_last_pms < v.maintenance_threshold_km * 0.8).length;

    const openUpdateDialog = (vehicle: VehicleRow) => {
        setUpdateDialogVehicleId(vehicle.id);
        setOdometerValue(vehicle.current_odometer_km.toString());
        setFuelValue("");
        setDateValue(todayIso());
        setDialogError(null);
    };

    const closeUpdateDialog = () => {
        setUpdateDialogVehicleId(null);
        setDialogError(null);
    };

    const handleSaveOdometer = async () => {
        if (!updateDialogVehicleId) return;
        const odometerKm = parseInt(odometerValue, 10);
        if (isNaN(odometerKm)) { setDialogError('Enter a valid odometer reading'); return; }
        const fuelLiters = fuelValue.trim() ? parseInt(fuelValue, 10) : undefined;
        if (fuelValue.trim() && isNaN(fuelLiters as number)) { setDialogError('Enter a valid fuel amount'); return; }

        setSaving(true);
        setDialogError(null);
        try {
            const res = await apiFetch(`/vehicles/${updateDialogVehicleId}/mileage`, {
                method: 'POST',
                body: JSON.stringify({ odometerKm, fuelLiters, loggedAt: dateValue || undefined }),
            });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) {
                    toast.error(apiErrorMessage(data, 'A newer reading was already recorded'));
                    closeUpdateDialog();
                    await loadVehicles();
                    return;
                }
                setDialogError(apiErrorMessage(data, 'Failed to save reading'));
                return;
            }
            const updated = data.vehicle as VehicleRow;
            setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
            if (updated.status === 'maintenance') {
                toast.warning(`${updated.plate_number} reached its PMS interval and is flagged for maintenance.`);
            } else {
                toast.success('Odometer reading logged.');
            }
            closeUpdateDialog();
        } catch (err) {
            setDialogError(err instanceof Error ? err.message : 'Failed to save reading');
        } finally {
            setSaving(false);
        }
    };

    const handleResetPms = async (vehicle: VehicleRow) => {
        setResettingId(vehicle.id);
        try {
            const res = await apiFetch(`/vehicles/${vehicle.id}/reset-pms`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) {
                if (res.status === 409) {
                    toast.error('This vehicle is not currently flagged for maintenance.');
                    await loadVehicles();
                    return;
                }
                toast.error(apiErrorMessage(data, 'Failed to reset PMS'));
                return;
            }
            const updated = data.vehicle as VehicleRow;
            setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
            toast.success(`${updated.plate_number} marked serviced — PMS counter reset.`);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to reset PMS');
        } finally {
            setResettingId(null);
        }
    };

    const toggleHistory = async (vehicleId: string) => {
        if (historyVehicleId === vehicleId) { setHistoryVehicleId(null); return; }
        setHistoryVehicleId(vehicleId);
        setHistoryLoading(true);
        try {
            const res = await apiFetch(`/vehicles/${vehicleId}`);
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load history'));
            setHistoryLogs(data.maintenanceLogs as MaintenanceLogRow[]);
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to load history');
            setHistoryLogs([]);
        } finally {
            setHistoryLoading(false);
        }
    };

    return (
        <div className={styles.pageWrapper}>
            <section className={styles.statsGrid}>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}><span className={styles.statLabel}>Total Fleet</span><Truck className={styles.statIcon} size={20} /></div>
                    <div className={styles.statValue}>{totalVehicles}</div>
                </div>
                <div className={styles.statCard}>
                    <div className={styles.statHeader}><span className={styles.statLabel}>Healthy Vehicles</span><ShieldCheck className={styles.statIcon} style={{ color: "var(--success)" }} size={20} /></div>
                    <div className={styles.statValue} style={{ color: "var(--success)" }}>{healthyVehicles}</div>
                </div>
                <div className={styles.statCard} style={overdueVehicles > 0 ? { borderColor: "var(--error)" } : {}}>
                    <div className={styles.statHeader}><span className={styles.statLabel}>PMS Due / Overdue</span><AlertTriangle className={styles.statIcon} style={{ color: "var(--error)" }} size={20} /></div>
                    <div className={styles.statValue} style={{ color: "var(--error)" }}>{overdueVehicles}</div>
                </div>
            </section>

            {loading ? (
                <div className={styles.emptyState}>Loading vehicles…</div>
            ) : error ? (
                <div className={styles.emptyState}>
                    <div style={{ marginBottom: '0.75rem' }}>{error}</div>
                    <Button variant="outline" size="sm" onClick={() => void loadVehicles()}>Try again</Button>
                </div>
            ) : vehicles.length === 0 ? (
                <div className={styles.emptyState}>No vehicles on this branch&apos;s roster yet.</div>
            ) : (
                <section className={styles.vehiclesGrid}>
                    {vehicles.map(vehicle => {
                        const sinceLastPms = vehicle.km_since_last_pms;
                        const threshold = vehicle.maintenance_threshold_km;
                        const progressPercent = Math.min((sinceLastPms / threshold) * 100, 100);
                        const isOverdue = vehicle.status === "maintenance";
                        const isWarning = !isOverdue && sinceLastPms >= threshold * 0.8;

                        return (
                            <div key={vehicle.id} className={styles.vehicleCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.vehicleIdentity}>
                                        <div className={styles.vehicleName}>{vehicle.assigned_rider_name ?? 'Unassigned'}</div>
                                        <div className={styles.vehiclePlate}>{vehicle.plate_number}{vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ''}</div>
                                    </div>
                                    <Badge variant={isOverdue ? "destructive" : isWarning ? "warning" : "success"}>
                                        {isOverdue ? "Overdue" : isWarning ? "Due Soon" : "Healthy"}
                                    </Badge>
                                </div>

                                <div className={styles.metricsRow}>
                                    <div className={styles.metricBox}>
                                        <div className={styles.metricLabel}>Current Odometer</div>
                                        <div className={styles.metricValueWrapper}>
                                            <span className={styles.metricValue}>{vehicle.current_odometer_km.toLocaleString()}</span>
                                            <span className={styles.metricUnit}>km</span>
                                        </div>
                                    </div>
                                    <div className={styles.metricBox}>
                                        <div className={styles.metricLabel}>Since Last PMS</div>
                                        <div className={styles.metricValueWrapper}>
                                            <span className={styles.metricValue} style={{ color: isOverdue ? "var(--error)" : isWarning ? "var(--warning)" : "inherit" }}>
                                                {sinceLastPms.toLocaleString()}
                                            </span>
                                            <span className={styles.metricUnit}>km</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.progressSection}>
                                    <div className={styles.progressHeader}>
                                        <span className={styles.progressText}>PMS Interval: {threshold.toLocaleString()} km</span>
                                        <span className={styles.progressPercentage}>{Math.round(progressPercent)}%</span>
                                    </div>
                                    <Progress value={progressPercent} style={{ backgroundColor: "rgba(0,0,0,0.05)" }} className={isOverdue ? "progress-error" : isWarning ? "progress-warning" : ""} />
                                </div>

                                <div className={styles.actionRow}>
                                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            style={{ flex: 1 }}
                                            disabled={!isOverdue || resettingId === vehicle.id}
                                            onClick={() => void handleResetPms(vehicle)}
                                        >
                                            <Wrench size={16} style={{ marginRight: '0.3rem' }} /> {resettingId === vehicle.id ? 'Resetting…' : 'Reset PMS'}
                                        </Button>
                                        <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => openUpdateDialog(vehicle)}>
                                            <PenLine size={16} style={{ marginRight: '0.3rem' }} /> Update Odo
                                        </Button>
                                    </div>
                                    <Button variant="ghost" size="sm" style={{ width: '100%', marginTop: '0.4rem' }} onClick={() => void toggleHistory(vehicle.id)}>
                                        <History size={14} style={{ marginRight: '0.3rem' }} /> {historyVehicleId === vehicle.id ? 'Hide History' : 'View History'}
                                    </Button>
                                    {historyVehicleId === vehicle.id && (
                                        <div className={styles.historyPanel}>
                                            {historyLoading ? (
                                                <div className={styles.historyEmpty}>Loading…</div>
                                            ) : historyLogs.length === 0 ? (
                                                <div className={styles.historyEmpty}>No mileage entries logged yet.</div>
                                            ) : (
                                                historyLogs.map(log => (
                                                    <div key={log.id} className={styles.historyRow}>
                                                        <span>{new Date(log.logged_at).toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' })}</span>
                                                        <span>{log.odometer_km.toLocaleString()} km</span>
                                                        <span>{log.fuel_liters != null ? `${log.fuel_liters} L` : '—'}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </section>
            )}

            {updateDialogVehicleId && (
                <div className={styles.dialogOverlay}>
                    <div className={styles.dialogContent}>
                        <div className={styles.dialogHeader}>
                            <h2 className={styles.dialogTitle}>Update Odometer</h2>
                            <p className={styles.dialogDescription}>Log the latest odometer reading and, optionally, fuel added. This updates the distance since the last PMS.</p>
                        </div>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)', display: 'block', marginBottom: '0.35rem' }}>New Reading (km)</label>
                                <Input
                                    type="number"
                                    value={odometerValue}
                                    onChange={(e) => setOdometerValue(e.target.value)}
                                    autoFocus
                                    min={vehicles.find(v => v.id === updateDialogVehicleId)?.current_odometer_km ?? 0}
                                />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)', display: 'block', marginBottom: '0.35rem' }}>Fuel Added (L) — optional</label>
                                <Input type="number" value={fuelValue} onChange={(e) => setFuelValue(e.target.value)} min={0} />
                            </div>
                            <div>
                                <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)', display: 'block', marginBottom: '0.35rem' }}>Date</label>
                                <Input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} max={todayIso()} />
                            </div>
                            {dialogError && <div className={styles.fieldError}>{dialogError}</div>}
                        </div>

                        <div className={styles.dialogFooter}>
                            <Button variant="ghost" onClick={closeUpdateDialog} disabled={saving}>Cancel</Button>
                            <Button variant="primary" onClick={() => void handleSaveOdometer()} disabled={saving}>
                                {saving ? 'Saving…' : 'Save Record'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
