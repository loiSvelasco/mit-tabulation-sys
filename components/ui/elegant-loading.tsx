"use client"

import { ReactNode } from "react"
import { cn } from "@/lib/utils"
import { Loader2, BarChart3, Calculator, TrendingUp } from "lucide-react"

interface ElegantLoadingProps {
  children: ReactNode
  isLoading: boolean
  loadingMessage?: string
  className?: string
}

export function ElegantLoading({ 
  children, 
  isLoading, 
  loadingMessage = "Calculating rankings...",
  className 
}: ElegantLoadingProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Main content */}
      <div className={cn(
        "transition-all duration-300 ease-in-out",
        isLoading ? "opacity-30 blur-sm scale-[0.98]" : "opacity-100 blur-0 scale-100"
      )}>
        {children}
      </div>

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/80 via-white/90 to-white/80 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center space-y-4">
            <div className="relative">
              <div className="w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-primary/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-primary border-t-transparent animate-spin"></div>
                <div className="absolute inset-2 rounded-full bg-primary/10 flex items-center justify-center">
                  <Calculator className="w-6 h-6 text-primary animate-pulse" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <p className="text-lg font-medium text-gray-700">{loadingMessage}</p>
              <div className="flex items-center justify-center space-x-1">
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Skeleton for ranking tables
export function RankingTableSkeleton({ 
  rows = 5, 
  columns = 4,
  className 
}: { 
  rows?: number
  columns?: number
  className?: string 
}) {
  return (
    <div className={cn("space-y-4", className)}>
      {/* Header skeleton */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-pulse"></div>
        ))}
      </div>
      
      {/* Rows skeleton with shimmer effect */}
      {Array.from({ length: rows }).map((_, rowIndex) => (
        <div 
          key={rowIndex} 
          className="grid gap-4 animate-pulse" 
          style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
        >
          {Array.from({ length: columns }).map((_, colIndex) => (
            <div 
              key={colIndex} 
              className="h-8 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded relative overflow-hidden"
              style={{ animationDelay: `${rowIndex * 0.1}s` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer"></div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// Progressive loading component
export function ProgressiveLoading({ 
  children, 
  isLoading, 
  stages = ["Loading data...", "Calculating scores...", "Generating rankings...", "Finalizing results..."],
  currentStage = 0,
  className 
}: { 
  children: ReactNode
  isLoading: boolean
  stages?: string[]
  currentStage?: number
  className?: string
}) {
  return (
    <div className={cn("relative", className)}>
      {/* Main content */}
      <div className={cn(
        "transition-all duration-500 ease-in-out",
        isLoading ? "opacity-20 scale-95" : "opacity-100 scale-100"
      )}>
        {children}
      </div>

      {/* Progressive loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50/90 via-white/95 to-purple-50/90 backdrop-blur-sm flex items-center justify-center z-20">
          <div className="text-center space-y-6 max-w-md">
            {/* Animated icon */}
            <div className="relative">
              <div className="w-20 h-20 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-blue-200"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <BarChart3 className="w-8 h-8 text-blue-600 animate-pulse" />
                </div>
              </div>
            </div>

            {/* Progress stages */}
            <div className="space-y-4">
              <div className="space-y-2">
                {stages.map((stage, index) => (
                  <div 
                    key={index}
                    className={cn(
                      "flex items-center space-x-3 transition-all duration-300",
                      index <= currentStage ? "opacity-100" : "opacity-50"
                    )}
                  >
                    <div className={cn(
                      "w-2 h-2 rounded-full transition-all duration-300",
                      index < currentStage ? "bg-green-500" : 
                      index === currentStage ? "bg-blue-500 animate-pulse" : "bg-gray-300"
                    )}></div>
                    <span className={cn(
                      "text-sm transition-all duration-300",
                      index <= currentStage ? "text-gray-700 font-medium" : "text-gray-400"
                    )}>
                      {stage}
                    </span>
                    {index < currentStage && (
                      <TrendingUp className="w-4 h-4 text-green-500 animate-bounce" />
                    )}
                  </div>
                ))}
              </div>

              {/* Progress bar */}
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div 
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${((currentStage + 1) / stages.length) * 100}%` }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Floating activity indicator
export function FloatingActivityIndicator({ 
  isActive, 
  message = "Updating rankings...",
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
      "fixed z-50 transition-all duration-300 ease-out",
      positionClasses[position],
      isActive ? "opacity-100 translate-y-0" : "opacity-0 translate-y-2"
    )}>
      <div className="bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-lg p-3 flex items-center space-x-3">
        <div className="relative">
          <div className="w-4 h-4 border-2 border-blue-200 rounded-full"></div>
          <div className="absolute inset-0 w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
        <span className="text-sm font-medium text-gray-700">{message}</span>
      </div>
    </div>
  )
}

// Add shimmer animation to global CSS
export const shimmerCSS = `
@keyframes shimmer {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(100%); }
}

.animate-shimmer {
  animation: shimmer 2s infinite;
}
`
