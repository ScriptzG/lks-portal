import * as ToastPrimitive from "@radix-ui/react-toast";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToastItem {
  id: number;
  title: string;
  description?: string;
  variant: "success" | "error" | "default";
}

interface ToastContextValue {
  toast: (params: { title: string; description?: string; variant?: ToastItem["variant"] }) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((params: { title: string; description?: string; variant?: ToastItem["variant"] }) => {
    const id = Date.now() + Math.random();
    setItems((prev) => [...prev, { id, variant: "default", ...params }]);
  }, []);

  return (
    <ToastContext.Provider value={{ toast }}>
      <ToastPrimitive.Provider swipeDirection="right">
        {children}
        {items.map((item) => (
          <ToastPrimitive.Root
            key={item.id}
            duration={4000}
            onOpenChange={(open) => {
              if (!open) setItems((prev) => prev.filter((t) => t.id !== item.id));
            }}
            className={cn(
              "relative flex items-start gap-3 overflow-hidden rounded-xl border bg-white/95 p-4 shadow-lifted backdrop-blur-sm",
              "data-[state=open]:animate-toast-in data-[state=closed]:animate-overlay-out",
              "data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)]",
              item.variant === "success" && "border-green-200",
              item.variant === "error" && "border-red-200",
              item.variant === "default" && "border-gray-200",
            )}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0 w-1",
                item.variant === "success" && "bg-green-500",
                item.variant === "error" && "bg-red-500",
                item.variant === "default" && "bg-brand-violet-500",
              )}
            />
            {item.variant === "success" && <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />}
            {item.variant === "error" && <XCircle className="h-5 w-5 text-red-600 shrink-0" />}
            <div className="flex-1">
              <ToastPrimitive.Title className="text-sm font-semibold text-gray-900">{item.title}</ToastPrimitive.Title>
              {item.description && (
                <ToastPrimitive.Description className="text-sm text-gray-500 mt-0.5">
                  {item.description}
                </ToastPrimitive.Description>
              )}
            </div>
            <ToastPrimitive.Close className="rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600">
              <X className="h-4 w-4" />
            </ToastPrimitive.Close>
          </ToastPrimitive.Root>
        ))}
        <ToastPrimitive.Viewport className="fixed bottom-0 right-0 z-[100] flex w-96 max-w-[100vw] flex-col gap-2 p-6" />
      </ToastPrimitive.Provider>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
