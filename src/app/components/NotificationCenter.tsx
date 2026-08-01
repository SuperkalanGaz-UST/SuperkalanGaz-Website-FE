'use client';

import { ComponentType, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bell,
  Building2,
  ClipboardCheck,
  Gift,
  MessageSquareWarning,
  Package,
  Tag,
} from 'lucide-react';
import { apiErrorMessage, apiFetch } from '../lib/api';

type NotificationType =
  | 'price-update'
  | 'customer-complaint'
  | 'branch-approval'
  | 'service-request'
  | 'loyalty-redemption'
  | 'inventory-alert'
  | 'system';

interface NotificationItem {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  branch_id: string | null;
  created_at: string;
  is_read: boolean;
}

interface NotificationsResponse {
  notifications: NotificationItem[];
  unread_count: number;
}

const TYPE_ICONS: Record<NotificationType, ComponentType<{ className?: string }>> = {
  'price-update': Tag,
  'customer-complaint': MessageSquareWarning,
  'branch-approval': Building2,
  'service-request': ClipboardCheck,
  'loyalty-redemption': Gift,
  'inventory-alert': Package,
  system: Bell,
};

function relativeTime(value: string): string {
  const timestamp = new Date(value).getTime();
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return 'Just now';

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr${hours === 1 ? '' : 's'} ago`;

  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? '' : 's'} ago`;

  return new Intl.DateTimeFormat('en-PH', {
    month: 'short',
    day: 'numeric',
  }).format(new Date(value));
}

/**
 * Shared FA/BO/BM notification control. Audience filtering is intentionally not
 * done here: the NestJS API derives role + branch scope from the verified JWT.
 */
export function NotificationCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const loadNotifications = useCallback(async () => {
    try {
      const response = await apiFetch('/notifications?limit=50');
      const data = (await response.json().catch(() => null)) as NotificationsResponse | null;
      if (!response.ok || !data) {
        throw new Error(apiErrorMessage(data, 'Could not load notifications.'));
      }

      setNotifications(data.notifications);
      setUnreadCount(data.unread_count);
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load notifications.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadNotifications();
    const interval = window.setInterval(() => void loadNotifications(), 60_000);
    const handleRefresh = () => void loadNotifications();
    window.addEventListener('notifications:refresh', handleRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('notifications:refresh', handleRefresh);
    };
  }, [loadNotifications]);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setIsExpanded(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
        setIsExpanded(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const visibleNotifications = useMemo(
    () => (isExpanded ? notifications : notifications.slice(0, 4)),
    [isExpanded, notifications],
  );

  async function markRead(notification: NotificationItem) {
    if (notification.is_read) return;

    setNotifications((items) =>
      items.map((item) => (item.id === notification.id ? { ...item, is_read: true } : item)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));

    const response = await apiFetch(`/notifications/${notification.id}/read`, { method: 'POST' });
    if (!response.ok) void loadNotifications();
  }

  async function markAllRead() {
    if (unreadCount === 0) return;

    const response = await apiFetch('/notifications/read-all', { method: 'POST' });
    if (!response.ok) {
      void loadNotifications();
      return;
    }

    setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
    setUnreadCount(0);
  }

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        onClick={() => {
          setIsOpen((open) => !open);
          if (!isOpen) void loadNotifications();
        }}
        className="relative flex h-8 w-8 items-center justify-center text-[#007BC1] transition-colors hover:text-[#00639b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007BC1]/30 rounded-full"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
        aria-expanded={isOpen}
      >
        <Bell aria-hidden="true" className="h-5 w-5" strokeWidth={1.9} />
        {unreadCount > 0 && (
          <span className="absolute right-[-1px] top-[-2px] flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold leading-none text-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <section
          aria-label="Notifications"
          className="absolute right-0 top-full z-[60] mt-2 w-[min(25rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl"
        >
          <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
            <h2 className="text-sm font-semibold text-gray-900">Notifications</h2>
            <button
              type="button"
              onClick={() => void markAllRead()}
              disabled={unreadCount === 0}
              className="text-xs font-medium text-[#007BC1] hover:text-[#00639b] disabled:cursor-default disabled:text-gray-400"
            >
              Mark all as read
            </button>
          </div>

          <div className={isExpanded ? 'max-h-[28rem] overflow-y-auto' : undefined}>
            {isLoading && notifications.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-500">Loading notifications…</p>
            ) : error && notifications.length === 0 ? (
              <div className="px-5 py-7 text-center">
                <p className="text-sm text-gray-500">{error}</p>
                <button
                  type="button"
                  onClick={() => void loadNotifications()}
                  className="mt-2 text-xs font-semibold text-[#007BC1]"
                >
                  Try again
                </button>
              </div>
            ) : visibleNotifications.length === 0 ? (
              <p className="px-5 py-8 text-center text-sm text-gray-500">You&apos;re all caught up.</p>
            ) : (
              visibleNotifications.map((notification) => {
                const Icon = TYPE_ICONS[notification.type] ?? Bell;
                return (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => void markRead(notification)}
                    className={`grid w-full grid-cols-[2rem_minmax(0,1fr)_5rem] gap-3 border-b border-gray-100 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-gray-50 ${
                      notification.is_read ? 'bg-white' : 'bg-[#007BC1]/[0.055]'
                    }`}
                  >
                    <span className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-[#007BC1]/[0.07] text-[#007BC1]">
                      <Icon aria-hidden="true" className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={`block truncate text-xs text-gray-900 ${
                          notification.is_read ? 'font-medium' : 'font-semibold'
                        }`}
                      >
                        {notification.title}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-4 text-gray-500">
                        {notification.message}
                      </span>
                    </span>
                    <span className="flex items-start justify-end gap-2 whitespace-nowrap pt-0.5 text-[10px] text-gray-500">
                      {relativeTime(notification.created_at)}
                      {!notification.is_read && (
                        <span
                          aria-label="Unread"
                          className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#007BC1]"
                        />
                      )}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {notifications.length > 4 && (
            <button
              type="button"
              onClick={() => setIsExpanded((expanded) => !expanded)}
              className="w-full border-t border-gray-100 px-4 py-3 text-center text-xs font-semibold text-[#007BC1] hover:bg-gray-50"
            >
              {isExpanded ? 'Show recent notifications' : 'View all notifications'}
            </button>
          )}
        </section>
      )}
    </div>
  );
}
