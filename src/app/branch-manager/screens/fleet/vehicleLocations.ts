import type { BranchGeofence } from '../../../lib/branchGeofence';

export interface VehicleLocation {
    latitude: number;
    longitude: number;
    captured_at: string;
    stale: boolean;
    moving?: boolean | null;
}

export interface FleetVehicle {
    id: string;
    plate_number: string;
    display_name: string | null;
    tracker_connected: boolean;
    geofence_status?: 'inside' | 'outside' | 'unknown' | 'unconfigured';
    position: VehicleLocation | null;
}

export interface VehicleLocationsResponse {
    vehicles: FleetVehicle[];
    gps_unavailable: boolean;
    refresh_interval_ms: number;
}

export type RoutePoint = Omit<VehicleLocation, 'stale' | 'moving'> & { outside_geofence?: boolean | null };

export interface VehicleRouteResponse {
    vehicle: Pick<FleetVehicle, 'id' | 'plate_number' | 'display_name'>;
    from: string;
    to: string;
    geofence?: BranchGeofence | null;
    points: RoutePoint[];
}

export const routeFixTime = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', second: '2-digit',
});

export const vehicleFixTime = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});
