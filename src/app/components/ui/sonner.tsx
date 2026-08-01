"use client";

import { CircleCheck, CircleX } from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ className, icons, style, toastOptions, ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className={`toaster group crm-toaster ${className ?? ""}`.trim()}
      richColors
      position="top-center"
      offset={{ top: 24 }}
      gap={10}
      icons={{
        success: <CircleCheck aria-hidden="true" className="h-[18px] w-[18px]" />,
        error: <CircleX aria-hidden="true" className="h-[18px] w-[18px]" />,
        ...icons,
      }}
      toastOptions={{
        duration: 4000,
        ...toastOptions,
        classNames: {
          toast: "crm-toast",
          title: "crm-toast__title",
          icon: "crm-toast__icon",
          ...toastOptions?.classNames,
        },
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--success-bg": "#ecfdf3",
          "--success-border": "#abefc6",
          "--success-text": "#067647",
          "--error-bg": "#fef3f2",
          "--error-border": "#fecdca",
          "--error-text": "#b42318",
          "--border-radius": "8px",
          "--width": "min(460px, calc(100vw - 32px))",
          ...style,
        } as React.CSSProperties
      }
      {...props}
    />
  );
};

export { Toaster };
