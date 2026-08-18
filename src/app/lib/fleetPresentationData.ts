import type { BranchGeofence } from './branchGeofence';

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

export interface FleetActivity {
  time: string;
  rider: string;
  event: string;
}

/**
 * Shared presentation fixture for both staff views while hardware-dependent
 * SinoTrack ST-901 -> Traccar ingestion remains deferred. Keeping this in one
 * module prevents two roles viewing the same branch from seeing contradictory
 * roster, status, and activity data.
 */
export const FLEET_RIDERS: FleetRider[] = [
  {
    id: '1',
    name: 'Juan Dela Cruz',
    plateNumber: 'ABC-1234',
    status: 'active',
    currentOrder: 'ORD-1052',
    lastUpdated: '2 mins ago',
  },
  {
    id: '2',
    name: 'Pedro Santos',
    plateNumber: 'XYZ-5678',
    status: 'active',
    currentOrder: 'ORD-1053',
    lastUpdated: '5 mins ago',
  },
  {
    id: '3',
    name: 'Carlos Reyes',
    plateNumber: 'DEF-9012',
    status: 'outside-geofence',
    currentOrder: 'ORD-1054',
    lastUpdated: '1 min ago',
    geofenceBreach: true,
  },
  {
    id: '4',
    name: 'Miguel Torres',
    plateNumber: 'GHI-3456',
    status: 'active',
    currentOrder: null,
    lastUpdated: '10 mins ago',
  },
  {
    id: '5',
    name: 'Ramon Lopez',
    plateNumber: 'JKL-7890',
    status: 'inactive',
    currentOrder: null,
    lastUpdated: '45 mins ago',
  },
];

export const FLEET_ACTIVITY: FleetActivity[] = [
  { time: '10:42 AM', rider: 'Juan Dela Cruz', event: 'Delivered order ORD-1051 successfully' },
  { time: '10:38 AM', rider: 'Carlos Reyes', event: 'Left geofence boundary - En route to customer' },
  { time: '10:35 AM', rider: 'Pedro Santos', event: 'Picked up order ORD-1053 from branch' },
  { time: '10:30 AM', rider: 'Miguel Torres', event: 'Returned to branch' },
  { time: '10:25 AM', rider: 'Juan Dela Cruz', event: 'Picked up order ORD-1051 from branch' },
];

/**
 * Temporary display positions are derived from the authenticated branch's own
 * geofence, so a Las Pinas roster cannot be rendered over a fixed Makati map.
 * These positions are replaced by API-ingested Traccar coordinates when the
 * hardware-dependent Fleet integration is enabled.
 */
export function positionFleetRiders(
  riders: FleetRider[],
  geofence: BranchGeofence,
): PositionedFleetRider[] {
  const [latTotal, lngTotal] = geofence.points.reduce(
    ([lat, lng], point) => [lat + point[0], lng + point[1]],
    [0, 0],
  );
  const center: [number, number] = [
    latTotal / geofence.points.length,
    lngTotal / geofence.points.length,
  ];

  return riders.map((rider, index) => {
    const vertex = geofence.points[index % geofence.points.length];
    const factor = rider.status === 'outside-geofence' ? 1.18 : 0.22 + (index % 3) * 0.08;
    return {
      ...rider,
      lat: center[0] + (vertex[0] - center[0]) * factor,
      lng: center[1] + (vertex[1] - center[1]) * factor,
    };
  });
}
