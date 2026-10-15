import React from "react"
import { cn } from "@/lib/utils"

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number // 0 to 100
  colorClassName?: string
}

export const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value, colorClassName = "bg-blue-600", ...props }, ref) => {
    const clamped = Math.min(100, Math.max(0, value || 0))
    return (
      <div
        ref={ref}
        className={cn(
          "relative h-2.5 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800",
          className
        )}
        {...props}
      >
        <div
          className={cn(
            "h-full w-full flex-1 transition-all duration-500 ease-out rounded-full",
            colorClassName
          )}
          style={{ transform: `translateX(-${100 - clamped}%)` }}
        />
      </div>
    )
  }
)
Progress.displayName = "Progress"
