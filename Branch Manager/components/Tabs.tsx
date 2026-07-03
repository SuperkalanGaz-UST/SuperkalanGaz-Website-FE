import React, { createContext, useContext } from "react";

const TabsContext = createContext<any>(null);

export function Tabs({ children, value, onValueChange }: any) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className="tabs-root">{children}</div>
    </TabsContext.Provider>
  );
}

export function TabsList({ children, className = "" }: any) {
  return (
    <div
      style={{
        display: "inline-flex",
        height: "2.5rem",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "0.375rem",
        backgroundColor: "rgba(0,0,0,0.05)",
        padding: "0.25rem",
        color: "rgba(0,0,0,0.6)"
      }}
      className={className}
    >
      {children}
    </div>
  );
}

export function TabsTrigger({ children, value: itemValue }: any) {
  const { value, onValueChange } = useContext(TabsContext);
  const isActive = value === itemValue;

  return (
    <button
      onClick={() => onValueChange(itemValue)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        whiteSpace: "nowrap",
        borderRadius: "0.25rem",
        padding: "0.25rem 0.75rem",
        fontSize: "0.875rem",
        fontWeight: 500,
        transition: "all 0.2s",
        backgroundColor: isActive ? "white" : "transparent",
        color: isActive ? "black" : "inherit",
        border: "none",
        cursor: "pointer",
        boxShadow: isActive ? "0 1px 3px 0 rgba(0, 0, 0, 0.1)" : "none"
      }}
    >
      {children}
    </button>
  );
}
