import styles from './VehicleMileageSummary.module.css';

export interface VehicleMileageSummaryData {
  status: 'active' | 'maintenance' | 'inactive';
  current_odometer_km: number;
  km_since_last_pms: number;
  maintenance_threshold_km: number;
  gps_provisioning_status: 'unconfigured' | 'pending' | 'provisioned' | 'failed';
  gps_mileage?: {
    status: 'waiting' | 'synced' | 'unavailable' | 'counter-reset' | 'stale' | 'disabled';
    position_at: string | null;
    pending_m?: number;
  } | null;
}

export function isVehicleServiceDue(vehicle: VehicleMileageSummaryData) {
  return vehicle.status === 'maintenance' || vehicle.km_since_last_pms >= vehicle.maintenance_threshold_km;
}

const number = new Intl.NumberFormat('en-PH');
const dateTime = new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila',
});

function trackerMessage(vehicle: VehicleMileageSummaryData) {
  switch (vehicle.gps_provisioning_status) {
    case 'unconfigured': return { label: 'Staff enter the distance' };
    case 'pending': return { label: 'Setting up the tracker' };
    case 'failed': return { label: 'Tracker setup needs attention' };
  }

  switch (vehicle.gps_mileage?.status) {
    case 'synced': {
      const metres = vehicle.gps_mileage.pending_m ?? 0;
      return {
        detail: metres > 0 ? `${number.format(metres)} m already counted toward the next kilometre.` : 'The total goes up by 1 km at a time.',
      };
    }
    case 'waiting': return { label: 'Waiting for a distance update', detail: 'Showing the last saved distance.' };
    case 'unavailable': return { label: 'Couldn’t get a distance update', detail: 'Showing the last saved distance.' };
    case 'stale': return { label: 'Distance updates are delayed', detail: 'Showing the last saved distance.' };
    case 'counter-reset': return { label: 'The tracker started counting again', detail: 'The saved total stays the same.' };
    case 'disabled': return { label: 'Staff enter the distance', detail: 'Automatic updates are off.' };
    default: return { label: 'Last distance update is unknown' };
  }
}

export function VehicleMileageSummary({ vehicle }: { vehicle: VehicleMileageSummaryData }) {
  const total = vehicle.current_odometer_km;
  const sinceService = vehicle.km_since_last_pms;
  const interval = vehicle.maintenance_threshold_km;
  const remaining = interval - sinceService;
  const due = isVehicleServiceDue(vehicle);
  const dueSoon = !due && sinceService >= interval * 0.8;
  const serviceLabel = remaining < 0 ? 'Service overdue' : due ? 'Service due' : dueSoon ? 'Service due soon' : 'Next service';
  const serviceDetail = remaining < 0
    ? `${number.format(-remaining)} km past due`
    : `At ${number.format(total + remaining)} km`;
  const tracker = trackerMessage(vehicle);
  const positionAt = vehicle.gps_mileage?.position_at;
  const date = positionAt ? new Date(positionAt) : null;

  return (
    <div className={styles.summary}>
      <dl className={styles.metrics}>
        <div className={styles.metric}>
          <dt>Total distance</dt>
          <dd className={styles.value}>{number.format(total)} km</dd>
        </div>
        <div className={styles.metric} data-service={due ? 'due' : dueSoon ? 'soon' : undefined}>
          <dt>{serviceLabel}</dt>
          {due ? null : <dd className={styles.value}>{number.format(remaining)} km left</dd>}
          <dd className={due ? styles.value : styles.detail}>{serviceDetail}</dd>
        </div>
      </dl>
      <div className={styles.gps}>
        {tracker.label ? <p><strong>{tracker.label}</strong></p> : null}
        {positionAt && date && Number.isFinite(date.getTime()) ? (
          <p><strong>Last distance update</strong> · <time dateTime={positionAt}>{dateTime.format(date)}</time></p>
        ) : null}
        {tracker.detail ? <p>{tracker.detail}</p> : null}
      </div>
    </div>
  );
}
