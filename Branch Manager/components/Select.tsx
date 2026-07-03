import React, { useState, createContext, useContext, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";

const SelectContext = createContext<any>(null);

export function Select({ children, value, onValueChange }: any) {
  const [open, setOpen] = useState(false);
  const selectRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (selectRef.current && !selectRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    } else {
      document.removeEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen }}>
      <div ref={selectRef} style={{ position: "relative", width: "100%" }}>{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children, className = "", style, asChild = false, hideIcon = false }: any) {
  const { open, setOpen } = useContext(SelectContext);
  if (asChild) {
    return React.cloneElement(children, {
      onClick: () => setOpen(!open),
      style: { ...children.props.style, cursor: 'pointer' }
    });
  }
  return (
    <button
      type="button"
      onClick={() => setOpen(!open)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        width: "100%",
        height: "2.5rem",
        padding: "0.5rem 0.75rem",
        borderRadius: "0.375rem",
        border: "1px solid rgba(0,0,0,0.1)",
        backgroundColor: "white",
        fontSize: "0.875rem",
        cursor: "pointer",
        ...style
      }}
    >
      {children}
      {!hideIcon && <ChevronDown size={16} style={{ opacity: 0.5 }} />}
    </button>
  );
}

export function SelectValue({ placeholder }: any) {
  const { value } = useContext(SelectContext);
  return <span>{value || placeholder}</span>;
}

export function SelectContent({ children }: any) {
  const { open } = useContext(SelectContext);
  if (!open) return null;
  return (
    <div
      style={{
        position: "absolute",
        top: "100%",
        left: 0,
        width: "100%",
        marginTop: "0.25rem",
        backgroundColor: "white",
        border: "1px solid rgba(0,0,0,0.1)",
        borderRadius: "0.375rem",
        boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
        zIndex: 50,
        maxHeight: "200px",
        overflowY: "auto",
        padding: "0.25rem"
      }}
    >
      {children}
    </div>
  );
}

export function SelectItem({ children, value: itemValue }: any) {
  const { onValueChange, setOpen } = useContext(SelectContext);
  return (
    <div
      onClick={() => {
        onValueChange(itemValue);
        setOpen(false);
      }}
      style={{
        padding: "0.5rem 0.75rem",
        fontSize: "0.875rem",
        cursor: "pointer",
        borderRadius: "0.25rem",
        transition: "background-color 0.2s"
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      {children}
    </div>
  );
}
