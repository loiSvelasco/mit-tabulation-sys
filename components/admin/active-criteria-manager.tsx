"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import useCompetitionStore from "@/utils/useCompetitionStore"

export function ActiveCriteriaManager() {
  const { competitionSettings, activeCriteria, toggleActiveCriterion, clearActiveCriteria } = useCompetitionStore()
  const [expanded, setExpanded] = useState(false)

  const handleToggleCriterion = (segmentId: string, criterionId: string) => {
    toggleActiveCriterion(segmentId, criterionId)
  }

  const handleClearAll = () => {
    clearActiveCriteria()
    toast.success("All active criteria cleared")
  }

  const isActive = (segmentId: string, criterionId: string) => {
    return activeCriteria.some((ac) => ac.segmentId === segmentId && ac.criterionId === criterionId)
  }

  const activeCount = activeCriteria.length

  return (
    <Card className="mb-6">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">Active Criteria for Judging</CardTitle>
            <CardDescription>
              Select criteria that judges will score
              {activeCount > 0 && (
                <Badge variant="secondary" className="ml-2">
                  {activeCount} active
                </Badge>
              )}
            </CardDescription>
          </div>
          <Button variant="outline" size="sm" onClick={() => setExpanded(!expanded)}>
            {expanded ? "Collapse" : "Expand"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {expanded ? (
          <>
            <div className="space-y-4">
              {competitionSettings.segments.map((segment) => (
                <div key={segment.id} className="space-y-2">
                  <h3 className="font-medium text-sm">{segment.name}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {segment.criteria.map((criterion) => (
                      <div key={criterion.id} className="flex items-center space-x-2">
                        <Checkbox
                          id={`criterion-${segment.id}-${criterion.id}`}
                          checked={isActive(segment.id, criterion.id)}
                          onCheckedChange={() => handleToggleCriterion(segment.id, criterion.id)}
                        />
                        <label
                          htmlFor={`criterion-${segment.id}-${criterion.id}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                        >
                          {criterion.name}
                        </label>
                      </div>
                    ))}
                  </div>
                  <Separator className="my-2" />
                </div>
              ))}
            </div>
            <div className="mt-4 flex justify-end">
              <Button variant="outline" size="sm" onClick={handleClearAll}>
                Clear All
              </Button>
            </div>
          </>
        ) : (
          <div className="space-y-2">
            {activeCount === 0 ? (
              <p className="text-sm text-muted-foreground">No active criteria selected</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {activeCriteria.map(({ segmentId, criterionId }) => {
                  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
                  const criterion = segment?.criteria.find((c) => c.id === criterionId)

                  if (!segment || !criterion) return null

                  return (
                    <Badge key={`${segmentId}-${criterionId}`} variant="outline" className="py-1">
                      {segment.name}: {criterion.name}
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
