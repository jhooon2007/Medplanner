import React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "destructive" | "accent" | "blue"
  size?: "default" | "sm" | "lg" | "icon"
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    const variantStyles = {
      default: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 active:scale-[0.98]",
      blue: "bg-blue-600 text-white hover:bg-blue-700 shadow-sm shadow-blue-500/20 active:scale-[0.98]",
      secondary: "bg-slate-100 text-slate-900 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 active:scale-[0.98]",
      outline: "border border-slate-200 dark:border-slate-800 bg-transparent hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 active:scale-[0.98]",
      ghost: "hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 active:scale-[0.98]",
      destructive: "bg-rose-600 text-white hover:bg-rose-700 shadow-sm shadow-rose-500/20 active:scale-[0.98]",
      accent: "bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-950/50 dark:text-blue-300 dark:hover:bg-blue-900/60 active:scale-[0.98]",
    }[variant]

    const sizeStyles = {
      default: "h-10 px-4 py-2 text-sm",
      sm: "h-8 px-3 text-xs rounded-lg",
      lg: "h-11 px-6 text-base rounded-xl",
      icon: "h-9 w-9 p-0",
    }[size]

    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-lg font-medium transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer",
          variantStyles,
          sizeStyles,
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"
