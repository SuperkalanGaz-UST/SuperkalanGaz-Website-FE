import React, { createContext, useContext, useRef, useState } from "react";

const FormContext = createContext<any>(null);

export function useForm<T extends Record<string, any>>({ defaultValues, schema }: { defaultValues: T, schema?: any }) {
  const [values, setValues] = useState<T>(defaultValues);
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Always-current ref so validateField never reads a stale closure.
  const valuesRef = useRef<T>(values);
  const setValuesAndSync: typeof setValues = (update) => {
    const next = typeof update === 'function' ? (update as any)(valuesRef.current) : update;
    valuesRef.current = next;
    setValues(next);
  };

  const validateField = (name: string, explicitValue?: any) => {
    if (!schema) return true;
    // Use explicit value if provided; otherwise read from the always-current ref.
    const valueToCheck = explicitValue !== undefined ? explicitValue : valuesRef.current[name];
    try {
      schema.parse({ ...valuesRef.current, [name]: valueToCheck });
      setErrors(prev => { const e = { ...prev }; delete e[name]; return e; });
      return true;
    } catch (err: any) {
      const fieldError = err.errors?.find((e: any) => e.path[0] === name);
      if (fieldError) {
        setErrors(prev => ({ ...prev, [name]: fieldError.message }));
        return false;
      }
      return true;
    }
  };

  const handleSubmit = (onSubmit: any) => (e: React.FormEvent) => {
    e.preventDefault();
    if (!schema) {
      onSubmit(valuesRef.current);
      return;
    }
    try {
      const parsed = schema.parse(valuesRef.current);
      setErrors({});
      onSubmit(parsed);
    } catch (err: any) {
      const newErrors: Record<string, string> = {};
      err.errors?.forEach((e: any) => {
        newErrors[e.path[0]] = e.message;
      });
      setErrors(newErrors);
    }
  };

  return {
    values,
    setValues: setValuesAndSync,
    errors,
    handleSubmit,
    validateField
  };
}

export function Form({ children, ...form }: any) {
  return <FormContext.Provider value={form}>{children}</FormContext.Provider>;
}

const FormItemContext = createContext<any>(null);

export function FormItem({ children, name, className = "" }: any) {
  return (
    <FormItemContext.Provider value={{ name }}>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1rem" }} className={className}>
        {children}
      </div>
    </FormItemContext.Provider>
  );
}

export function FormLabel({ children, className = "" }: any) {
  return (
    <label style={{ fontSize: "0.875rem", fontWeight: 500 }} className={className}>
      {children}
    </label>
  );
}

export function FormControl({ children }: any) {
  return <div style={{ marginTop: "0.25rem" }}>{children}</div>;
}

export function FormDescription({ children }: any) {
  return <p style={{ fontSize: "0.75rem", opacity: 0.6, marginTop: "0.25rem" }}>{children}</p>;
}

export function FormMessage() {
  const { name } = useContext(FormItemContext);
  const { errors } = useContext(FormContext);
  const error = errors?.[name];

  if (!error) return null;

  return <p style={{ fontSize: "0.75rem", color: "var(--error, #ef4444)", marginTop: "0.25rem" }}>{error}</p>;
}
