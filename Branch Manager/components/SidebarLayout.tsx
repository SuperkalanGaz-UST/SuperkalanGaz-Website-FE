"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, ShoppingCart, Package, Users, Truck, BarChart3, ShieldCheck, Wrench } from "lucide-react";

const NAV_ITEMS = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/orders", label: "Orders", icon: ShoppingCart },
  { href: "/inventory", label: "Inventory", icon: Package },
  { href: "/customers", label: "Customers", icon: Users },
  { href: "/fleet", label: "Fleet", icon: Truck },
  { href: "/vehicles", label: "Vehicles", icon: Wrench },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  // { href: "/admin", label: "Admin", icon: ShieldCheck },
];

export default function SidebarLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", backgroundColor: "var(--background)" }}>
      {/* Sidebar */}
      <aside style={{
        width: "280px",
        backgroundColor: "var(--primary)",
        display: "flex",
        flexDirection: "column",
        padding: "1.5rem 1.25rem",
        color: "white"
      }}>
        <div style={{ 
          marginBottom: "2.5rem", 
          display: "flex", 
          justifyContent: "center",
          backgroundColor: "white",
          padding: "1rem",
          borderRadius: "0.75rem",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
        }}>
          <img src="/logo.png" alt="Superkalan Gaz Logo" style={{ width: "90%", height: "auto" }} />
        </div>

        <nav style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.875rem",
                  padding: "0.875rem 1rem",
                  borderRadius: "0.5rem",
                  textDecoration: "none",
                  color: isActive ? "var(--primary)" : "rgba(255, 255, 255, 0.75)",
                  backgroundColor: isActive ? "white" : "transparent",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "1.05rem",
                  transition: "all 0.2s"
                }}
              >
                <Icon size={22} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, padding: "2rem", overflowY: "auto" }}>
        {children}
      </main>
    </div>
  );
}
