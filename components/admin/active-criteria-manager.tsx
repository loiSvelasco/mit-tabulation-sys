"use client"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronDown, ChevronUp } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import type React from "react"

function ActiveCriteriaManager() {
  const {
    competitionSettings,
    activeCriteria: storeActiveCriteria,
    toggleActiveCriterion,
    clearActiveCriteria,
    saveCompetition,
  } = useCompetitionStore()

  // Local state for active criteria that won't be affected by store updates
  const [localActiveCriteria, setLocalActiveCriteria] = useState<Array<{ segmentId: string; criterionId: string }>>([])
  const [isOpen, setIsOpen] = useState(false)
  const [initialized, setInitialized] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // Initialize local state from store only once on mount
  useEffect(() => {
    if (!initialized) {
      // Filter out prejudged and carry-forward criteria from the active criteria list
      const filteredActiveCriteria = storeActiveCriteria.filter((ac) => {
        const segment = competitionSettings.segments.find((s) => s.id === ac.segmentId)
        const criterion = segment?.criteria.find((c) => c.id === ac.criterionId)
        return !(criterion?.isPrejudged || criterion?.isCarryForward)
      })

      setLocalActiveCriteria(
        filteredActiveCriteria.map((ac) => ({ segmentId: ac.segmentId, criterionId: ac.criterionId })),
      )
      setInitialized(true)
    }
  }, [storeActiveCriteria, initialized]) // Keep this dependency array stable

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

      // Update local state
      setLocalActiveCriteria((prev) => {
        const isCurrentlyActive = prev.some((ac) => ac.segmentId === segmentId && ac.criterionId === criterionId)

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
        setIsSaving(true)
        await saveCompetition()
        setIsSaving(false)
      } catch (error) {
        console.error("Failed to save active criteria changes:", error)
        toast.error("Failed to save changes. Please try again.")
        setIsSaving(false)
      }
    },
    [toggleActiveCriterion, saveCompetition, competitionSettings.segments],
  )

  // Clear all active criteria in local state AND in the store
  const handleClearAll = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation()

      // Update local state
      setLocalActiveCriteria([])

      // Update store
      clearActiveCriteria()

      // Save changes to database
      try {
        setIsSaving(true)
        await saveCompetition()
        setIsSaving(false)
        toast.success("All active criteria cleared and saved")
      } catch (error) {
        console.error("Failed to save active criteria changes:", error)
        toast.error("Failed to save changes. Please try again.")
        setIsSaving(false)
      }
    },
    [clearActiveCriteria, saveCompetition],
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
