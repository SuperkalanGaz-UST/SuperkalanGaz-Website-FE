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

export const vehicleFixTime = new Intl.DateTimeFormat('en-PH', {
    timeZone: 'Asia/Manila',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
});
