"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp, Info } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import type React from "react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

function ActiveCriteriaManager() {
  const {
    competitionSettings,
    activeCriteria: storeActiveCriteria,
    toggleActiveCriterion,
    clearActiveCriteria,
    saveCompetition,
    selectedCompetitionId,
  } = useCompetitionStore()

  // Local state for active criteria that syncs with store updates
  const [localActiveCriteria, setLocalActiveCriteria] = useState<Array<{ segmentId: string; criterionId: string }>>([])
  const [isOpen, setIsOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Sync local state with store whenever store changes
  useEffect(() => {
    // Filter out prejudged and carry-forward criteria from the active criteria list
    const filteredActiveCriteria = storeActiveCriteria.filter((ac) => {
      const segment = competitionSettings.segments.find((s) => s.id === ac.segmentId)
      const criterion = segment?.criteria.find((c) => c.id === ac.criterionId)
      return !(criterion?.isPrejudged || criterion?.isCarryForward)
    })

    const newLocalActiveCriteria = filteredActiveCriteria.map((ac) => ({ 
      segmentId: ac.segmentId, 
      criterionId: ac.criterionId 
    }))

    setLocalActiveCriteria(newLocalActiveCriteria)
  }, [storeActiveCriteria, competitionSettings.segments])

  // Check if a criterion is active in our local state
  const isActive = useCallback(
    (segmentId: string, criterionId: string) => {
      // Find the criterion to check if it's prejudged or carry-forward
      const segment = competitionSettings.segments.find((s) => s.id === segmentId)
      const criterion = segment?.criteria.find((c) => c.id === criterionId)

      // Always return false for prejudged or carry-forward criteria
      if (criterion?.isPrejudged || criterion?.isCarryForward) {
        return false
      }

      return localActiveCriteria.some((ac) => ac.segmentId === segmentId && ac.criterionId === criterionId)
    },
    [localActiveCriteria, competitionSettings.segments],
  )

  // Reset finalization status for judges for a specific segment
  const resetFinalizationStatus = useCallback(
    async (segmentId: string) => {
      // Ensure we have a valid competition ID
      if (!selectedCompetitionId) {
        console.error("No competition ID available")
        return false
      }

      try {
        console.log(`Resetting finalization for competition ${selectedCompetitionId}, segment ${segmentId}`)

        const response = await fetch("/api/judge/reset-finalization", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            competitionId: selectedCompetitionId,
            segmentId,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error("Reset finalization error:", errorData)
          throw new Error(errorData.message || "Failed to reset finalization status")
        }

        return true
      } catch (error) {
        console.error("Error resetting finalization status:", error)
        return false
      }
    },
    [selectedCompetitionId],
  )

  // Toggle a criterion in our local state AND in the store
  const handleToggle = useCallback(
    async (segmentId: string, criterionId: string) => {
      // Find the criterion
      const segment = competitionSettings.segments.find((s) => s.id === segmentId)
      const criterion = segment?.criteria.find((c) => c.id === criterionId)

      // Don't allow toggling prejudged or carry-forward criteria
      if (criterion?.isPrejudged || criterion?.isCarryForward) {
        return
      }

      // Check if we're activating (not deactivating) a criterion
      const isCurrentlyActive = localActiveCriteria.some(
        (ac) => ac.segmentId === segmentId && ac.criterionId === criterionId,
      )

      // If we're activating a criterion, reset judge finalization status
      if (!isCurrentlyActive) {
        try {
          setIsSaving(true)

          // Reset judge finalization status for this segment
          const resetSuccess = await resetFinalizationStatus(segmentId)

          if (resetSuccess) {
            toast.success("Judge finalization status reset for this segment")
          }
        } catch (error) {
          console.error("Failed to reset judge finalization status:", error)
          toast.error("Failed to reset judge finalization status. Please try again.")
          setIsSaving(false)
          return
        }
      }

      // Update local state
      setLocalActiveCriteria((prev) => {
        if (isCurrentlyActive) {
          // Remove if already active
          return prev.filter((ac) => !(ac.segmentId === segmentId && ac.criterionId === criterionId))
        } else {
          // Add if not active
          return [...prev, { segmentId, criterionId }]
        }
      })

      // Update the store
      toggleActiveCriterion(segmentId, criterionId)

      // Save changes to database
      try {
        await saveCompetition()
        setIsSaving(false)
      } catch (error) {
        console.error("Failed to save active criteria changes:", error)
        toast.error("Failed to save changes. Please try again.")
        setIsSaving(false)
      }
    },
    [
      toggleActiveCriterion,
      saveCompetition,
      competitionSettings.segments,
      localActiveCriteria,
      resetFinalizationStatus,
    ],
  )

  // Clear all active criteria in local state AND in the store
  const handleClearAll = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()

      // Get unique segment IDs from active criteria
      const activeSegmentIds = [...new Set(localActiveCriteria.map((ac) => ac.segmentId))]

      // Update local state
      setLocalActiveCriteria([])

      // Update store
      clearActiveCriteria()

      // Save changes to database
      try {
        setIsSaving(true)

        // Reset finalization status for all segments that had active criteria
        let resetSuccessCount = 0
        for (const segmentId of activeSegmentIds) {
          const success = await resetFinalizationStatus(segmentId)
          if (success) resetSuccessCount++
        }

        await saveCompetition()
        setIsSaving(false)

        if (resetSuccessCount > 0) {
          toast.success(
            `All active criteria cleared and judge finalization status reset for ${resetSuccessCount} segment(s)`,
          )
        } else {
          toast.success("All active criteria cleared")
        }
      } catch (error) {
        console.error("Failed to save active criteria changes:", error)
        toast.error("Failed to save changes. Please try again.")
        setIsSaving(false)
      }
    },
    [clearActiveCriteria, saveCompetition, localActiveCriteria, resetFinalizationStatus],
  )

  const activeCount = localActiveCriteria.length

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen} className="border rounded-md">
      <div className="flex items-center justify-between p-2 bg-muted/30">
        <div className="flex items-center gap-2">
          <CollapsibleTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
              {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <span className="font-medium text-sm">Active Criteria</span>
          <Badge variant={activeCount > 0 ? "secondary" : "outline"} className="ml-2">
            {activeCount} selected
          </Badge>
          {isSaving && (
            <Badge variant="outline" className="ml-2">
              Saving...
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-2">
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
                  <Info className="h-4 w-4 text-muted-foreground" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs max-w-[250px]">
                  Activating criteria will reset finalization status for judges, allowing them to score newly activated
                  criteria.
                </p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            size="sm"
            variant="ghost"
            className="h-7 px-2 text-xs"
            onClick={handleClearAll}
            disabled={activeCount === 0 || isSaving}
          >
            Clear All
          </Button>
        </div>
      </div>

      <CollapsibleContent>
        <div className="p-2 space-y-3 max-h-48 overflow-y-auto">
          {competitionSettings.segments.length === 0 ? (
            <div className="text-center py-2 text-xs text-muted-foreground">
              No segments available for this competition
            </div>
          ) : (
            competitionSettings.segments.map((segment) => (
              <div key={segment.id} className="space-y-2">
                <h3 className="font-medium text-sm">{segment.name}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                  {segment.criteria.map((criterion) => {
                    const checkboxId = `criterion-${segment.id}-${criterion.id}`
                    const isChecked = isActive(segment.id, criterion.id)
                    const isPrejudged = criterion.isPrejudged
                    const isCarryForward = criterion.isCarryForward
                    const isDisabled = isPrejudged || isCarryForward || isSaving

                    return (
                      <div key={criterion.id} className="flex items-center justify-between py-1 px-2 text-sm">
                        <label
                          htmlFor={checkboxId}
                          className={`flex items-center flex-1 ${isDisabled ? "cursor-not-allowed opacity-70" : "cursor-pointer"}`}
                        >
                          <input
                            type="checkbox"
                            id={checkboxId}
                            checked={isChecked}
                            onChange={() => handleToggle(segment.id, criterion.id)}
                            className="mr-2 h-4 w-4"
                            disabled={isDisabled}
                          />
                          <span className="text-sm leading-none">{criterion.name}</span>

                          {isPrejudged && (
                            <Badge variant="secondary" className="ml-2 text-xs py-0 h-5">
                              Prejudged
                            </Badge>
                          )}

                          {isCarryForward && (
                            <Badge variant="outline" className="ml-2 text-xs py-0 h-5 border-amber-500 text-amber-600">
                              Carry Forward
                            </Badge>
                          )}
                        </label>
                      </div>
                    )
                  })}
                </div>
                {segment !== competitionSettings.segments[competitionSettings.segments.length - 1] && (
                  <Separator className="my-2" />
                )}
              </div>
            ))
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

export default ActiveCriteriaManager
