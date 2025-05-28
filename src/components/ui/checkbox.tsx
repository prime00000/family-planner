import * as React from "react";
import { cn } from "@/lib/utils";

export interface CheckboxProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label?: string;
  error?: string;
  onCheckedChange?: (checked: boolean) => void;
}

export const Checkbox = React.forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, error, onCheckedChange, ...props }, ref) => {
    const id = React.useId();
    
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      onCheckedChange?.(e.target.checked);
    };
    
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id={id}
            ref={ref}
            onChange={handleChange}
            className={cn(
              "h-4 w-4 rounded border border-gray-300 bg-white text-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
              className
            )}
            {...props}
          />
          {label && (
            <label
              htmlFor={id}
              className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
            >
              {label}
            </label>
          )}
        </div>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);
Checkbox.displayName = "Checkbox";