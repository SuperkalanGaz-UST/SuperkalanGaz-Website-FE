const STORAGE_KEY = 'superkalan:owner-branch-selection';

// A tab-local preference only. The live assigned-branches response must validate it.
export function readBranchSelection(ownerId: string): string | null {
  try {
    const saved: unknown = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && 'ownerId' in saved &&
        saved.ownerId === ownerId && 'branchId' in saved && typeof saved.branchId === 'string') {
      return saved.branchId;
    }
  } catch {
    // Storage may be unavailable; branch selection still works in memory.
  }
  return null;
}

export function saveBranchSelection(ownerId: string, branchId: string): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ ownerId, branchId }));
  } catch {
    // Storage may be unavailable; branch selection still works in memory.
  }
}

export function clearBranchSelection(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Storage may be unavailable.
  }
}
