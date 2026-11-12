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

const ASSIGNED_BRANCH_TIMEOUT_MS = 5_000;
const RETRYABLE_ASSIGNMENT_STATUSES = new Set([408, 500, 502, 503, 504]);

async function loadAssignedBranches(signal: AbortSignal, canRetry = true): Promise<AssignedBranch[]> {
  const timeout = AbortSignal.timeout(ASSIGNED_BRANCH_TIMEOUT_MS);
  const requestSignal = AbortSignal.any([signal, timeout]);

  let response: Response;
  let data: unknown;
  try {
    requestSignal.throwIfAborted();
    response = await apiFetch('/branches/assigned', { cache: 'no-store', signal: requestSignal });
    data = await response.json().catch(() => null);
    requestSignal.throwIfAborted();
  } catch (error) {
    signal.throwIfAborted();
    if (canRetry && (timeout.aborted || error instanceof TypeError)) {
      return retryAssignedBranches(signal);
    }
    throw new Error(timeout.aborted ? 'The branch lookup timed out.' : 'Could not reach the server.');
  }

  if (!response.ok) {
    if (canRetry && RETRYABLE_ASSIGNMENT_STATUSES.has(response.status)) {
      return retryAssignedBranches(signal);
    }
    throw new Error(apiErrorMessage(data, 'Could not load the assigned branches.'));
  }

  return assignedBranchesFrom(data);
}

async function retryAssignedBranches(signal: AbortSignal): Promise<AssignedBranch[]> {
  // A temporary failure on the first dashboard load shouldn't require a click.
  await new Promise<void>((resolve) => window.setTimeout(resolve, 400));
  signal.throwIfAborted();
  return loadAssignedBranches(signal, false);
}

interface BranchProviderProps {
  children: ReactNode;
}

export function BranchProvider({ children }: BranchProviderProps) {
  // Saved Auth labels can lag branch renames or ownership changes. Resolve both
  // the label and selectable UUID through the API before loading branch data.
  const [selectedBranchId, setSelectedBranchIdState] = useState<string | null>(null);
  const [isBranchSwitching, setIsBranchSwitching] = useState(false);
  const branchAnimationTimer = useRef<number | null>(null);
  const [availableBranchOptions, setAvailableBranchOptions] =
    useState<AssignedBranch[]>([]);
  const [assignedBranches, setAssignedBranches] = useState<AssignedBranch[] | null>(null);
  const [assignedBranchesLoading, setAssignedBranchesLoading] = useState(true);
  const [assignedBranchesError, setAssignedBranchesError] = useState<string | null>(null);
  const assignmentRequest = useRef<AbortController | null>(null);

  const selectedBranch =
    availableBranchOptions.find((branch) => branch.id === selectedBranchId)?.name ??
    'Select branch';
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
    assignmentRequest.current?.abort();
    const controller = new AbortController();
    assignmentRequest.current = controller;
    setAssignedBranchesLoading(true);
    setAssignedBranchesError(null);

    try {
      const resolved = await loadAssignedBranches(controller.signal);
      if (controller.signal.aborted) return;
      setAssignedBranches(resolved);
      setAvailableBranchOptions(resolved);
      setSelectedBranchIdState((current) =>
        current && resolved.some((branch) => branch.id === current)
          ? current
          : resolved.length === 1 ? resolved[0].id : null,
      );
    } catch (error) {
      if (controller.signal.aborted) return;
      // Branch data stays unavailable until the API validates the live UUIDs.
      setAssignedBranches(null);
      setAvailableBranchOptions([]);
      setSelectedBranchIdState(null);
      setAssignedBranchesError(error instanceof Error ? error.message : 'Could not load the assigned branches.');
    } finally {
      if (assignmentRequest.current === controller && !controller.signal.aborted) {
        assignmentRequest.current = null;
        setAssignedBranchesLoading(false);
      }
    }
  }, []);

  // Prefetch once when the Branch Owner app mounts, before Fleet is opened.
  useEffect(() => {
    void refreshAssignedBranches();
    return () => assignmentRequest.current?.abort();
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
