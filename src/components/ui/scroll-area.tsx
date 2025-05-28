import * as React from "react";
import { cn } from "@/lib/utils";

export interface ScrollAreaProps extends React.HTMLAttributes<HTMLDivElement> {
  orientation?: "vertical" | "horizontal";
  scrollHideDelay?: number;
}

export const ScrollArea = React.forwardRef<HTMLDivElement, ScrollAreaProps>(
  ({ className, children, orientation = "vertical", scrollHideDelay = 600, ...props }, ref) => {
    const [isScrolling, setIsScrolling] = React.useState(false);
    const scrollTimeout = React.useRef<NodeJS.Timeout | null>(null);

    const handleScroll = React.useCallback(() => {
      setIsScrolling(true);

      if (scrollTimeout.current) {
        clearTimeout(scrollTimeout.current);
      }

      scrollTimeout.current = setTimeout(() => {
        setIsScrolling(false);
      }, scrollHideDelay);
    }, [scrollHideDelay]);

    React.useEffect(() => {
      return () => {
        if (scrollTimeout.current) {
          clearTimeout(scrollTimeout.current);
        }
      };
    }, []);

    return (
      <div
        ref={ref}
        className={cn(
          "relative overflow-hidden",
          orientation === "horizontal" ? "h-full" : "w-full",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full overflow-auto scrollbar-thin scrollbar-track-transparent scrollbar-thumb-accent",
            orientation === "horizontal"
              ? "overflow-x-auto overflow-y-hidden"
              : "overflow-x-hidden overflow-y-auto",
            isScrolling && "scrollbar-thumb-accent/50"
          )}
          onScroll={handleScroll}
        >
          {children}
        </div>
      </div>
    );
  }
);
ScrollArea.displayName = "ScrollArea"; 