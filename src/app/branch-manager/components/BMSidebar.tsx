'use client';

import React from 'react';
import { LayoutDashboard, ShoppingCart, Package, Users, Truck, BarChart3, Wrench } from 'lucide-react';

/*
 * Ported from the standalone BM app's SidebarLayout. Route links (next/link +
 * usePathname) became screen-state navigation so the BM view can live inside
 * the single-page persona shell like the FA and BO views.
 */
const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'inventory', label: 'Inventory', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'fleet', label: 'Fleet', icon: Truck },
  { id: 'vehicles', label: 'Vehicles', icon: Wrench },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];

interface BMSidebarProps {
  activeScreen: string;
  onNavigate: (screen: string) => void;
}

export default function BMSidebar({ activeScreen, onNavigate }: BMSidebarProps) {
  return (
    <aside style={{
      width: '280px',
      backgroundColor: 'var(--primary)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.5rem 1.25rem',
      color: 'white',
      flexShrink: 0,
    }}>
      <div style={{
        marginBottom: '2.5rem',
        display: 'flex',
        justifyContent: 'center',
        backgroundColor: 'white',
        padding: '1rem',
        borderRadius: '0.75rem',
        boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      }}>
        <img src="/superkalan-gaz.png" alt="Superkalan Gaz Logo" style={{ width: '90%', height: 'auto' }} />
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
        {NAV_ITEMS.map((item) => {
          const isActive = activeScreen === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onNavigate(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.875rem',
                padding: '0.875rem 1rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: 'pointer',
                textAlign: 'left',
                color: isActive ? 'var(--primary)' : 'rgba(255, 255, 255, 0.75)',
                backgroundColor: isActive ? 'white' : 'transparent',
                fontWeight: isActive ? 600 : 500,
                fontSize: '1.05rem',
                transition: 'all 0.2s',
              }}
            >
              <Icon size={22} />
              {item.label}
            </button>
          );
        })}
      </nav>
    </aside>
  );
}
