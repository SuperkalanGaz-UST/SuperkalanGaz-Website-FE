import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "outline" | "ghost" | "link" | "secondary" | "accent";
  size?: "default" | "sm" | "lg" | "icon" | "icon-sm";
}

export function Button({ children, variant = "primary", size = "default", className = "", style, ...props }: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "0.375rem",
    fontWeight: 500,
    fontSize: "0.875rem",
    cursor: "pointer",
    transition: "all 0.2s",
    border: "none",
    gap: "0.5rem",
  };

  const variantStyles = getVariantStyles(variant);
  const sizeStyles = getSizeStyles(size);

  return (
    <button
      className={`btn btn-${variant} btn-${size} ${className}`}
      style={{
        ...baseStyles,
        ...variantStyles,
        ...sizeStyles,
        ...style
      }}
      {...props}
    >
      {children}
    </button>
  );
}

function getVariantStyles(variant: string): React.CSSProperties {
  switch (variant) {
    case "primary":
      return { backgroundColor: "var(--primary, #0074bc)", color: "white" };
    case "outline":
      return { backgroundColor: "transparent", border: "1px solid rgba(0,0,0,0.1)", color: "inherit" };
    case "ghost":
      return { backgroundColor: "transparent", color: "inherit" };
    case "link":
      return { backgroundColor: "transparent", color: "var(--primary, #0074bc)", textDecoration: "underline", padding: 0 };
    case "secondary":
      return { backgroundColor: "var(--secondary)", color: "var(--secondary-foreground)" };
    case "accent":
      return { backgroundColor: "var(--accent)", color: "var(--accent-foreground)" };
    default:
      return {};
  }
}

function getSizeStyles(size: string): React.CSSProperties {
  switch (size) {
    case "sm":
      return { padding: "0.25rem 0.75rem", fontSize: "0.75rem" };
    case "lg":
      return { padding: "0.75rem 1.5rem", fontSize: "1rem" };
    case "icon":
      return { padding: "0.5rem", width: "2.5rem", height: "2.5rem" };
    case "icon-sm":
      return { padding: "0.25rem", width: "1.75rem", height: "1.75rem" };
    default:
      return { padding: "0.5rem 1rem" };
  }
}
