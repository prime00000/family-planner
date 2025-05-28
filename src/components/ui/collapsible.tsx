import * as React from "react";
import { cn } from "@/lib/utils";

interface CollapsibleContextValue {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | undefined>(
  undefined
);

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  defaultOpen?: boolean;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Collapsible({
  defaultOpen = false,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  children,
  ...props
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen);

  const open = controlledOpen ?? uncontrolledOpen;
  const onOpenChange = React.useCallback(
    (newOpen: boolean) => {
      setUncontrolledOpen(newOpen);
      controlledOnOpenChange?.(newOpen);
    },
    [controlledOnOpenChange]
  );

  return (
    <CollapsibleContext.Provider value={{ open, onOpenChange }}>
      <div {...props}>{children}</div>
    </CollapsibleContext.Provider>
  );
}

export const CollapsibleTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error("CollapsibleTrigger must be used within Collapsible");
  }

  return (
    <button
      ref={ref}
      className={cn(
        "flex w-full items-center justify-between px-4 py-2 text-sm font-medium transition-all hover:underline",
        className
      )}
      onClick={() => context.onOpenChange(!context.open)}
      {...props}
    >
      {children}
    </button>
  );
});
CollapsibleTrigger.displayName = "CollapsibleTrigger";

export const CollapsibleContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(CollapsibleContext);
  if (!context) {
    throw new Error("CollapsibleContent must be used within Collapsible");
  }

  return (
    <div
      ref={ref}
      className={cn(
        "overflow-hidden transition-all duration-200",
        context.open ? "max-h-screen" : "max-h-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
CollapsibleContent.displayName = "CollapsibleContent"; 