import { RewardStockRow } from '../../../lib/reward-inventory';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Progress } from '../../components/Progress';
import styles from './screen.module.css';

/** Reuses the Manager's stock-card presentation inside the reward inventory tab. */
export function RewardStockCards({ items, loading, error, onRetry }: {
  items: RewardStockRow[]; loading: boolean; error: string | null; onRetry: () => void;
}) {
  return (
    <section aria-label="Reward merchandise stock">
      <h2 className="sr-only">Reward Merchandise</h2>
      <div className={styles.stockCardsGrid}>
        {loading ? <div role="status" className={styles.emptyState}>Loading reward stock…</div>
          : error ? <div role="alert" className={styles.emptyState}>{error} <Button variant="secondary" onClick={onRetry}>Try again</Button></div>
            : items.length === 0 ? <div className={styles.emptyState}>No reward items yet</div>
              : items.map(item => {
                const critical = item.current_qty <= item.threshold_qty;
                const warning = !critical && item.current_qty <= item.threshold_qty * 1.5;
                const color = critical ? 'var(--error)' : warning ? 'var(--warning)' : 'var(--success)';
                return (
                  <div key={item.catalog_item_id} className={styles.stockCard}>
                    <div className={styles.stockCardHeader}>
                      <h3 className={styles.stockCardTitle}>{item.item_name}</h3>
                      <span className={styles.stockCardValues}><span className={styles.stockCurrent}>{item.current_qty}</span><span className={styles.stockCapacity}>/ {item.capacity_qty}</span></span>
                    </div>
                    <p className={`${styles.stockCardMeta} ${styles.mutedText}`}>{item.points_cost} points</p>
                    <div className={styles.gaugeContainer} style={{ '--primary': color } as React.CSSProperties}>
                      <Progress value={Math.min(item.current_qty / Math.max(item.capacity_qty, 1) * 100, 100)} />
                    </div>
                    <div className={styles.stockCardFooter}>
                      <span className={styles.thresholdLabel}>Threshold: {item.threshold_qty}</span>
                      {item.current_qty === 0 ? <Badge variant="destructive" className={styles.alertBadge}>Out of Stock</Badge>
                        : critical ? <Badge variant="destructive" className={styles.alertBadge}>Critical</Badge>
                          : warning ? <Badge variant="warning" className={styles.alertBadge}>Low Stock</Badge>
                            : <Badge variant="success" className={styles.alertBadge}>In Stock</Badge>}
                    </div>
                  </div>
                );
              })}
      </div>
    </section>
  );
}
