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

interface BranchContextType {
  selectedBranch: string;
  selectedBranchId: string | null;
  setSelectedBranchId: (branchId: string) => void;
  availableBranches: string[];
  availableBranchOptions: AssignedBranch[];
  assignedBranches: AssignedBranch[] | null;
  assignedBranchesLoading: boolean;
  assignedBranchesError: string | null;
  refreshAssignedBranches: () => Promise<void>;
  isBranchSwitching: boolean;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

interface BranchProviderProps {
  children: ReactNode;
  initialBranches?: AssignedBranch[];
}

export function BranchProvider({ children, initialBranches = [] }: BranchProviderProps) {
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(
    initialBranches[0]?.id || null,
  );
  const [isBranchSwitching, setIsBranchSwitching] = useState(false);
  const branchAnimationTimer = useRef<number | null>(null);
  const [availableBranchOptions, setAvailableBranchOptions] =
    useState<AssignedBranch[]>(initialBranches);
  const [assignedBranches, setAssignedBranches] = useState<AssignedBranch[] | null>(null);
  const [assignedBranchesLoading, setAssignedBranchesLoading] = useState(true);
  const [assignedBranchesError, setAssignedBranchesError] = useState<string | null>(null);

  const selectedBranch =
    availableBranchOptions.find((branch) => branch.id === selectedBranchId)?.name ??
    availableBranchOptions[0]?.name ??
    '';
  const availableBranches = availableBranchOptions.map((branch) => branch.name);

  const setSelectedBranchId = useCallback((branchId: string) => {
    if (branchId === selectedBranchId) return;
    if (!availableBranchOptions.some((branch) => branch.id === branchId)) return;
    if (branchAnimationTimer.current !== null) {
      window.clearTimeout(branchAnimationTimer.current);
    }
    setIsBranchSwitching(true);
    setSelectedBranchIdState(branchId);
    branchAnimationTimer.current = window.setTimeout(() => {
      setIsBranchSwitching(false);
      branchAnimationTimer.current = null;
    }, 60);
  }, [availableBranchOptions, selectedBranchId]);

  const refreshAssignedBranches = useCallback(async () => {
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 5_000);
    setAssignedBranchesLoading(true);
    setAssignedBranchesError(null);

    try {
      const response = await apiFetch('/branches/assigned', { signal: controller.signal });
      const data: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        const message = apiErrorMessage(data, 'Could not load the assigned geofences.');
        setAssignedBranches(null);
        setAssignedBranchesError(message);
        // Do not keep a claim-derived selection after the authoritative API
        // failed to validate it. The shell remains visible, but branch writes
        // stay unavailable until a successful refresh resolves live UUIDs.
        setAvailableBranchOptions([]);
        setSelectedBranchIdState(null);
        return;
      }
      const resolved = assignedBranchesFrom(data);
      setAssignedBranches(resolved);
      setAvailableBranchOptions(resolved);
      setSelectedBranchIdState((current) =>
        current && resolved.some((branch) => branch.id === current)
          ? current
          : resolved[0]?.id ?? null,
      );
    } catch {
      setAssignedBranches(null);
      setAvailableBranchOptions([]);
      setSelectedBranchIdState(null);
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
      selectedBranchId,
      setSelectedBranchId,
      availableBranches,
      availableBranchOptions,
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
