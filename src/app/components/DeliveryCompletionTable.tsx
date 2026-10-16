import { CompletionRow, reportMonth, reportPercent } from '../lib/franchise-reports';
import { ReportTable, reportCell } from './FranchiseReportUi';
import styles from './FranchiseReports.module.css';

export function DeliveryCompletionTable({ rows }: { rows: CompletionRow[] }) {
  return <div className={styles.panel}>
    <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>Delivery performance</h3><p className={styles.panelSubtitle}>Completion and SLA breaches by branch and order month</p></div><span className={styles.badge}>Last 6 months</span></div>
    <ReportTable headers={['Branch', 'Month', 'Total Orders', 'Delivered', 'Completion Rate', 'SLA Breaches']} empty={!rows.length}>
      {rows.map(r => <tr key={r.branchId + r.month}>
        <td className={reportCell}><span className={styles.cellStrong}>{r.branch}</span></td>
        <td className={reportCell}>{reportMonth(r.month)}</td><td className={reportCell}>{r.totalOrders}</td><td className={reportCell}>{r.completed}</td>
        <td className={reportCell}><span className={styles.badge + ' ' + styles.badgeBlue}>{reportPercent(r.completed, r.totalOrders)}</span></td>
        <td className={reportCell}><span className={styles.badge + ' ' + (r.slaBreaches > 0 ? styles.badgeAmber : styles.badgeGreen)}>{r.slaBreaches}</span></td>
      </tr>)}
    </ReportTable>
  </div>;
}
