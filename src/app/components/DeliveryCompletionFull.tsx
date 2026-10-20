import { useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Header } from './Header';
import { DeliveryCompletionTable } from './DeliveryCompletionTable';
import { ReportBranchSelect, ReportStatus } from './FranchiseReportUi';
import { OrdersReport, useFranchiseReport } from '../lib/franchise-reports';
export function DeliveryCompletionFull({ onBack }: { onBack: () => void }) {
  const [branchId, setBranchId] = useState('');
  const query = useFranchiseReport<OrdersReport>('orders', { branchId });
  return <div className="flex-1 overflow-y-auto"><Header title="Delivery Completion Rate" /><div className="space-y-6 p-8">
    <button className="inline-flex items-center gap-2 text-sm text-[#007BC1] hover:underline" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Back to Branch Accounts</button>
    <ReportBranchSelect value={branchId} onChange={setBranchId} />
    <ReportStatus loading={query.isLoading} error={query.error} retry={query.refetch} />
    {!query.error && query.data && <DeliveryCompletionTable rows={query.data.completion} />}
  </div></div>;
}
