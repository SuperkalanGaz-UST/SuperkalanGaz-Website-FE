import { useState } from 'react';
import { AlertCircle, MessageSquare, Star } from 'lucide-react';
import { Header } from './Header';
import { RecentRatingsTable } from './RecentRatingsTable';
import { ComplaintLogTable } from './ComplaintLogTable';
import { ReportBranchSelect, ReportMetric, ReportScope, ReportStatus } from './FranchiseReportUi';
import { CsatReport, reportRating, useFranchiseReport } from '../lib/franchise-reports';
import styles from './FranchiseReports.module.css';

export function CSATSatisfaction() {
  const [branchId, setBranchId] = useState('');
  const query = useFranchiseReport<CsatReport>('csat', { branchId });
  return <div className={styles.page}>
    <Header title="System CSAT" />
    <div className={styles.content}>
      <div className={styles.toolbar}><ReportScope label="All recorded feedback" /><ReportBranchSelect value={branchId} onChange={setBranchId} /></div>
      <ReportStatus loading={query.isLoading} error={query.error} retry={query.refetch} />
      {!query.error && query.data && <div className={styles.metrics + ' ' + styles.metricsThree}>
        <ReportMetric title="Average Rating" value={reportRating(query.data.rating)} description="Customer satisfaction on a 5-star scale" icon={<Star size={18} />} primary />
        <ReportMetric title="Ratings Received" value={query.data.total.toLocaleString()} description="All submitted customer ratings" icon={<MessageSquare size={18} />} />
        <ReportMetric title="Open Complaints" value={query.data.complaints.toLocaleString()} description="Open and in-progress incidents" icon={<AlertCircle size={18} />} />
      </div>}
      <RecentRatingsTable key={'ratings-' + branchId} branchId={branchId} /><ComplaintLogTable key={'incidents-' + branchId} branchId={branchId} />
    </div>
  </div>;
}
