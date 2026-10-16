import { useState } from 'react';
import { ArrowUpRight, Users, Gift, ShoppingCart, Star } from 'lucide-react';
import { Header } from './Header';
import { CustomerDirectory, reportDate, reportRating, useFranchiseReport } from '../lib/franchise-reports';
import { ReportBranchSelect, ReportFilterSelect, ReportMetric, ReportPager, ReportScope, ReportSearch, ReportStatus, ReportTable, reportCell } from './FranchiseReportUi';
import styles from './FranchiseReports.module.css';

export function CustomerList({ onViewCustomer }: { onViewCustomer: (id: string) => void }) {
  const [search, setSearch] = useState('');
  const [branchId, setBranchId] = useState('');
  const [status, setStatus] = useState('all');
  const [page, setPage] = useState(1);
  const query = useFranchiseReport<CustomerDirectory>('customers', { search, branchId, status, page });
  const summary = query.data?.summary;
  return <div className={styles.page}>
    <Header title="Customers" />
    <div className={styles.content}>
      <div className={styles.toolbar}>
        <ReportSearch label="Search customers" placeholder="Search name, phone or branch" value={search} onChange={value => { setSearch(value); setPage(1); }} />
        <ReportBranchSelect value={branchId} onChange={id => { setBranchId(id); setPage(1); }} />
        <ReportFilterSelect label="Filter customer status" value={status} onChange={value => { setStatus(value); setPage(1); }} options={[{ value: 'all', label: 'All Statuses' }, { value: 'Active', label: 'Active' }, { value: 'Reward Eligible', label: 'Reward Eligible' }]} />
      </div>
      <ReportStatus loading={query.isLoading} error={query.error} retry={query.refetch} />
      {!query.error && query.data && <>
        <div className={styles.metrics}>
          <ReportMetric title="Total Customers" value={String(summary!.customers)} description="Customer profiles matching your filters" icon={<Users size={18} />} primary />
          <ReportMetric title="Reward Eligible" value={String(summary!.eligible)} description="With a redeemable loyalty reward" icon={<Gift size={18} />} />
          <ReportMetric title="Orders per Customer" value={summary!.customers ? (summary!.orders / summary!.customers).toFixed(1) : '\u2014'} description="Average across matching profiles" icon={<ShoppingCart size={18} />} />
          <ReportMetric title="Average Rating" value={reportRating(summary!.averageRating)} description="Weighted by submitted ratings" icon={<Star size={18} />} />
        </div>
        <div className={styles.panel}>
          <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>Customer directory</h3><p className={styles.panelSubtitle}>Household and commercial customer profiles</p></div><ReportScope label="All recorded activity" /></div>
          <ReportTable headers={['Customer', 'Contact', 'Branch', 'Orders', 'Loyalty', 'Rating', 'Last Order', '']} empty={!query.data.rows.length}>
            {query.data.rows.map(c => <tr key={c.id}>
              <td className={reportCell}><div className={styles.person}><span className={styles.avatar} aria-hidden="true">{c.name.split(' ').filter(Boolean).slice(0, 2).map(w => w[0]).join('')}</span><div><span className={styles.cellStrong}>{c.name}</span><span className={styles.subtext} title={c.id}>{c.code ?? 'Customer profile'}</span></div></div></td>
              <td className={reportCell}>{c.phone}</td><td className={reportCell}><span className={styles.badge}>{c.primaryBranch}</span></td>
              <td className={reportCell}><span className={styles.cellStrong}>{c.totalOrders}</span></td>
              <td className={reportCell}><span className={styles.cellStrong}>{c.accountType === 'household' ? c.loyaltyPoints + ' points' : c.loyaltyPoints + '/30 purchases'}</span><span className={styles.subtext}>{c.accountType === 'household' ? 'Household' : 'Commercial'}</span>{c.rewardEligible && <span className={styles.badge + ' ' + styles.badgeAmber}>Reward eligible</span>}</td>
              <td className={reportCell}>{c.avgRating === null ? <span className={styles.subtext}>No ratings</span> : <span className={styles.rating}><Star size={12} aria-hidden="true" />{reportRating(c.avgRating)}</span>}</td>
              <td className={reportCell}>{reportDate(c.lastOrder)}</td>
              <td className={reportCell}><button className={styles.linkButton} onClick={() => onViewCustomer(c.id)}>View<ArrowUpRight size={14} aria-hidden="true" /></button></td>
            </tr>)}
          </ReportTable>
          <ReportPager page={page} total={query.data.total} onChange={setPage} />
        </div>
      </>}
    </div>
  </div>;
}
