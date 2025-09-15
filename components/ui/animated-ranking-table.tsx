"use client"

import { ReactNode, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Minus } from "lucide-react"

interface AnimatedRankingTableProps {
  children: ReactNode
  isUpdating: boolean
  className?: string
}

export function AnimatedRankingTable({ 
  children, 
  isUpdating, 
  className 
}: AnimatedRankingTableProps) {
  return (
    <div className={cn("relative", className)}>
      {/* Main table with smooth transitions */}
      <div className={cn(
        "transition-all duration-500 ease-in-out",
        isUpdating ? "opacity-60 scale-[0.98] blur-[1px]" : "opacity-100 scale-100 blur-0"
      )}>
        {children}
      </div>

      {/* Elegant loading overlay */}
      {isUpdating && (
        <div className="absolute inset-0 bg-gradient-to-br from-white/85 via-blue-50/90 to-white/85 backdrop-blur-sm flex items-center justify-center z-10">
          <div className="text-center space-y-6">
            {/* Animated calculation icon */}
            <div className="relative">
              <div className="w-16 h-16 mx-auto">
                <div className="absolute inset-0 rounded-full border-4 border-blue-200 animate-pulse"></div>
                <div className="absolute inset-0 rounded-full border-4 border-blue-500 border-t-transparent animate-spin"></div>
                <div className="absolute inset-2 rounded-full bg-gradient-to-br from-blue-100 to-purple-100 flex items-center justify-center">
                  <TrendingUp className="w-6 h-6 text-blue-600 animate-bounce" />
                </div>
              </div>
            </div>

            {/* Loading message with typewriter effect */}
            <div className="space-y-2">
              <p className="text-lg font-semibold text-gray-700 animate-pulse">
                Recalculating Rankings
              </p>
              <div className="flex items-center justify-center space-x-1">
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce"></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Animated number component for smooth score transitions
interface AnimatedNumberProps {
  value: number
  duration?: number
  className?: string
  precision?: number
}

export function AnimatedNumber({ 
  value, 
  duration = 1000, 
  className,
  precision = 2
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState(value)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (displayValue !== value) {
      setIsAnimating(true)
      
      const startValue = displayValue
      const endValue = value
      const startTime = Date.now()
      
      const animate = () => {
        const elapsed = Date.now() - startTime
        const progress = Math.min(elapsed / duration, 1)
        
        // Easing function for smooth animation
        const easeOutCubic = 1 - Math.pow(1 - progress, 3)
        const currentValue = startValue + (endValue - startValue) * easeOutCubic
        
        setDisplayValue(currentValue)
        
        if (progress < 1) {
          requestAnimationFrame(animate)
        } else {
          setIsAnimating(false)
        }
      }
      
      requestAnimationFrame(animate)
    }
  }, [value, duration])

  return (
    <span className={cn(
      "transition-all duration-200",
      isAnimating && "text-blue-600 font-semibold scale-110",
      className
    )}>
      {displayValue.toFixed(precision)}
    </span>
  )
}

// Animated rank change indicator
interface RankChangeProps {
  oldRank?: number
  newRank: number
  className?: string
}

export function RankChange({ 
  oldRank, 
  newRank, 
  className 
}: RankChangeProps) {
  if (!oldRank || oldRank === newRank) {
    return (
      <span className={cn("text-gray-400", className)}>
        <Minus className="w-3 h-3" />
      </span>
    )
  }

  const isImprovement = newRank < oldRank
  const change = oldRank - newRank

  return (
    <div className={cn(
      "flex items-center space-x-1 transition-all duration-300",
      isImprovement ? "text-green-600" : "text-red-600",
      className
    )}>
      {isImprovement ? (
        <TrendingUp className="w-3 h-3" />
      ) : (
        <TrendingDown className="w-3 h-3" />
      )}
      <span className="text-xs font-medium">
        {change > 0 ? `+${change}` : change}
      </span>
    </div>
  )
}

// Staggered row animation wrapper
interface StaggeredRowProps {
  children: ReactNode
  index: number
  isVisible: boolean
  className?: string
}

export function StaggeredRow({ 
  children, 
  index, 
  isVisible, 
  className 
}: StaggeredRowProps) {
  return (
    <div className={cn(
      "transition-all duration-500 ease-out",
      isVisible 
        ? "opacity-100 translate-y-0 scale-100" 
        : "opacity-0 translate-y-4 scale-95",
      className
    )}
    style={{ 
      transitionDelay: `${index * 100}ms` 
    }}>
      {children}
    </div>
  )
}

// Loading skeleton for individual table cells
export function AnimatedTableCell({ 
  children, 
  isLoading, 
  className 
}: { 
  children: ReactNode
  isLoading: boolean
  className?: string
}) {
  return (
    <td className={cn("relative", className)}>
      {isLoading ? (
        <div className="h-6 bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 rounded animate-pulse relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/50 to-transparent animate-shimmer"></div>
        </div>
      ) : (
        <div className="transition-all duration-300 ease-in-out">
          {children}
        </div>
      )}
    </td>
  )
}

// Progress indicator for calculation stages
interface CalculationProgressProps {
  currentStage: number
  totalStages: number
  stages: string[]
  className?: string
}

export function CalculationProgress({ 
  currentStage, 
  totalStages, 
  stages, 
  className 
}: CalculationProgressProps) {
  const progress = ((currentStage + 1) / totalStages) * 100

  return (
    <div className={cn("space-y-3", className)}>
      {/* Progress bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
        <div 
          className="h-full bg-gradient-to-r from-blue-500 via-purple-500 to-green-500 rounded-full transition-all duration-500 ease-out relative"
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
        </div>
      </div>

      {/* Stage indicators */}
      <div className="flex justify-between text-xs text-gray-600">
        {stages.map((stage, index) => (
          <div 
            key={index}
            className={cn(
              "transition-all duration-300",
              index <= currentStage ? "text-blue-600 font-medium" : "text-gray-400"
            )}
          >
            {stage}
          </div>
        ))}
      </div>
    </div>
  )
}
