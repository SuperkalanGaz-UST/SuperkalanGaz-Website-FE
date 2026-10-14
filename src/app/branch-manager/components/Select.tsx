import React, { useState, createContext, useContext, useRef, useEffect } from "react";
import ReactDOM from "react-dom";
import { ChevronDown } from "lucide-react";

const SelectContext = createContext<any>(null);

export function Select({ children, value, onValueChange }: any) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  const openWithRect = () => {
    if (triggerRef.current) setRect(triggerRef.current.getBoundingClientRect());
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current && !triggerRef.current.contains(event.target as Node) &&
        contentRef.current && !contentRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  return (
    <SelectContext.Provider value={{ value, onValueChange, open, setOpen, triggerRef, contentRef, rect, openWithRect }}>
      <div style={{ position: "relative", width: "100%" }}>{children}</div>
    </SelectContext.Provider>
  );
}

export function SelectTrigger({ children, className = "", style, asChild = false, hideIcon = false }: any) {
  const { open, openWithRect, setOpen, triggerRef } = useContext(SelectContext);
  if (asChild) {
    return React.cloneElement(children, {
      onClick: () => open ? setOpen(false) : openWithRect(),
      style: { ...children.props.style, cursor: 'pointer' }
    });
  }
  return (
    <button
      ref={triggerRef}
      type="button"
      onClick={() => open ? setOpen(false) : openWithRect()}
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
        fontWeight: 400,
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
  if (!value) {
    return <span style={{ color: '#9ca3af', fontWeight: 400 }}>{placeholder}</span>;
  }
  return <span style={{ fontWeight: 400 }}>{value}</span>;
}

export function SelectContent({ children }: any) {
  const { open, rect, contentRef } = useContext(SelectContext);
  if (!open || !rect) return null;

  const dropdownStyle: React.CSSProperties = {
    position: "fixed",
    top: rect.bottom + 4,
    left: rect.left,
    width: rect.width,
    backgroundColor: "white",
    border: "1px solid rgba(0,0,0,0.1)",
    borderRadius: "0.375rem",
    boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.1)",
    zIndex: 9999,
    maxHeight: "200px",
    overflowY: "auto",
    padding: "0.25rem",
  };

  return ReactDOM.createPortal(
    <div ref={contentRef} style={dropdownStyle}>{children}</div>,
    document.body
  );
}

export function SelectItem({ children, value: itemValue, style }: any) {
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
        transition: "background-color 0.2s",
        ...style
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(0,0,0,0.05)")}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
    >
      {children}
    </div>
  );
}
