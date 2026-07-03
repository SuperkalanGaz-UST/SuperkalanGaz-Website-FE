import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = "", style, ...props }: InputProps) {
  return (
    <input
      className={`input ${className}`}
      style={{
        display: "flex",
        height: "2.5rem",
        width: "100%",
        borderRadius: "0.375rem",
        border: "1px solid rgba(0,0,0,0.1)",
        backgroundColor: "white",
        padding: "0.5rem 0.75rem",
        fontSize: "0.875rem",
        outline: "none",
        ...style
      }}
      {...props}
    />
  );
}
