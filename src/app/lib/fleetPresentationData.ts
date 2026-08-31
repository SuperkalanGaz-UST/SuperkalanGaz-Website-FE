export type FleetRiderStatus = 'active' | 'inactive' | 'outside-geofence';

export interface FleetRider {
  id: string;
  name: string;
  plateNumber: string;
  status: FleetRiderStatus;
  currentOrder: string | null;
  lastUpdated: string;
  geofenceBreach?: boolean;
}

export interface PositionedFleetRider extends FleetRider {
  lat: number;
  lng: number;
}
