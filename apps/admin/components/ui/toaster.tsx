"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * App-wide toasts. Use `toast.success("Salvo")`, `toast.error(msg)`,
 * `toast.promise(...)` anywhere in client components.
 */
export function Toaster() {
  return (
    <Sonner
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "rounded-xl border shadow-card-hover font-sans",
          title: "font-semibold",
        },
      }}
    />
  );
}

export { toast };
