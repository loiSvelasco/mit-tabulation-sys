"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"

interface SimpleLoadingProps {
  children: ReactNode
  isLoading: boolean
  className?: string
}

export function SimpleLoading({ 
  children, 
  isLoading, 
  className 
}: SimpleLoadingProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Main content with subtle transition */}
      <div className={cn(
        "transition-opacity duration-300 ease-in-out",
        isLoading ? "opacity-70" : "opacity-100"
      )}>
        {children}
      </div>

      {/* Simple loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center space-y-3">
            {/* Simple spinner */}
            <div className="w-6 h-6 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-gray-600">Updating...</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Simple activity indicator
export function SimpleActivityIndicator({ 
  isActive, 
  message = "Updating...",
  position = "top-right"
}: { 
  isActive: boolean
  message?: string
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left"
}) {
  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4", 
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4"
  }

  if (!isActive) return null

  return (
    <div className={cn(
      "fixed z-50 transition-all duration-200 ease-out",
      positionClasses[position],
      isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    )}>
      <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-md shadow-sm p-2 flex items-center space-x-2">
        <div className="w-3 h-3 border border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
        <span className="text-xs text-gray-600">{message}</span>
      </div>
    </div>
  )
}
