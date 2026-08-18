export interface BranchGeofence {
  type: 'polygon';
  points: [number, number][];
}

export interface AssignedBranch {
  id: string;
  name: string;
  geofence: BranchGeofence | null;
}

export function isBranchGeofence(value: unknown): value is BranchGeofence {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as { type?: unknown; points?: unknown };
  if (candidate.type !== 'polygon' || !Array.isArray(candidate.points)) return false;

  return candidate.points.length >= 3 && candidate.points.every((point) => {
    if (!Array.isArray(point) || point.length !== 2) return false;
    const [latitude, longitude] = point as unknown[];
    return (
      typeof latitude === 'number' &&
      Number.isFinite(latitude) &&
      latitude >= -90 &&
      latitude <= 90 &&
      typeof longitude === 'number' &&
      Number.isFinite(longitude) &&
      longitude >= -180 &&
      longitude <= 180
    );
  });
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
