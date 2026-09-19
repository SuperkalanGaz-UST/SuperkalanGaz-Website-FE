import React from "react";
import { ResponsiveContainer, Tooltip, Legend } from "recharts";

export function ChartContainer({ children, config, className = "", style }: any) {
  return (
    <div className={`chart-container ${className}`} style={{ width: "100%", height: "100%", minHeight: "100%", ...style }}>
      {/* Inject colors from config into CSS variables if needed */}
      <style dangerouslySetInnerHTML={{ __html: `
        :root {
          ${Object.entries(config || {}).map(([key, val]: any) => `--color-${key}: ${val.color};`).join("\n")}
        }
      `}} />
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

// Recharts identifies its special children (Tooltip, Legend, ...) by checking
// `child.type` against its own component references *before* rendering
// anything — so these must be direct aliases, not wrapping function
// components, or Recharts never recognizes them and hover never activates.
export const ChartTooltip = Tooltip;

export function ChartTooltipContent({ active, payload, label, hideLabel, indicator = "dot" }: any) {
  if (!active || !payload) return null;

  return (
    <div style={{ backgroundColor: "white", border: "1px solid rgba(0,0,0,0.1)", padding: "0.5rem", borderRadius: "0.375rem", boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)" }}>
      {!hideLabel && <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>{label}</div>}
      {payload.map((item: any, i: number) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
          {indicator === "dot" && <div style={{ width: "0.5rem", height: "0.5rem", borderRadius: "50%", backgroundColor: item.color || item.fill }} />}
          <span>{item.name}:</span>
          <span style={{ fontWeight: 600 }}>{item.value}</span>
        </div>
      ))}
    </div>
  );
}

export const ChartLegend = Legend;

export function ChartLegendContent({ payload }: any) {
    if (!payload) return null;
    return (
        <div style={{ display: "flex", justifyContent: "center", gap: "1rem", marginTop: "1rem" }}>
            {payload.map((entry: any, index: number) => (
                <div key={index} style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.875rem", color: "var(--foreground, #000)" }}>
                    <div style={{ width: "0.75rem", height: "0.75rem", borderRadius: "2px", backgroundColor: entry.color || entry.payload?.fill }} />
                    <span style={{ fontWeight: 500 }}>{entry.value || entry.payload?.name}</span>
                </div>
            ))}
        </div>
    );
}
