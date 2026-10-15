import React from "react"
import { cn } from "@/lib/utils"

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string | null
  alt?: string
  fallback: string
  size?: "sm" | "md" | "lg" | "xl"
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = "",
  fallback,
  size = "md",
  className,
  ...props
}) => {
  const [imageError, setImageError] = React.useState(false)

  const sizeStyles = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
    xl: "h-20 w-20 text-xl",
  }[size]

  return (
    <div
      className={cn(
        "relative flex shrink-0 overflow-hidden rounded-full border border-slate-200/80 bg-slate-100 dark:border-slate-800 dark:bg-slate-800",
        sizeStyles,
        className
      )}
      {...props}
    >
      {src && !imageError ? (
        <img
          src={src}
          alt={alt}
          onError={() => setImageError(true)}
          className="aspect-square h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full w-full items-center justify-center font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/70">
          {fallback.slice(0, 2).toUpperCase()}
        </div>
      )}
    </div>
  )
}

