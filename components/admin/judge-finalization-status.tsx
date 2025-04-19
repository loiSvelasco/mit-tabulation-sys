"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "sonner"

interface JudgeFinalizationStatusProps {
  competitionId: string | number
  segmentId?: string
}

interface JudgeFinalization {
  id: string
  judge_id: string
  judge_name: string
  segment_id: string
  finalized: boolean
  finalized_at: string | null
}

export function JudgeFinalizationStatus({ competitionId, segmentId }: JudgeFinalizationStatusProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [judgeStatus, setJudgeStatus] = useState<JudgeFinalization[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const fetchJudgeStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      let url = `/api/judge/finalize?competitionId=${competitionId}`
      if (segmentId) {
        url += `&segmentId=${segmentId}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch judge status: ${response.status}`)
      }

      const data = await response.json()
      setJudgeStatus(data)
    } catch (err) {
      console.error("Error fetching judge finalization status:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (competitionId) {
      fetchJudgeStatus()

      // Set up polling every 10 seconds
      const interval = setInterval(fetchJudgeStatus, 10000)
      return () => clearInterval(interval)
    }
  }, [competitionId, segmentId])

  // Calculate completion percentage
  const totalJudges = judgeStatus.length
  const finalizedJudges = judgeStatus.filter((judge) => judge.finalized).length
  const completionPercentage = totalJudges > 0 ? Math.round((finalizedJudges / totalJudges) * 100) : 0

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-md p-2 text-sm text-red-800 flex items-center">
        <AlertCircle className="h-4 w-4 mr-2" />
        <span>Error loading judge status: {error}</span>
        <Button size="sm" variant="ghost" className="ml-auto h-7 px-2" onClick={fetchJudgeStatus}>
          <RefreshCw className="h-3 w-3" />
        </Button>
      </div>
    )
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-md">
      <div className="flex items-center justify-between p-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <span className="font-medium text-sm">Judge Finalization</span>
          <Badge variant={completionPercentage === 100 ? "success" : "outline"} className="ml-2">
            {finalizedJudges}/{totalJudges} Complete
          </Badge>
        </div>

        <div className="flex items-center gap-2">
          <Progress value={completionPercentage} className="w-24 h-2" />
          <span className="text-xs text-muted-foreground">{completionPercentage}%</span>
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 w-7 p-0"
                  onClick={(e) => {
                    e.stopPropagation()
                    fetchJudgeStatus()
                    toast.info("Refreshing judge status...")
                  }}
                >
                  <RefreshCw className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Refresh judge status</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>

      <CollapsibleContent>
        <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
          {judgeStatus.length === 0 && !loading ? (
            <div className="text-center py-2 text-xs text-muted-foreground">No judge data available</div>
          ) : (
            judgeStatus.map((judge) => (
              <div
                key={judge.id}
                className="flex items-center justify-between py-1 px-2 text-sm border-b last:border-0"
              >
                <div className="flex items-center">
                  {judge.finalized ? (
                    <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                  ) : (
                    <div className="h-3 w-3 rounded-full border border-amber-500 mr-2" />
                  )}
                  <span className="truncate max-w-[200px]">
                    {judge.judge_name || `Judge ${judge.judge_id.substring(0, 8)}`}
                  </span>
                </div>
                <Badge variant={judge.finalized ? "success" : "outline"} className="text-xs">
                  {judge.finalized ? "Finalized" : "Pending"}
                </Badge>
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
