export interface DeliveryRiderLocation {
  latitude: number;
  longitude: number;
  accuracyM: number | null;
  capturedAt: string;
  receivedAt: string;
  source: 'phone';
}

export interface DispatchRider {
  id: string;
  name: string;
  plate: string;
  status: 'Available' | 'On Delivery' | 'Maintenance Due' | 'Offline';
  operational_location?: DeliveryRiderLocation | null;
  assigned_vehicle?: { id: string; plate_number: string; status: 'active' | 'maintenance' | 'inactive' } | null;
}

/** Phone samples are dispatch information, never vehicle geofence/PMS data. */
export function dispatchLocation(rider: DispatchRider): DeliveryRiderLocation | null {
  const location = rider.operational_location;
  if (!['Available', 'On Delivery'].includes(rider.status) || !location || location.source !== 'phone') return null;
  if (!Number.isFinite(location.latitude) || Math.abs(location.latitude) > 90
    || !Number.isFinite(location.longitude) || Math.abs(location.longitude) > 180
    || !Number.isFinite(Date.parse(location.capturedAt)) || !Number.isFinite(Date.parse(location.receivedAt))) return null;
  return location;
}

export function locationAgeMs(location: DeliveryRiderLocation, now = Date.now()): number {
  return Math.max(0, now - Math.min(Date.parse(location.capturedAt), Date.parse(location.receivedAt)));
}

export function operationalLocationLabel(rider: DispatchRider, now = Date.now()): string {
  const location = dispatchLocation(rider);
  if (!location) return 'GPS unavailable';
  const ageMinutes = Math.floor(locationAgeMs(location, now) / 60_000);
  if (ageMinutes === 0) return 'GPS just now';
  if (ageMinutes < 15) return `GPS ${ageMinutes}m ago`;
  return 'GPS stale';
}

export function isLocationStale(location: DeliveryRiderLocation, now = Date.now()): boolean {
  return locationAgeMs(location, now) >= 15 * 60_000;
}
