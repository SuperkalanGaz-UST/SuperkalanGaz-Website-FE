import { createContext, useContext, useState, ReactNode } from 'react';

type Branch = 'Quezon City Branch' | 'Makati Branch' | 'Mandaluyong Branch';

interface BranchContextType {
  selectedBranch: Branch;
  setSelectedBranch: (branch: Branch) => void;
  availableBranches: Branch[];
  setAvailableBranches: (branches: Branch[]) => void;
}

const BranchContext = createContext<BranchContextType | undefined>(undefined);

interface BranchProviderProps {
  children: ReactNode;
  initialBranches?: Branch[];
}

export function BranchProvider({ children, initialBranches = ['Quezon City Branch'] }: BranchProviderProps) {
  const [selectedBranch, setSelectedBranch] = useState<Branch>(initialBranches[0]);
  const [availableBranches, setAvailableBranches] = useState<Branch[]>(initialBranches);

  return (
    <BranchContext.Provider value={{ selectedBranch, setSelectedBranch, availableBranches, setAvailableBranches }}>
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
