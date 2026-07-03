import React from "react";

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "primary" | "success" | "warning" | "destructive" | "outline" | "secondary" | "info";
}

export function Badge({ children, variant = "primary", className = "", style = {}, ...props }: BadgeProps & { style?: React.CSSProperties }) {
  const baseStyles = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2";
  
  return (
    <div
      className={`badge badge-${variant} ${className}`}
      {...props}
      style={{
        display: "inline-flex",
        alignItems: "center",
        borderRadius: "9999px",
        padding: "4px 12px",
        fontSize: "0.75rem",
        fontWeight: 600,
        ...getVariantStyles(variant),
        ...style
      }}
    >
      {children}
    </div>
  );
}

function getVariantStyles(variant: string) {
  switch (variant) {
    case "primary":
      return { backgroundColor: "rgba(0, 116, 188, 0.1)", color: "var(--primary)" };
    case "success":
      return { backgroundColor: "rgba(34, 197, 94, 0.1)", color: "var(--success)" };
    case "warning":
      return { backgroundColor: "rgba(245, 158, 11, 0.1)", color: "var(--warning)" };
    case "destructive":
      return { backgroundColor: "rgba(239, 68, 68, 0.1)", color: "var(--error)" };
    case "outline":
      return { border: "1px solid var(--border)", color: "inherit" };
    case "secondary":
      return { backgroundColor: "var(--secondary)", color: "var(--muted-foreground)" };
    case "info":
      return { backgroundColor: "rgba(0, 116, 188, 0.1)", color: "var(--primary)" };
    default:
      return {};
  }
}
