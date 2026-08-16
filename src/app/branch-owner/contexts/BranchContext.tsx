import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { apiErrorMessage, apiFetch } from '../../lib/api';

type Branch = 'Quezon City Branch' | 'Makati Branch' | 'Mandaluyong Branch';

export interface BranchGeofence {
  type: 'polygon';
  points: [number, number][];
}

export interface AssignedBranch {
  id: string;
  name: string;
  geofence: BranchGeofence | null;
}

function isBranchGeofence(value: unknown): value is BranchGeofence {
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

function assignedBranchesFrom(value: unknown): AssignedBranch[] {
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

interface BranchContextType {
  selectedBranch: Branch;
  setSelectedBranch: (branch: Branch) => void;
  availableBranches: Branch[];
  setAvailableBranches: (branches: Branch[]) => void;
  assignedBranches: AssignedBranch[] | null;
  assignedBranchesLoading: boolean;
  assignedBranchesError: string | null;
  refreshAssignedBranches: () => Promise<void>;
  isBranchSwitching: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

interface BranchProviderProps {
  children: ReactNode;
  initialBranches?: Branch[];
}

export function BranchProvider({ children, initialBranches = ['Quezon City Branch'] }: BranchProviderProps) {
  const [selectedBranch, setSelectedBranchState] = useState<Branch>(initialBranches[0]);
  const [isBranchSwitching, setIsBranchSwitching] = useState(false);
  const branchAnimationTimer = useRef<number | null>(null);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>(initialBranches);
  const [assignedBranches, setAssignedBranches] = useState<AssignedBranch[] | null>(null);
  const [assignedBranchesLoading, setAssignedBranchesLoading] = useState(true);
  const [assignedBranchesError, setAssignedBranchesError] = useState<string | null>(null);

  const setSelectedBranch = useCallback((branch: Branch) => {
    if (branch === selectedBranch) return;
    if (branchAnimationTimer.current !== null) {
      window.clearTimeout(branchAnimationTimer.current);
    }
    setIsBranchSwitching(true);
    setSelectedBranchState(branch);
    branchAnimationTimer.current = window.setTimeout(() => {
      setIsBranchSwitching(false);
      branchAnimationTimer.current = null;
    }, 60);
  }, [selectedBranch]);

  const refreshAssignedBranches = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    setAssignedBranchesLoading(true);
    setAssignedBranchesError(null);

    try {
      const response = await apiFetch('/branches/assigned', { signal: controller.signal });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setAssignedBranches(null);
        setAssignedBranchesError(
          apiErrorMessage(data, 'Could not load the assigned geofences.'),
        );
        return;
      }
      setAssignedBranches(assignedBranchesFrom(data));
    } catch {
      setAssignedBranches(null);
      setAssignedBranchesError(
        controller.signal.aborted
          ? 'The geofence request timed out.'
          : 'Could not reach the server.',
      );
    } finally {
      window.clearTimeout(timeout);
      setAssignedBranchesLoading(false);
    }
  }, []);

  // Prefetch once when the Branch Owner app mounts, before Fleet is opened.
  useEffect(() => {
    void refreshAssignedBranches();
  }, [refreshAssignedBranches]);

  useEffect(() => () => {
    if (branchAnimationTimer.current !== null) {
      window.clearTimeout(branchAnimationTimer.current);
    }
  }, []);

  return (
    <BranchContext.Provider value={{
      selectedBranch,
      setSelectedBranch,
      availableBranches,
      setAvailableBranches,
      assignedBranches,
      assignedBranchesLoading,
      assignedBranchesError,
      refreshAssignedBranches,
      isBranchSwitching,
    }}>
      {children}
    </BranchContext.Provider>
  );
}

export function useBranch() {
  const context = useContext(BranchContext);
  if (!context) {
    throw new Error('useBranch must be used within a BranchProvider');
  }
  return context;
}
