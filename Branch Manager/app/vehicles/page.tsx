'use client';

import React, { useState, useMemo } from "react";
import { Wrench, Settings, PenLine, AlertTriangle, ShieldCheck, Truck } from "lucide-react";
import { Badge } from "@/components/Badge";
import { Button } from "@/components/Button";
import { Progress } from "@/components/Progress";
import { Input } from "@/components/Input";
import styles from "./page.module.css";

const PMS_INTERVAL = 3000;

interface Vehicle {
  id: string;
  name: string;
  plate: string;
  status: "Active" | "Maintenance" | "Idle";
  currentOdometer: number;
  lastPmsOdometer: number;
}

const INITIAL_VEHICLES: Vehicle[] = [
  { id: "v1", name: "Honda Click 125i", plate: "NCD-1234", status: "Active", currentOdometer: 14500, lastPmsOdometer: 12000 },
  { id: "v2", name: "Yamaha Mio i125", plate: "XYZ-9876", status: "Active", currentOdometer: 8900, lastPmsOdometer: 6000 },
  { id: "v3", name: "Honda Beat", plate: "ABC-1122", status: "Active", currentOdometer: 21500, lastPmsOdometer: 21000 },
  { id: "v4", name: "Suzuki Skydrive", plate: "QWE-5544", status: "Idle", currentOdometer: 35600, lastPmsOdometer: 32700 }, // Overdue!
  { id: "v5", name: "Yamaha Aerox", plate: "PLM-3321", status: "Maintenance", currentOdometer: 18000, lastPmsOdometer: 15000 },
];

export default function VehicleManagementPage() {
  const [mounted, setMounted] = React.useState(false);
  const [vehicles, setVehicles] = useState<Vehicle[]>(INITIAL_VEHICLES);
  const [updateDialogOpen, setUpdateDialogOpen] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [newOdometerValue, setNewOdometerValue] = useState<string>("");

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const totalVehicles = vehicles.length;
  const overdueVehicles = vehicles.filter(v => (v.currentOdometer - v.lastPmsOdometer) >= PMS_INTERVAL).length;
  const healthyVehicles = vehicles.filter(v => (v.currentOdometer - v.lastPmsOdometer) < PMS_INTERVAL * 0.8).length;

  if (!mounted) {
    return <div style={{ minHeight: "100vh", backgroundColor: "var(--background)" }} />;
  }

  const handleOpenUpdateDialog = (id: string, currentVal: number) => {
    setSelectedVehicleId(id);
    setNewOdometerValue(currentVal.toString());
    setUpdateDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setUpdateDialogOpen(false);
    setSelectedVehicleId(null);
    setNewOdometerValue("");
  };

  const handleSaveOdometer = () => {
    if (!selectedVehicleId) return;
    const newVal = parseInt(newOdometerValue, 10);
    if (isNaN(newVal)) return;

    setVehicles(prev => prev.map(v => {
      if (v.id === selectedVehicleId) {
        // Prevent setting a lower value than current
        const updatedOdo = Math.max(v.currentOdometer, newVal);
        return { ...v, currentOdometer: updatedOdo };
      }
      return v;
    }));
    handleCloseDialog();
  };

  const handleMarkPmsCompleted = (id: string) => {
    if (confirm("Are you sure you want to log a PMS completion for this vehicle? This will reset the PMS counter.")) {
        setVehicles(prev => prev.map(v => {
            if (v.id === id) {
                return { ...v, lastPmsOdometer: v.currentOdometer, status: "Active" };
            }
            return v;
        }));
    }
  };

  return (
    <div className={styles.pageWrapper}>
      <header className={styles.header}>
        <h1 className={styles.pageTitle}>Vehicle Management</h1>
        <p className={styles.pageDescription}>Monitor motorcycle fleet odometers and Preventive Maintenance Schedules (PMS).</p>
      </header>

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

      <section className={styles.vehiclesGrid}>
        {vehicles.map(vehicle => {
          const sinceLastPms = vehicle.currentOdometer - vehicle.lastPmsOdometer;
          const progressPercent = Math.min((sinceLastPms / PMS_INTERVAL) * 100, 100);
          const isOverdue = sinceLastPms >= PMS_INTERVAL;
          const isWarning = sinceLastPms >= PMS_INTERVAL * 0.8 && !isOverdue;
          
          let progressColor = "var(--primary)";
          if (isOverdue) progressColor = "var(--error)";
          else if (isWarning) progressColor = "var(--warning)";

          return (
            <div key={vehicle.id} className={styles.vehicleCard}>
              <div className={styles.cardHeader}>
                <div className={styles.vehicleIdentity}>
                  <div className={styles.vehicleName}>{vehicle.name}</div>
                  <div className={styles.vehiclePlate}>{vehicle.plate}</div>
                </div>
                <Badge variant={isOverdue ? "destructive" : isWarning ? "warning" : "success"}>
                  {isOverdue ? "Overdue" : isWarning ? "Due Soon" : "Healthy"}
                </Badge>
              </div>

              <div className={styles.metricsRow}>
                <div className={styles.metricBox}>
                  <div className={styles.metricLabel}>Current Odometer</div>
                  <div className={styles.metricValueWrapper}>
                    <span className={styles.metricValue}>{vehicle.currentOdometer.toLocaleString()}</span>
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
                  <span className={styles.progressText}>PMS Interval: {PMS_INTERVAL.toLocaleString()} km</span>
                  <span className={styles.progressPercentage}>{Math.round(progressPercent)}%</span>
                </div>
                <Progress value={progressPercent} style={{ backgroundColor: "rgba(0,0,0,0.05)" }} className={isOverdue ? "progress-error" : isWarning ? "progress-warning" : ""} />
                {/* We can dynamically override the progress bar color using an inline style block if we wanted, but let's stick to standard classes or just standard Progress */}
                 {/* As Progress component only has primary color by default, we can wrap it or just use it. */}
              </div>

              <div className={styles.actionRow}>
                <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                  <Button variant="outline" size="sm" style={{ flex: 1 }} onClick={() => handleMarkPmsCompleted(vehicle.id)}>
                    <Wrench size={16} style={{ marginRight: '0.3rem' }} /> Reset PMS
                  </Button>
                  <Button variant="primary" size="sm" style={{ flex: 1 }} onClick={() => handleOpenUpdateDialog(vehicle.id, vehicle.currentOdometer)}>
                    <PenLine size={16} style={{ marginRight: '0.3rem' }} /> Update Odo
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </section>

      {/* Update Dialog Modal */}
      {updateDialogOpen && (
        <div className={styles.dialogOverlay}>
          <div className={styles.dialogContent}>
            <div className={styles.dialogHeader}>
              <h2 className={styles.dialogTitle}>Update Odometer</h2>
              <p className={styles.dialogDescription}>Manually record the latest odometer reading. This will automatically update the distance since the last PMS.</p>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--foreground)' }}>New Reading (km)</label>
              <Input 
                type="number" 
                value={newOdometerValue} 
                onChange={(e) => setNewOdometerValue(e.target.value)} 
                autoFocus 
                min={vehicles.find(v => v.id === selectedVehicleId)?.currentOdometer || 0}
              />
            </div>

            <div className={styles.dialogFooter}>
              <Button variant="ghost" onClick={handleCloseDialog}>Cancel</Button>
              <Button variant="primary" onClick={handleSaveOdometer}>Save Record</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
