import { useState } from 'react';
import { ArrowUpRight, CheckCircle2, ShoppingCart, Truck, XCircle } from 'lucide-react';
import { Header } from './Header';
import { DailyOrderVolumeChart } from './DailyOrderVolumeChart';
import { OrdersByStatusChart } from './OrdersByStatusChart';
import { DeliveryCompletionTable } from './DeliveryCompletionTable';
import { OrdersReport, reportPercent, useFranchiseReport } from '../lib/franchise-reports';
import { ReportBranchSelect, ReportMetric, ReportScope, ReportStatus, ReportTable, reportCell } from './FranchiseReportUi';
import styles from './FranchiseReports.module.css';

export function OrderAnalytics({ onViewCustomer }: { onViewCustomer: (id: string) => void }) {
  const [branchId, setBranchId] = useState('');
  const query = useFranchiseReport<OrdersReport>('orders', { branchId });
  const report = query.data;
  return <div className={styles.page}>
    <Header title="Branch Accounts" />
    <div className={styles.content}>
      <div className={styles.toolbar}><ReportScope label="Current month (Manila)" /><ReportBranchSelect value={branchId} onChange={setBranchId} /></div>
      <ReportStatus loading={query.isLoading} error={query.error} retry={query.refetch} />
      {!query.error && report && <>
        <div className={styles.metrics}>
          <ReportMetric title="Total Orders" value={report.total.toLocaleString()} description="Service requests this month" icon={<ShoppingCart size={18} />} primary />
          <ReportMetric title="Completed Deliveries" value={report.delivered.toLocaleString()} description="Orders marked as delivered" icon={<CheckCircle2 size={18} />} />
          <ReportMetric title="Cancelled Orders" value={report.cancelled.toLocaleString()} description="Orders marked as cancelled" icon={<XCircle size={18} />} />
          <ReportMetric title="Completion Rate" value={reportPercent(report.delivered, report.total)} description="Delivered out of all monthly orders" icon={<Truck size={18} />} />
        </div>
        <div className={styles.charts}><DailyOrderVolumeChart data={report.daily} /><OrdersByStatusChart data={report.statuses} /></div>
        <DeliveryCompletionTable rows={report.completion} />
        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>Top customers</h3><p className={styles.panelSubtitle}>Highest order volumes for the current month</p></div><span className={styles.badge}>Top 5</span></div>
          <ReportTable headers={['Rank', 'Customer', 'Branch', 'Orders', '']} empty={!report.topCustomers.length}>
            {report.topCustomers.map((c, index) => <tr key={c.id}>
              <td className={reportCell}><span className={styles.rank}>{String(index + 1).padStart(2, '0')}</span></td>
              <td className={reportCell}><span className={styles.cellStrong}>{c.name}</span></td>
              <td className={reportCell}><span className={styles.badge}>{c.branch}</span></td>
              <td className={reportCell}><span className={styles.cellStrong}>{c.totalOrders}</span></td>
              <td className={reportCell}><button className={styles.linkButton} onClick={() => onViewCustomer(c.id)}>View profile<ArrowUpRight size={14} aria-hidden="true" /></button></td>
            </tr>)}
          </ReportTable>
        </div>
      </>}
    </div>
  </div>;
}
