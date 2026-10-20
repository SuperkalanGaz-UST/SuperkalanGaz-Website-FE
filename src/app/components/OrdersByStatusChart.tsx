import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { ReportEmpty } from './FranchiseReportUi';
import styles from './FranchiseReports.module.css';

const COLORS: Record<string, string> = {
  Delivered: '#10b981', Cancelled: '#ef4444', Pending: '#f59e0b',
  Dispatched: '#76B4DD', 'En Route': '#007BC1', 'Under Review': '#9ca3af',
};

export function OrdersByStatusChart({ data }: { data: { name: string; count: number }[] }) {
  return <div className={styles.panel}>
    <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>Orders by status</h3><p className={styles.panelSubtitle}>Current month across the selected branches</p></div></div>
    {!data.length ? <ReportEmpty title="No order activity yet" hint="The status breakdown will appear once orders are recorded." /> : <>
      <div className={styles.chartBody}><ResponsiveContainer width="100%" height={215}>
        <PieChart><Pie data={data} innerRadius={60} outerRadius={85} paddingAngle={3} dataKey="count" stroke="none">
          {data.map(entry => <Cell key={entry.name} fill={COLORS[entry.name] ?? '#9ca3af'} />)}
        </Pie><Tooltip contentStyle={{ border: '1px solid #e5eaf0', borderRadius: 10, fontSize: 12 }} /></PieChart>
      </ResponsiveContainer></div>
      <div className={styles.legend}>{data.map(entry => <span key={entry.name} className={styles.legendItem}><span className={styles.legendDot} style={{ backgroundColor: COLORS[entry.name] ?? '#9ca3af' }} />{entry.name}<strong className="font-medium text-gray-700">{entry.count}</strong></span>)}</div>
    </>}
  </div>;
}
