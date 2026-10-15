import React from "react"
import { cn } from "@/lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "blue" | "teal"
}

export const Badge: React.FC<BadgeProps> = ({ className, variant = "default", ...props }) => {
  const variantStyles = {
    default: "border-transparent bg-blue-600 text-white",
    blue: "border-blue-200 dark:border-blue-800/60 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    teal: "border-blue-200 dark:border-blue-800/60 bg-blue-50 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    secondary: "border-transparent bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
    destructive: "border-rose-200 dark:border-rose-900 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:text-rose-300",
    success: "border-emerald-200 dark:border-emerald-900 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    warning: "border-amber-200 dark:border-amber-900 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:text-amber-300",
    outline: "text-slate-800 dark:text-slate-200 border-slate-300 dark:border-slate-700",
  }[variant]

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide transition-colors",
        variantStyles,
        className
      )}
      {...props}
    />
  )
}
