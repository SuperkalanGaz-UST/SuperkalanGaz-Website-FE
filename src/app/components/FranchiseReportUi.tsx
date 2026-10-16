import { ReactNode } from 'react';
import { AlertCircle, Building2, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Filter, Inbox, LoaderCircle, Search } from 'lucide-react';
import { useReportBranches } from '../lib/franchise-reports';
import styles from './FranchiseReports.module.css';

export function ReportStatus({ loading, error, retry }: { loading: boolean; error: Error | null; retry: () => unknown }) {
  if (error) return (
    <div className={styles.error} role="alert">
      <AlertCircle size={18} aria-hidden="true" />
      <div>
        <p>{error.message || 'Report unavailable'}</p>
        <button type="button" className="mt-2 font-medium underline" onClick={() => void retry()}>Try again</button>
      </div>
    </div>
  );
  if (loading) return <div className={styles.loading} role="status"><LoaderCircle size={19} aria-hidden="true" />Loading report...</div>;
  return null;
}

export function ReportEmpty({ title = 'No records found', hint = 'Try another branch or adjust your filters to see more results.' }: { title?: string; hint?: string }) {
  return <div className={styles.empty}>
    <span className={styles.emptyIcon}><Inbox size={21} aria-hidden="true" /></span>
    <p className={styles.emptyTitle}>{title}</p>
    <p className={styles.emptyHint}>{hint}</p>
  </div>;
}

export function ReportMetric({ title, value, description, icon, primary = false }: { title: string; value: ReactNode; description: string; icon: ReactNode; primary?: boolean }) {
  return <div className={styles.metric + (primary ? ' ' + styles.metricPrimary : '')}>
    <div className={styles.metricHeading}><p className={styles.metricTitle}>{title}</p><span className={styles.metricIcon} aria-hidden="true">{icon}</span></div>
    <div><div className={styles.metricValue}>{value}</div><p className={styles.metricDescription}>{description}</p></div>
  </div>;
}

export function ReportScope({ label }: { label: string }) {
  return <div className={styles.toolbarMeta}>
    <span className={styles.contextChip}><CalendarDays size={14} aria-hidden="true" />{label}</span>
    <span className={styles.updateNote}><span className={styles.updateDot} />Updates every 30 seconds</span>
  </div>;
}

export function ReportBranchSelect({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const branches = useReportBranches();
  return <div>
    <label className={styles.selectControl}>
      <Building2 size={15} className={styles.selectIcon} aria-hidden="true" />
      <select aria-label="Filter by branch" value={value} onChange={e => onChange(e.target.value)}>
        <option value="">All Branches</option>
        {branches.data?.branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
      </select>
      <ChevronDown size={14} className={styles.selectChevron} aria-hidden="true" />
    </label>
    {branches.error && <ReportStatus loading={false} error={branches.error} retry={branches.refetch} />}
  </div>;
}

export function ReportSearch({ value, onChange, placeholder, label }: { value: string; onChange: (value: string) => void; placeholder: string; label: string }) {
  return <label className={styles.search}>
    <Search size={16} aria-hidden="true" />
    <input aria-label={label} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
  </label>;
}

export function ReportFilterSelect({ value, onChange, label, options }: { value: string; onChange: (value: string) => void; label: string; options: { value: string; label: string }[] }) {
  return <label className={styles.selectControl}>
    <Filter size={15} className={styles.selectIcon} aria-hidden="true" />
    <select aria-label={label} value={value} onChange={e => onChange(e.target.value)}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
    <ChevronDown size={14} className={styles.selectChevron} aria-hidden="true" />
  </label>;
}

export function ReportTable({ headers, children, empty }: { headers: string[]; children: ReactNode; empty: boolean }) {
  return <div className={styles.tableWrap}><table className={styles.table}>
    <thead><tr>{headers.map((h, index) => <th scope="col" key={h || index}>{h}</th>)}</tr></thead>
    <tbody>{empty ? <tr><td colSpan={headers.length}><ReportEmpty /></td></tr> : children}</tbody>
  </table></div>;
}

export function ReportPager({ page, total, onChange, limit = 10 }: { page: number; total: number; onChange: (page: number) => void; limit?: number }) {
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const startPage = Math.max(1, Math.min(page - 1, totalPages - 2));
  const pages = Array.from({ length: Math.min(3, totalPages) }, (_, index) => startPage + index);
  return <div className={styles.pager}>
    <span>{total.toLocaleString()} records</span>
    <nav className={styles.pagerButtons} aria-label="Table pagination">
      <button type="button" aria-label="Previous page" disabled={page <= 1} onClick={() => onChange(page - 1)}><ChevronLeft size={14} aria-hidden="true" /></button>
      {pages.map(number => <button key={number} type="button" aria-label={'Page ' + number} aria-current={page === number ? 'page' : undefined} onClick={() => onChange(number)}>{number}</button>)}
      <button type="button" aria-label="Next page" disabled={page >= totalPages} onClick={() => onChange(page + 1)}><ChevronRight size={14} aria-hidden="true" /></button>
    </nav>
  </div>;
}

export const reportCell = styles.cell;
