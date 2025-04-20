"use client"

import { useState, useEffect } from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp, Edit2 } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { toast } from "sonner"
import useCompetitionStore from "@/utils/useCompetitionStore"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

interface JudgeFinalizationStatusProps {
  competitionId: string | number
  segmentId?: string
}

interface JudgeFinalization {
  id: string
  judge_id: string
  segment_id: string
  finalized: boolean | number
  finalized_at: string | null
}

export function JudgeFinalizationStatus({ competitionId, segmentId }: JudgeFinalizationStatusProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [judgeStatus, setJudgeStatus] = useState<JudgeFinalization[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    judgeId: string | null
    judgeName: string
    action: "allow-editing" | null
  }>({
    open: false,
    judgeId: null,
    judgeName: "",
    action: null,
  })

  // Get judges from the competition store
  const { judges } = useCompetitionStore()

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

  // Create a map of judge IDs to their finalization status
  const judgeFinalizationMap: Record<string, boolean> = {}
  judgeStatus.forEach((status) => {
    // Handle both boolean and numeric (0/1) values
    judgeFinalizationMap[status.judge_id] = status.finalized === true || status.finalized === 1
  })

  // Calculate completion percentage based on all judges in the competition
  const totalJudges = judges.length
  const finalizedJudges = judges.filter((judge) => judgeFinalizationMap[judge.id] === true).length
  const completionPercentage = totalJudges > 0 ? Math.round((finalizedJudges / totalJudges) * 100) : 0

  // Handle allowing a judge to edit their scores (unfinalize)
  const handleAllowEditing = async (judgeId: string, judgeName: string) => {
    setConfirmDialog({
      open: true,
      judgeId,
      judgeName,
      action: "allow-editing",
    })
  }

  // Confirm and execute the action
  const confirmAction = async () => {
    if (!confirmDialog.judgeId || !confirmDialog.action) return

    try {
      setActionLoading(confirmDialog.judgeId)

      if (confirmDialog.action === "allow-editing") {
        // Call API to unfinalize the judge's scores
        const response = await fetch("/api/judge/finalize", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            competitionId,
            judgeId: confirmDialog.judgeId,
            segmentId: segmentId || "",
            finalized: false, // Set to false to unfinalize
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.message || "Failed to allow editing")
        }

        toast.success(`${confirmDialog.judgeName} can now edit their scores`)
        fetchJudgeStatus() // Refresh the data
      }
    } catch (error) {
      console.error("Error performing action:", error)
      toast.error(`Failed to complete action: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      setActionLoading(null)
      setConfirmDialog({
        open: false,
        judgeId: null,
        judgeName: "",
        action: null,
      })
    }
  }

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
    <>
      {/* Confirmation Dialog */}
      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => setConfirmDialog({ ...confirmDialog, open })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.action === "allow-editing" ? "Allow Score Editing?" : "Confirm Action"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.action === "allow-editing" ? (
                <>
                  Are you sure you want to allow <strong>{confirmDialog.judgeName}</strong> to edit their scores? This
                  will remove the finalization status.
                </>
              ) : (
                "Are you sure you want to perform this action?"
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAction}>
              {actionLoading === confirmDialog.judgeId ? "Processing..." : "Confirm"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
            {judges.length === 0 ? (
              <div className="text-center py-2 text-xs text-muted-foreground">
                No judges available for this competition
              </div>
            ) : (
              judges.map((judge) => {
                const isFinalized = judgeFinalizationMap[judge.id] === true
                const isActionLoading = actionLoading === judge.id

                return (
                  <div
                    key={judge.id}
                    className="flex items-center justify-between py-1 px-2 text-sm border-b last:border-0"
                  >
                    <div className="flex items-center">
                      {isFinalized ? (
                        <CheckCircle className="h-3 w-3 text-green-500 mr-2" />
                      ) : (
                        <div className="h-3 w-3 rounded-full border border-amber-500 mr-2" />
                      )}
                      <span className="truncate max-w-[200px]">
                        {judge.name || `Judge ${judge.id.substring(0, 8)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={isFinalized ? "success" : "outline"} className="text-xs">
                        {isFinalized ? "Finalized" : "Pending"}
                      </Badge>

                      {isFinalized && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                disabled={isActionLoading}
                                onClick={() =>
                                  handleAllowEditing(judge.id, judge.name || `Judge ${judge.id.substring(0, 8)}`)
                                }
                              >
                                {isActionLoading ? (
                                  <RefreshCw className="h-3 w-3 animate-spin" />
                                ) : (
                                  <Edit2 className="h-3 w-3" />
                                )}
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left">
                              <p>Allow editing</p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </>
  )
}
