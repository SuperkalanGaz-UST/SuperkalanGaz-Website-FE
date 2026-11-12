export interface BranchGeofence {
  type: 'polygon';
  points: [number, number][];
  /** Optional branch pin; radius circles retain polygon vertices for existing maps. */
  center?: [number, number];
  radiusMeters?: number;
}

export interface AssignedBranch {
  id: string;
  name: string;
  geofence: BranchGeofence | null;
}

export function isBranchCoordinate(value: unknown): value is [number, number] {
  if (!Array.isArray(value) || value.length !== 2) return false;
  const [latitude, longitude] = value as unknown[];
  return typeof latitude === 'number' && Number.isFinite(latitude) && Math.abs(latitude) <= 90 &&
    typeof longitude === 'number' && Number.isFinite(longitude) && Math.abs(longitude) <= 180;
}

export function isBranchGeofence(value: unknown): value is BranchGeofence {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  if (candidate.type !== 'polygon' || !Array.isArray(candidate.points)) return false;
  if (candidate.center !== undefined && !isBranchCoordinate(candidate.center)) return false;
  if (candidate.radiusMeters !== undefined && (
    typeof candidate.radiusMeters !== 'number' || !Number.isFinite(candidate.radiusMeters) ||
    candidate.radiusMeters < 100 || candidate.radiusMeters > 50000 || !candidate.center
  )) return false;
  return candidate.points.length >= 3 && candidate.points.length <= 1000 &&
    candidate.points.every(isBranchCoordinate);
}

export function assignedBranchesFrom(value: unknown): AssignedBranch[] {
  if (!value || typeof value !== 'object') return [];
  const branches = (value as { branches?: unknown }).branches;
  if (!Array.isArray(branches)) return [];

  return branches.flatMap((branch): AssignedBranch[] => {
    if (!branch || typeof branch !== 'object') return [];
    const candidate = branch as Record<string, unknown>;
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string') return [];
    return [{
      id: candidate.id,
      name: candidate.name,
      geofence: isBranchGeofence(candidate.geofence) ? candidate.geofence : null,
    }];
  });
}

/** Geodesic vertices, rather than a screen-pixel circle, keep the radius in metres. */
export function circlePoints(center: [number, number], radiusMeters: number): [number, number][] {
  const angularDistance = radiusMeters / 6371000;
  const latitude = center[0] * Math.PI / 180;
  const longitude = center[1] * Math.PI / 180;
  return Array.from({ length: 96 }, (_, index): [number, number] => {
    const bearing = index * 2 * Math.PI / 96;
    const lat = Math.asin(Math.sin(latitude) * Math.cos(angularDistance) +
      Math.cos(latitude) * Math.sin(angularDistance) * Math.cos(bearing));
    const lng = longitude + Math.atan2(Math.sin(bearing) * Math.sin(angularDistance) * Math.cos(latitude),
      Math.cos(angularDistance) - Math.sin(latitude) * Math.sin(lat));
    return [lat * 180 / Math.PI, ((lng * 180 / Math.PI + 540) % 360) - 180];
  });
}

export function geofenceSummary(geofence: BranchGeofence | null): string {
  if (!geofence) return 'No coverage set';
  if (geofence.radiusMeters) return `Circle · ${(geofence.radiusMeters / 1000).toLocaleString()} km radius`;
  return `Polygon · ${geofence.points.length} vertices`;
}
