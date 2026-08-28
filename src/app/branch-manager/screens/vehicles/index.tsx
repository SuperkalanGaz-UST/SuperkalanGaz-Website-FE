'use client';

import Image from "next/image";
import React, { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Wrench, PenLine, AlertTriangle, ShieldCheck, Truck, History, Plus, RefreshCw, Check, ArrowLeft, ArrowRight } from "lucide-react";
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
    gps_provisioning_status: "unconfigured" | "pending" | "provisioned" | "failed";
    gps_provisioning_error: string | null;
    gps_provisioned_at: string | null;
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

interface RiderRow {
    id: string;
    name: string;
    plate: string;
    status: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

const vehicleSetupSteps = [
    {
        title: "Prepare the SIM",
        description: "Turn off the ST-901, then insert a SIM with mobile data and no PIN lock.",
        image: "/fleet/setup/01-prepare-sim.jpg",
        imageWidth: 1040,
        imageHeight: 390,
        imageAlt: "Cartoon showing a SIM card between a SinoTrack device and a phone with data and PIN checks",
    },
    {
        title: "Find the hardware ID",
        description: "Copy the IMEI or unique ID printed on the physical device label.",
        image: "/fleet/setup/02-find-hardware-id.jpg",
        imageWidth: 1040,
        imageHeight: 410,
        imageAlt: "Cartoon showing a magnifying glass over the identifier label on a SinoTrack device",
    },
    {
        title: "Install the tracker",
        description: "Ask a qualified installer to mount and wire the ST-901 using its manual.",
        image: "/fleet/setup/03-install-tracker.jpg",
        imageWidth: 1040,
        imageHeight: 420,
        imageAlt: "Cartoon showing a qualified installer securing a GPS device beneath a motorcycle seat",
    },
    {
        title: "Connect to Traccar",
        description: "Use the device manual to set your SIM APN and Traccar host on TCP port 5013.",
        image: "/fleet/setup/04-connect-traccar.jpg",
        imageWidth: 1040,
        imageHeight: 420,
        imageAlt: "Cartoon showing a phone configuring a GPS device to send data to Traccar",
    },
    {
        title: "Get the first GPS fix",
        description: "Power on the vehicle outdoors and wait for the GPS and mobile-network signals.",
        image: "/fleet/setup/05-first-gps-fix.jpg",
        imageWidth: 1040,
        imageHeight: 440,
        imageAlt: "Cartoon showing a delivery motorcycle outdoors receiving GPS signals",
    },
    {
        title: "Ready to register",
        description: "Your hardware setup is complete. Continue to enter the vehicle details.",
        image: "/fleet/setup/06-ready-to-register.jpg",
        imageWidth: 1040,
        imageHeight: 440,
        imageAlt: "Cartoon showing a delivery motorcycle and GPS device successfully connected to Traccar",
    },
] as const;

export default function VehicleManagementPage() {
    const [mounted, setMounted] = useState(false);
    const [vehicles, setVehicles] = useState<VehicleRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [registrationOpen, setRegistrationOpen] = useState(false);
    const [registrationStep, setRegistrationStep] = useState(0);
    const [plateNumber, setPlateNumber] = useState("");
    const [hardwareUniqueId, setHardwareUniqueId] = useState("");
    const [initialOdometerKm, setInitialOdometerKm] = useState("0");
    const [assignedRiderId, setAssignedRiderId] = useState("");
    const [riders, setRiders] = useState<RiderRow[]>([]);
    const [ridersLoading, setRidersLoading] = useState(false);
    const [registrationError, setRegistrationError] = useState<string | null>(null);
    const [registering, setRegistering] = useState(false);

    const [updateDialogVehicleId, setUpdateDialogVehicleId] = useState<string | null>(null);
    const [odometerValue, setOdometerValue] = useState("");
    const [fuelValue, setFuelValue] = useState("");
    const [dateValue, setDateValue] = useState(todayIso());
    const [dialogError, setDialogError] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [resettingId, setResettingId] = useState<string | null>(null);
    const [retryingGpsId, setRetryingGpsId] = useState<string | null>(null);

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
    const activeSetupStep = vehicleSetupSteps[Math.min(registrationStep, vehicleSetupSteps.length - 1)];

    const openRegistrationDialog = async () => {
        setRegistrationOpen(true);
        setRegistrationStep(0);
        setRegistrationError(null);
        setRidersLoading(true);
        try {
            const res = await apiFetch('/riders');
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to load riders'));
            setRiders(data.riders as RiderRow[]);
        } catch (err) {
            setRiders([]);
            setRegistrationError(err instanceof Error ? err.message : 'Failed to load riders');
        } finally {
            setRidersLoading(false);
        }
    };

    const closeRegistrationDialog = () => {
        if (registering) return;
        setRegistrationOpen(false);
        setRegistrationStep(0);
        setPlateNumber("");
        setHardwareUniqueId("");
        setInitialOdometerKm("0");
        setAssignedRiderId("");
        setRegistrationError(null);
    };

    const handleRegisterVehicle = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const normalizedPlate = plateNumber.trim().toUpperCase().replace(/\s+/g, ' ');
        const normalizedHardwareId = hardwareUniqueId.trim();
        const odometerKm = Number(initialOdometerKm);

        if (!/^[A-Z0-9]+(?:[ -][A-Z0-9]+)*$/.test(normalizedPlate) || normalizedPlate.length < 2 || normalizedPlate.length > 20) {
            setRegistrationError('Enter a valid plate number using letters, numbers, spaces, or hyphens.');
            return;
        }
        if (!/^[A-Za-z0-9_-]{4,64}$/.test(normalizedHardwareId)) {
            setRegistrationError('Enter the hardware identifier printed on the SinoTrack device.');
            return;
        }
        if (!Number.isInteger(odometerKm) || odometerKm < 0) {
            setRegistrationError('Enter a valid non-negative odometer reading.');
            return;
        }

        setRegistering(true);
        setRegistrationError(null);
        try {
            const res = await apiFetch('/vehicles', {
                method: 'POST',
                body: JSON.stringify({
                    plateNumber: normalizedPlate,
                    hardwareUniqueId: normalizedHardwareId,
                    initialOdometerKm: odometerKm,
                    ...(assignedRiderId ? { assignedRiderId } : {}),
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to register vehicle'));

            const created = data.vehicle as VehicleRow;
            setVehicles(prev => [...prev, created].sort((a, b) => a.plate_number.localeCompare(b.plate_number)));
            if (created.gps_provisioning_status === 'provisioned') {
                toast.success(`${created.plate_number} registered and its GPS device was provisioned.`);
            } else {
                toast.warning(`${created.plate_number} was registered, but GPS provisioning failed. Check that Traccar is reachable.`);
            }
            setRegistrationOpen(false);
            setRegistrationStep(0);
            setPlateNumber("");
            setHardwareUniqueId("");
            setInitialOdometerKm("0");
            setAssignedRiderId("");
        } catch (err) {
            setRegistrationError(err instanceof Error ? err.message : 'Failed to register vehicle');
        } finally {
            setRegistering(false);
        }
    };

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

    const handleRetryGps = async (vehicle: VehicleRow) => {
        setRetryingGpsId(vehicle.id);
        try {
            const res = await apiFetch(`/vehicles/${vehicle.id}/retry-gps-provisioning`, {
                method: 'POST',
            });
            const data = await res.json();
            if (!res.ok) throw new Error(apiErrorMessage(data, 'Failed to retry GPS provisioning'));

            const updated = data.vehicle as VehicleRow;
            setVehicles(prev => prev.map(v => v.id === updated.id ? updated : v));
            if (updated.gps_provisioning_status === 'provisioned') {
                toast.success(`${updated.plate_number} GPS device is now ready.`);
            } else {
                toast.warning('Traccar is still unreachable. The vehicle remains registered.');
            }
        } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Failed to retry GPS provisioning');
        } finally {
            setRetryingGpsId(null);
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
            <div className={styles.toolbar}>
                <div>
                    <div className={styles.toolbarTitle}>Branch Vehicle Roster</div>
                    <div className={styles.toolbarDescription}>Register delivery motorcycles and track their PMS mileage.</div>
                </div>
                <Button variant="primary" onClick={() => void openRegistrationDialog()}>
                    <Plus size={17} /> Register Vehicle
                </Button>
            </div>

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
                        const gpsBadge = vehicle.gps_provisioning_status === 'provisioned'
                            ? { label: 'GPS Ready', variant: 'success' as const }
                            : vehicle.gps_provisioning_status === 'failed'
                                ? { label: 'GPS Failed', variant: 'destructive' as const }
                                : vehicle.gps_provisioning_status === 'pending'
                                    ? { label: 'GPS Pending', variant: 'warning' as const }
                                    : { label: 'GPS Unconfigured', variant: 'secondary' as const };

                        return (
                            <div key={vehicle.id} className={styles.vehicleCard}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.vehicleIdentity}>
                                        <div className={styles.vehicleName}>{vehicle.assigned_rider_name ?? 'Unassigned'}</div>
                                        <div className={styles.vehiclePlate}>{vehicle.plate_number}{vehicle.vehicle_type ? ` · ${vehicle.vehicle_type}` : ''}</div>
                                    </div>
                                    <div className={styles.statusStack}>
                                        <Badge variant={isOverdue ? "destructive" : isWarning ? "warning" : "success"}>
                                            {isOverdue ? "Overdue" : isWarning ? "Due Soon" : "Healthy"}
                                        </Badge>
                                        <Badge
                                            variant={gpsBadge.variant}
                                            title={vehicle.gps_provisioning_error ?? undefined}
                                        >
                                            {gpsBadge.label}
                                        </Badge>
                                    </div>
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
                                    {vehicle.gps_provisioning_status === 'failed' && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            style={{ width: '100%', marginTop: '0.4rem' }}
                                            disabled={retryingGpsId === vehicle.id}
                                            onClick={() => void handleRetryGps(vehicle)}
                                        >
                                            <RefreshCw size={14} style={{ marginRight: '0.3rem' }} />
                                            {retryingGpsId === vehicle.id ? 'Retrying GPS…' : 'Retry GPS Provisioning'}
                                        </Button>
                                    )}
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

            {registrationOpen && (
                <div className={styles.dialogOverlay} role="presentation" onClick={closeRegistrationDialog}>
                    <form className={`${styles.dialogContent} ${styles.registrationDialog}`} onSubmit={(event) => void handleRegisterVehicle(event)} onClick={(event) => event.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="register-vehicle-title">
                        {registrationStep < vehicleSetupSteps.length ? (
                            <>
                                <div className={styles.wizardHeader}>
                                    <h2 id="register-vehicle-title" className={styles.wizardTitle}>Set up your GPS device</h2>
                                    <ol className={styles.wizardProgress} aria-label="Hardware setup progress">
                                        {vehicleSetupSteps.map((step, index) => {
                                            const completed = index < registrationStep;
                                            const active = index === registrationStep;

                                            return (
                                                <li
                                                    key={step.title}
                                                    className={`${styles.progressStep} ${completed ? styles.progressStepCompleted : ''} ${active ? styles.progressStepActive : ''}`}
                                                    aria-current={active ? 'step' : undefined}
                                                    aria-label={`Step ${index + 1}: ${step.title}${completed ? ', completed' : active ? ', current' : ''}`}
                                                >
                                                    {completed ? <Check size={16} strokeWidth={3} aria-hidden="true" /> : index + 1}
                                                </li>
                                            );
                                        })}
                                    </ol>
                                </div>

                                <section className={styles.setupStepContent} aria-live="polite" aria-labelledby="setup-step-title">
                                    <span className={styles.stepEyebrow}>Step {registrationStep + 1} of {vehicleSetupSteps.length}</span>
                                    <div className={styles.setupImageFrame}>
                                        <Image
                                            className={styles.setupImage}
                                            src={activeSetupStep.image}
                                            width={activeSetupStep.imageWidth}
                                            height={activeSetupStep.imageHeight}
                                            sizes="(max-width: 640px) 100vw, 720px"
                                            alt={activeSetupStep.imageAlt}
                                            priority={registrationStep === 0}
                                        />
                                    </div>
                                    <div className={styles.setupCopy}>
                                        <h3 id="setup-step-title" className={styles.setupStepTitle}>{activeSetupStep.title}</h3>
                                        <p className={styles.setupStepDescription}>{activeSetupStep.description}</p>
                                    </div>
                                </section>

                                <div className={styles.wizardFooter}>
                                    {registrationStep === 0 ? (
                                        <Button type="button" variant="ghost" onClick={closeRegistrationDialog}>Cancel</Button>
                                    ) : (
                                        <Button type="button" variant="ghost" onClick={() => setRegistrationStep(step => step - 1)}>
                                            <ArrowLeft size={16} aria-hidden="true" /> Back
                                        </Button>
                                    )}
                                    <Button
                                        type="button"
                                        variant="primary"
                                        onClick={() => setRegistrationStep(step => step + 1)}
                                    >
                                        {registrationStep === vehicleSetupSteps.length - 1 ? 'Enter vehicle details' : 'Next'}
                                        <ArrowRight size={16} aria-hidden="true" />
                                    </Button>
                                </div>
                            </>
                        ) : (
                            <div className={styles.detailsScreen}>
                                <div className={styles.dialogHeader}>
                                    <span className={styles.stepEyebrow}>Vehicle details</span>
                                    <h2 id="register-vehicle-title" className={styles.dialogTitle}>Register Vehicle</h2>
                                    <p className={styles.dialogDescription}>The API will register the vehicle to your branch and provision its SinoTrack ST-901 in Traccar.</p>
                                </div>

                                <div className={styles.formFields}>
                                    <div>
                                        <label className={styles.fieldLabel} htmlFor="vehicle-plate">Plate Number</label>
                                        <Input
                                            id="vehicle-plate"
                                            value={plateNumber}
                                            onChange={(event) => setPlateNumber(event.target.value.toUpperCase())}
                                            placeholder="ABC-1234"
                                            autoComplete="off"
                                            maxLength={20}
                                            autoFocus
                                        />
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel} htmlFor="vehicle-hardware-id">SinoTrack Hardware ID</label>
                                        <Input
                                            id="vehicle-hardware-id"
                                            value={hardwareUniqueId}
                                            onChange={(event) => setHardwareUniqueId(event.target.value)}
                                            placeholder="Device IMEI or unique ID"
                                            autoComplete="off"
                                            maxLength={64}
                                            required
                                        />
                                        <div className={styles.fieldHint}>Enter the identifier copied from the physical ST-901 label.</div>
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel} htmlFor="vehicle-odometer">Current Odometer (km)</label>
                                        <Input
                                            id="vehicle-odometer"
                                            type="number"
                                            value={initialOdometerKm}
                                            onChange={(event) => setInitialOdometerKm(event.target.value)}
                                            min={0}
                                            step={1}
                                        />
                                        <div className={styles.fieldHint}>This becomes the starting PMS baseline.</div>
                                    </div>
                                    <div>
                                        <label className={styles.fieldLabel} htmlFor="vehicle-rider">Assign Rider (optional)</label>
                                        <select
                                            id="vehicle-rider"
                                            className={styles.select}
                                            value={assignedRiderId}
                                            onChange={(event) => setAssignedRiderId(event.target.value)}
                                            disabled={ridersLoading}
                                        >
                                            <option value="">{ridersLoading ? 'Loading riders…' : 'Unassigned'}</option>
                                            {riders.map(rider => (
                                                <option key={rider.id} value={rider.id}>
                                                    {rider.name} · {rider.plate} · {rider.status}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    {registrationError && <div className={styles.fieldError} role="alert">{registrationError}</div>}
                                </div>

                                <div className={styles.dialogFooter}>
                                    <Button type="button" variant="ghost" onClick={() => setRegistrationStep(vehicleSetupSteps.length - 1)} disabled={registering}>
                                        <ArrowLeft size={16} aria-hidden="true" /> Back
                                    </Button>
                                    <Button type="submit" variant="primary" disabled={registering || ridersLoading}>
                                        {registering ? 'Registering…' : 'Register Vehicle'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </form>
                </div>
            )}
        </div>
    );
}
