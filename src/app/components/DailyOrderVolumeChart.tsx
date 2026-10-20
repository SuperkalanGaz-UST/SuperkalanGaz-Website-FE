import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { ReportEmpty } from './FranchiseReportUi';
import styles from './FranchiseReports.module.css';

export function DailyOrderVolumeChart({ data }: { data: { day: string; orders: number }[] }) {
  return <div className={styles.panel}>
    <div className={styles.panelHeader}><div><h3 className={styles.panelTitle}>Daily order volume</h3><p className={styles.panelSubtitle}>Service requests by day, current month</p></div></div>
    {!data.length ? <ReportEmpty title="No orders this month" hint="Orders will appear here as service requests are recorded." /> : <div className={styles.chartBody}><ResponsiveContainer width="100%" height={250}>
      <BarChart data={data} margin={{ top: 12, right: 8, left: -18, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#edf1f5" vertical={false} />
        <XAxis dataKey="day" axisLine={false} tickLine={false} stroke="#94a3b8" tickFormatter={v => String(v).slice(-2)} style={{ fontSize: '11px' }} tickMargin={10} />
        <YAxis axisLine={false} tickLine={false} stroke="#94a3b8" allowDecimals={false} style={{ fontSize: '11px' }} />
        <Tooltip cursor={{ fill: '#edf6fc' }} contentStyle={{ border: '1px solid #e5eaf0', borderRadius: 10, fontSize: 12 }} formatter={value => [value, 'Orders']} />
        <Bar dataKey="orders" fill="#007BC1" radius={[4, 4, 0, 0]} maxBarSize={32} />
      </BarChart>
    </ResponsiveContainer></div>}
  </div>;
}
