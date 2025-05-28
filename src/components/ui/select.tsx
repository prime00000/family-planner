import * as React from "react";
import { cn } from "@/lib/utils";

interface SelectContextValue {
  value?: string;
  onValueChange: (value: string) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SelectContext = React.createContext<SelectContextValue | undefined>(undefined);

export interface SelectProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (value: string) => void;
  defaultValue?: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Select({
  children,
  value,
  onValueChange,
  defaultValue,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  ...props
}: SelectProps) {
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false);

  const isControlled = value !== undefined;
  const currentValue = isControlled ? value : uncontrolledValue;
  const currentOpen = controlledOpen !== undefined ? controlledOpen : uncontrolledOpen;

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (!isControlled) {
        setUncontrolledValue(newValue);
      }
      onValueChange?.(newValue);
    },
    [isControlled, onValueChange]
  );

  const handleOpenChange = React.useCallback(
    (newOpen: boolean) => {
      if (controlledOpen === undefined) {
        setUncontrolledOpen(newOpen);
      }
      controlledOnOpenChange?.(newOpen);
    },
    [controlledOpen, controlledOnOpenChange]
  );

  return (
    <SelectContext.Provider
      value={{
        value: currentValue,
        onValueChange: handleValueChange,
        open: currentOpen,
        onOpenChange: handleOpenChange,
      }}
    >
      <div className={cn("relative", props.className)} {...props}>
        {children}
      </div>
    </SelectContext.Provider>
  );
}

export const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectTrigger must be used within Select");

  return (
    <button
      ref={ref}
      className={cn(
        "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      onClick={() => context.onOpenChange(!context.open)}
      {...props}
    >
      {children}
      <span className="ml-2">▼</span>
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

export const SelectContent = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectContent must be used within Select");

  if (!context.open) return null;

  return (
    <div
      ref={ref}
      className={cn(
        "absolute top-full z-50 mt-1 w-full rounded-md border bg-white p-1 shadow-md text-popover-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});
SelectContent.displayName = "SelectContent";

export interface SelectItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
}

export const SelectItem = React.forwardRef<HTMLButtonElement, SelectItemProps>(
  ({ className, children, value, ...props }, ref) => {
    const context = React.useContext(SelectContext);
    if (!context) throw new Error("SelectItem must be used within Select");

    const isSelected = context.value === value;

    return (
      <button
        ref={ref}
        className={cn(
          "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-2 pr-8 text-sm text-gray-900 outline-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
          isSelected && "bg-blue-100 text-gray-900",
          className
        )}
        onClick={() => {
          context.onValueChange(value);
          context.onOpenChange(false);
        }}
        {...props}
      >
        {children}
        {isSelected && (
          <span className="absolute right-2">✓</span>
        )}
      </button>
    );
  }
);
SelectItem.displayName = "SelectItem";

export const SelectValue = React.forwardRef<
  HTMLSpanElement,
  React.HTMLAttributes<HTMLSpanElement>
>(({ className, children, ...props }, ref) => {
  const context = React.useContext(SelectContext);
  if (!context) throw new Error("SelectValue must be used within Select");

  return (
    <span ref={ref} className={cn("block truncate", className)} {...props}>
      {children}
    </span>
  );
});
SelectValue.displayName = "SelectValue"; 