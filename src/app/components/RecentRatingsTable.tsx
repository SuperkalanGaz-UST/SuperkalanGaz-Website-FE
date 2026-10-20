import { useState } from 'react';
import { ArrowUpRight, Star } from 'lucide-react';
import { RatingRow, ReportPage, reportDate, useFranchiseReport } from '../lib/franchise-reports';
import { ReportBranchSelect, ReportFilterSelect, ReportPager, ReportSearch, ReportStatus, ReportTable, reportCell } from './FranchiseReportUi';
import styles from './FranchiseReports.module.css';

export function RecentRatingsTable({ branchId = '', full = false }: { branchId?: string; full?: boolean }) {
  const [selectedBranch, setSelectedBranch] = useState('');
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [stars, setStars] = useState('');
  const query = useFranchiseReport<ReportPage<RatingRow>>('ratings', { branchId: full ? selectedBranch : branchId, search, stars, page, limit: full ? 10 : 6 });
  return <div className={styles.panel}>
    <div className={styles.panelHeader}>
      <div><h3 className={styles.panelTitle}>Customer ratings</h3><p className={styles.panelSubtitle}>{full ? 'Search feedback and review rating follow-ups' : 'The latest feedback submitted by your customers'}</p></div>
      {!full && <button className={styles.linkButton} onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'customer-ratings-full' }))}>View all<ArrowUpRight size={14} aria-hidden="true" /></button>}
    </div>
    {full && <div className={styles.panelControls}>
      <ReportSearch label="Search ratings" placeholder="Search customer, order or comment" value={search} onChange={value => { setSearch(value); setPage(1); }} />
      <ReportBranchSelect value={selectedBranch} onChange={id => { setSelectedBranch(id); setPage(1); }} />
      <ReportFilterSelect label="Filter star rating" value={stars} onChange={value => { setStars(value); setPage(1); }} options={[{ value: '', label: 'All Ratings' }, ...[5, 4, 3, 2, 1].map(n => ({ value: String(n), label: n + ' stars' }))]} />
    </div>}
    <ReportStatus loading={query.isLoading} error={query.error} retry={query.refetch} />
    {!query.error && query.data && <>
      <ReportTable headers={['Customer', 'Branch', 'Order', 'Rating', 'Comment', 'Date', 'Follow-up']} empty={!query.data.rows.length}>
        {query.data.rows.map(r => <tr key={r.id}>
          <td className={reportCell}><span className={styles.cellStrong}>{r.customer}</span></td>
          <td className={reportCell}><span className={styles.badge}>{r.branch}</span></td>
          <td className={reportCell}><span className={styles.shortId} title={r.orderId}>{r.orderId}</span></td>
          <td className={reportCell}><span className={styles.rating}><Star size={12} aria-hidden="true" />{r.rating}<span className="text-xs font-normal text-gray-400">/ 5</span></span></td>
          <td className={reportCell}><p className={styles.comment}>{r.comment || '\u2014'}</p></td>
          <td className={reportCell}><span className="whitespace-nowrap">{reportDate(r.date)}</span></td>
          <td className={reportCell}><span className={styles.badge + ' ' + (r.resolution === 'Resolved' ? styles.badgeGreen : styles.badgeAmber)}>{r.resolution}</span></td>
        </tr>)}
      </ReportTable>
      <ReportPager page={page} total={query.data.total} limit={full ? 10 : 6} onChange={setPage} />
    </>}
  </div>;
}
