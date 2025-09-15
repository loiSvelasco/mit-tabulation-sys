"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SmoothTransitionProps {
  children: ReactNode
  className?: string
  isUpdating?: boolean
}

export function SmoothTransition({ 
  children, 
  className,
  isUpdating = false
}: SmoothTransitionProps) {
  return (
    <div 
      className={cn(
        "transition-all duration-200 ease-in-out",
        isUpdating ? "opacity-98 scale-[0.999]" : "opacity-100 scale-100",
        className
      )}
    >
      {children}
    </div>
  )
}

