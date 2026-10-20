import { useState } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { IncidentRow, ReportPage, reportDate, useFranchiseReport } from '../lib/franchise-reports';
import { ReportBranchSelect, ReportFilterSelect, ReportPager, ReportSearch, ReportStatus, ReportTable, reportCell } from './FranchiseReportUi';
import styles from './FranchiseReports.module.css';

export function ComplaintLogTable({ branchId = '', full = false }: { branchId?: string; full?: boolean }) {
  const [selectedBranch, setSelectedBranch] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [incidentStatus, setIncidentStatus] = useState('all');
  const query = useFranchiseReport<ReportPage<IncidentRow>>('incidents', { branchId: full ? selectedBranch : branchId, search, incidentStatus, page, limit: full ? 10 : 6 });
  return <div className={styles.panel}>
    <div className={styles.panelHeader}>
      <div><h3 className={styles.panelTitle}>Complaint log</h3><p className={styles.panelSubtitle}>Reported incidents and recorded first-response times</p></div>
      {!full && <button className={styles.linkButton} onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'complaint-log-full' }))}>View all<ArrowUpRight size={14} aria-hidden="true" /></button>}
    </div>
    {full && <div className={styles.panelControls}>
      <ReportSearch label="Search incidents" placeholder="Search customer or issue" value={search} onChange={value => { setSearch(value); setPage(1); }} />
      <ReportBranchSelect value={selectedBranch} onChange={id => { setSelectedBranch(id); setPage(1); }} />
      <ReportFilterSelect label="Filter incident status" value={incidentStatus} onChange={value => { setIncidentStatus(value); setPage(1); }} options={[{ value: 'all', label: 'All Statuses' }, ...['open', 'in_progress', 'resolved', 'closed'].map(s => ({ value: s, label: s.replace('_', ' ').replace(/^./, c => c.toUpperCase()) }))]} />
    </div>}
    <ReportStatus loading={query.isLoading} error={query.error} retry={query.refetch} />
    {!query.error && query.data && <>
      <ReportTable headers={['Incident', 'Customer', 'Branch', 'Issue', 'Status', 'Reported', 'First Response']} empty={!query.data.rows.length}>
        {query.data.rows.map(r => <tr key={r.complaintId}>
          <td className={reportCell}><span className={styles.shortId} title={r.complaintId}>{r.complaintId}</span></td>
          <td className={reportCell}><span className={styles.cellStrong}>{r.customer}</span></td>
          <td className={reportCell}><span className={styles.badge}>{r.branch}</span></td>
          <td className={reportCell}><p className={styles.comment}>{r.issueSummary}</p></td>
          <td className={reportCell}><span className={styles.badge + ' ' + (['resolved', 'closed'].includes(r.status) ? styles.badgeGreen : styles.badgeAmber)}>{r.status.replace('_', ' ').replace(/^./, c => c.toUpperCase())}</span></td>
          <td className={reportCell}><span className="whitespace-nowrap">{reportDate(r.date)}</span></td>
          <td className={reportCell}>{r.responseSeconds === null ? <span className={styles.subtext}>Not recorded</span> : Math.max(0, Math.round(r.responseSeconds / 60)) + ' mins'}</td>
        </tr>)}
      </ReportTable>
      <ReportPager page={page} total={query.data.total} limit={full ? 10 : 6} onChange={setPage} />
    </>}
  </div>;
}
