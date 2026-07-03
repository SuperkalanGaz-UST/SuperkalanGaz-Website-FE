import { useBranch } from '../contexts/BranchContext';

export function useBranchData() {
  const { selectedBranch } = useBranch();

  const branchData = {
    'Quezon City Branch': {
      totalOrders: '284',
      completionRate: '96.5%',
      csatScore: '4.3',
      loyaltyRedemptions: '7',
      stockLevel: 42,
      orderVolumeData: [
        { month: 'Jan', orders: 185 },
        { month: 'Feb', orders: 220 },
        { month: 'Mar', orders: 195 },
        { month: 'Apr', orders: 265 },
        { month: 'May', orders: 284 },
      ],
      csatTrendData: [
        { month: 'Jan', score: 4.0 },
        { month: 'Feb', score: 4.2 },
        { month: 'Mar', score: 4.5 },
        { month: 'Apr', score: 4.1 },
        { month: 'May', score: 4.3 },
      ],
    },
    'Makati Branch': {
      totalOrders: '198',
      completionRate: '93.2%',
      csatScore: '4.1',
      loyaltyRedemptions: '4',
      stockLevel: 28,
      orderVolumeData: [
        { month: 'Jan', orders: 142 },
        { month: 'Feb', orders: 165 },
        { month: 'Mar', orders: 178 },
        { month: 'Apr', orders: 185 },
        { month: 'May', orders: 198 },
      ],
      csatTrendData: [
        { month: 'Jan', score: 3.8 },
        { month: 'Feb', score: 4.0 },
        { month: 'Mar', score: 4.2 },
        { month: 'Apr', score: 4.0 },
        { month: 'May', score: 4.1 },
      ],
    },
    'Mandaluyong Branch': {
      totalOrders: '321',
      completionRate: '98.1%',
      csatScore: '4.5',
      loyaltyRedemptions: '11',
      stockLevel: 55,
      orderVolumeData: [
        { month: 'Jan', orders: 245 },
        { month: 'Feb', orders: 268 },
        { month: 'Mar', orders: 285 },
        { month: 'Apr', orders: 302 },
        { month: 'May', orders: 321 },
      ],
      csatTrendData: [
        { month: 'Jan', score: 4.3 },
        { month: 'Feb', score: 4.4 },
        { month: 'Mar', score: 4.6 },
        { month: 'Apr', score: 4.4 },
        { month: 'May', score: 4.5 },
      ],
    },
  };

  return branchData[selectedBranch];
}
