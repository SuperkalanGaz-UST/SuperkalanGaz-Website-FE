import { Header } from './Header';
import { ArrowLeft } from 'lucide-react';
import { KPICard } from './KPICard';
import { CustomerReport, reportDate, reportRating, useFranchiseReport } from '../lib/franchise-reports';
import { ReportStatus, ReportTable, reportCell } from './FranchiseReportUi';

export function CustomerDetail({ onBack, customerId }: { onBack: () => void; customerId: string | null }) {
  const query = useFranchiseReport<CustomerReport>('customers/' + customerId, {}, !!customerId);
  const c = query.data?.customer;
  return <div className="flex-1 overflow-y-auto bg-[#F5F7FA]">
    <Header title="Customer Detail" />
    <div className="space-y-6 p-8">
      <button className="inline-flex items-center gap-2 text-sm text-[#007BC1] hover:underline" onClick={onBack}><ArrowLeft size={15} aria-hidden="true" />Back to Customer List</button>
      {!customerId ? <p className="text-sm text-gray-500">Select a customer from the customer list.</p> : <ReportStatus loading={query.isLoading} error={query.error} retry={query.refetch} />}
      {!query.error && c && <>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h2 className="text-xl font-semibold text-gray-900">{c.name}</h2>
          <p className="mt-2 text-sm text-gray-500">{c.phone}</p><p className="mt-1 text-sm text-gray-500">{c.address}</p>
          <p className="mt-1 text-sm text-gray-500">{c.primaryBranch} &middot; {c.code ?? c.id}</p>
        </div>
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
          <KPICard title="Total Orders" value={String(c.totalOrders)} />
          <KPICard title={c.accountType === 'household' ? 'Household Points' : 'Commercial Cycle Progress'} value={c.accountType === 'household' ? String(c.loyaltyPoints) : c.loyaltyPoints + '/30'} />
          <KPICard title="Avg. Rating" value={reportRating(c.avgRating)} />
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <h3 className="mb-2 font-semibold text-gray-900">Order History</h3>
          <p className="mb-4 text-xs text-gray-500">Latest 100 orders for this branch customer profile.</p>
          <ReportTable headers={['Order No.', 'Branch', 'Date', 'Status', 'Rating']} empty={!query.data!.orders.length}>
            {query.data!.orders.map(o => <tr key={o.id}><td className={reportCell}>{o.orderNo}</td><td className={reportCell}>{o.branch}</td><td className={reportCell}>{reportDate(o.date)}</td><td className={reportCell}>{o.status}</td><td className={reportCell}>{reportRating(o.rating)}</td></tr>)}
          </ReportTable>
        </div>
      </>}
    </div>
  </div>;
}
