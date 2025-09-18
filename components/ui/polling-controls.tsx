"use client"

import React from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Pause, Play, RefreshCw, Clock } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface PollingControlsProps {
  isPolling: boolean
  isPaused: boolean
  lastUpdate: Date | null
  onPause: () => void
  onResume: () => void
  onRefresh: () => void
  isRefreshing?: boolean
  className?: string
}

export function PollingControls({
  isPolling,
  isPaused,
  lastUpdate,
  onPause,
  onResume,
  onRefresh,
  isRefreshing = false,
  className = ""
}: PollingControlsProps) {
  const formatLastUpdate = (date: Date | null) => {
    if (!date) return "Never"
    
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffSeconds = Math.floor(diffMs / 1000)
    const diffMinutes = Math.floor(diffSeconds / 60)
    
    if (diffSeconds < 60) {
      return `${diffSeconds}s ago`
    } else if (diffMinutes < 60) {
      return `${diffMinutes}m ago`
    } else {
      return date.toLocaleTimeString()
    }
  }

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* Polling Status Badge */}
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={isPaused ? "secondary" : isPolling ? "default" : "outline"}
              className="flex items-center gap-1"
            >
              <div className={`w-2 h-2 rounded-full ${
                isPaused ? "bg-yellow-500" : isPolling ? "bg-green-500 animate-pulse" : "bg-gray-400"
              }`} />
              {isPaused ? "Paused" : isPolling ? "Live" : "Offline"}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isPaused 
                ? "Polling is paused. Click resume to start automatic updates."
                : isPolling 
                  ? "Automatic updates every 15 seconds"
                  : "No automatic updates"
              }
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Last Updated Time */}
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <Clock className="w-3 h-3" />
        <span>Updated {formatLastUpdate(lastUpdate)}</span>
      </div>

      {/* Control Buttons */}
      <div className="flex items-center gap-1">
        {/* Pause/Resume Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={isPaused ? onResume : onPause}
                className="h-7 px-2"
              >
                {isPaused ? (
                  <Play className="w-3 h-3" />
                ) : (
                  <Pause className="w-3 h-3" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>{isPaused ? "Resume automatic updates" : "Pause automatic updates"}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Manual Refresh Button */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                onClick={onRefresh}
                disabled={isRefreshing}
                className="h-7 px-2"
              >
                <RefreshCw className={`w-3 h-3 ${isRefreshing ? "animate-spin" : ""}`} />
              </Button>
            </TooltipTrigger>
            <TooltipContent>
              <p>Refresh data now</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    </div>
  )
}
