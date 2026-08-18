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
import {
  assignedBranchesFrom,
  type AssignedBranch,
} from '../../lib/branchGeofence';

type Branch = 'Quezon City Branch' | 'Makati Branch' | 'Mandaluyong Branch';

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
