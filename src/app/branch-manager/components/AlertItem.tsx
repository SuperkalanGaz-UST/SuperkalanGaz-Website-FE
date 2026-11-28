'use client';

import { AlertTriangle, Info, Package } from 'lucide-react';
import styles from './AlertItem.module.css';

export type AlertSeverity = 'urgent' | 'warning' | 'info';

export interface AlertItemProps {
  severity: AlertSeverity;
  title: string;
  subtext?: string;
  count?: number;
  items?: readonly string[];
  actionLabel?: string;
  onPress?: () => void;
  href?: string;
  /** Expanded presentation for the existing "See all" dialog. */
  showAllItems?: boolean;
}

export function AlertItem({
  severity, title, subtext, count, items = [], actionLabel, onPress, href,
  showAllItems = false,
}: AlertItemProps) {
  const variant = severity === 'urgent' || severity === 'warning' ? severity : 'info';
  const Icon = variant === 'urgent' ? AlertTriangle : variant === 'warning' ? Package : Info;
  const visibleItems = showAllItems ? items : items.slice(0, 2);
  const remaining = items.length - visibleItems.length;
  const content = (
    <>
      <span className={styles.iconTile}><Icon size={16} aria-hidden="true" /></span>
      <span className={styles.body}>
        <span className={styles.heading}>
          <span className={styles.title}>{title}</span>
          {count != null && <span className={styles.count}>{count}</span>}
        </span>
        {subtext && <span className={styles.subtext}>{subtext}</span>}
        {visibleItems.length > 0 && (
          <span className={styles.items}>
            {visibleItems.map((item, index) => (
              <span key={`${item}-${index}`} className={styles.chip} title={item}>{item}</span>
            ))}
            {remaining > 0 && <span className={styles.more}>+{remaining} more</span>}
          </span>
        )}
        {actionLabel && <span className={styles.action}>{actionLabel}</span>}
      </span>
    </>
  );
  const className = `${styles.row} ${styles[variant]}`;
  // The collapsed "+N more" shares the row's existing navigation action.
  return href ? (
    <a href={href} onClick={onPress} className={className}>{content}</a>
  ) : (
    <button type="button" onClick={onPress} className={className}>{content}</button>
  );
}
