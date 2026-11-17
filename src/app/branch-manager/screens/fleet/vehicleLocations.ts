export interface VehicleLocation {
    latitude: number;
    longitude: number;
    captured_at: string;
    stale: boolean;
}

export interface FleetVehicle {
    id: string;
    plate_number: string;
    display_name: string | null;
    tracker_connected: boolean;
    position: VehicleLocation | null;
}

export interface VehicleLocationsResponse {
    vehicles: FleetVehicle[];
    gps_unavailable: boolean;
    refresh_interval_ms: number;
}

export type RoutePoint = Omit<VehicleLocation, 'stale'>;

export interface VehicleRouteResponse {
    vehicle: Pick<FleetVehicle, 'id' | 'plate_number' | 'display_name'>;
    from: string;
    to: string;
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
