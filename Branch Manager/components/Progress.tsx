import React from "react";

interface ProgressProps {
  value?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function Progress({ value = 0, className = "", style }: ProgressProps) {
  return (
    <div
      className={`progress-root ${className}`}
      style={{
        position: "relative",
        height: "0.5rem",
        width: "100%",
        overflow: "hidden",
        borderRadius: "9999px",
        backgroundColor: "rgba(0,0,0,0.05)",
        ...style
      }}
    >
      <div
        className="progress-indicator"
        style={{
          height: "100%",
          width: `${value}%`,
          flex: 1,
          backgroundColor: "var(--primary, #3b82f6)",
          transition: "all 0.4s ease-in-out",
        }}
      />
    </div>
  );
}
