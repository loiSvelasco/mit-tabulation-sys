"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { toast } from "sonner"
import { AlertCircle, Save, CheckCircle, Calculator } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Add this function at the top of your component file, outside the component
function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2))
}

export function PrejudgedScoresInput() {
  const { competitionSettings, contestants, judges, scores, setScores, saveCompetition, setCompetitionSettings } =
    useCompetitionStore()

  const [selectedSegmentId, setSelectedSegmentId] = useState<string | null>(null)
  const [rawScores, setRawScores] = useState<Record<string, Record<string, number>>>({})
  const [scaledScores, setScaledScores] = useState<Record<string, Record<string, number>>>({})
  const [maxRawScores, setMaxRawScores] = useState<Record<string, number>>({})
  const [isSaving, setIsSaving] = useState(false)
  const adminId = "admin" // Used only for tracking locally, not saved to database

  // Set initial segment selection
  useEffect(() => {
    if (competitionSettings.segments.length > 0 && !selectedSegmentId) {
      const segmentWithPrejudged = competitionSettings.segments.find((segment) =>
        segment.criteria.some((criterion) => criterion.isPrejudged),
      )

      if (segmentWithPrejudged) {
        setSelectedSegmentId(segmentWithPrejudged.id)
      } else {
        setSelectedSegmentId(competitionSettings.segments[0].id)
      }
    }
  }, [competitionSettings.segments, selectedSegmentId])

  // Initialize max raw scores for each criterion
  useEffect(() => {
    if (selectedSegmentId) {
      const segment = competitionSettings.segments.find((s) => s.id === selectedSegmentId)
      const prejudgedCriteria = segment?.criteria.filter((c) => c.isPrejudged) || []

      const initialMaxRawScores: Record<string, number> = {}
      prejudgedCriteria.forEach((criterion) => {
        initialMaxRawScores[criterion.id] = 100 // Default max raw score is 100
      })

      setMaxRawScores(initialMaxRawScores)
    }
  }, [selectedSegmentId, competitionSettings.segments])

  // Initialize raw scores from existing scores
  useEffect(() => {
    if (selectedSegmentId) {
      const initialRawScores: Record<string, Record<string, number>> = {}
      const initialScaledScores: Record<string, Record<string, number>> = {}

      // Get contestants in the selected segment
      const segmentContestants = contestants.filter((c) => c.currentSegmentId === selectedSegmentId)

      // Get pre-judged criteria in the selected segment
      const segment = competitionSettings.segments.find((s) => s.id === selectedSegmentId)
      const prejudgedCriteria = segment?.criteria.filter((c) => c.isPrejudged) || []

      // Initialize scores structure
      segmentContestants.forEach((contestant) => {
        initialRawScores[contestant.id] = {}
        initialScaledScores[contestant.id] = {}

        prejudgedCriteria.forEach((criterion) => {
          // Check if there's an existing score - first check admin, then check any judge
          let existingScore = scores[selectedSegmentId]?.[contestant.id]?.[adminId]?.[criterion.id]

          // If no admin score, check if any judge has a score (assuming all judges have the same score for pre-judged criteria)
          if (existingScore === undefined && judges.length > 0) {
            existingScore = scores[selectedSegmentId]?.[contestant.id]?.[judges[0].id]?.[criterion.id]
          }

          if (existingScore !== undefined) {
            // Reverse the scaling to get the raw score
            const maxRaw = maxRawScores[criterion.id] || 100
            const rawScore = (existingScore * maxRaw) / criterion.maxScore
            initialRawScores[contestant.id][criterion.id] = Number(rawScore.toFixed(2))
            initialScaledScores[contestant.id][criterion.id] = Number(existingScore.toFixed(2))
          } else {
            initialRawScores[contestant.id][criterion.id] = 0
            initialScaledScores[contestant.id][criterion.id] = 0
          }
        })
      })

      setRawScores(initialRawScores)
      setScaledScores(initialScaledScores)
    }
  }, [selectedSegmentId, contestants, competitionSettings.segments, scores, adminId, maxRawScores, judges])

  // Handle raw score change
  const handleRawScoreChange = (contestantId: string, criterionId: string, value: string) => {
    const numValue = Number(value)
    if (isNaN(numValue)) return

    // Update raw score - limit to 2 decimal places when storing in state
    setRawScores((prev) => {
      const updated = { ...prev }

      if (!updated[contestantId]) {
        updated[contestantId] = {}
      }

      // Store the raw value for better input experience
      updated[contestantId][criterionId] = numValue
      return updated
    })

    // Calculate and update scaled score
    const segment = competitionSettings.segments.find((s) => s.id === selectedSegmentId)
    const criterion = segment?.criteria.find((c) => c.id === criterionId)

    if (criterion) {
      const maxRaw = maxRawScores[criterion.id] || 100
      const scaledValue = (numValue * criterion.maxScore) / maxRaw

      // Ensure exactly 2 decimal places
      const roundedScaledValue = Number(scaledValue.toFixed(2))

      setScaledScores((prev) => {
        const updated = { ...prev }

        if (!updated[contestantId]) {
          updated[contestantId] = {}
        }

        // Store with exactly 2 decimal places
        updated[contestantId][criterionId] = roundedScaledValue
        return updated
      })
    }
  }

  // Handle max raw score change
  const handleMaxRawScoreChange = (criterionId: string, value: string) => {
    const numValue = Number(value)
    if (isNaN(numValue) || numValue <= 0) return

    // Update max raw score - allow decimal places but round to 2 places
    setMaxRawScores((prev) => ({
      ...prev,
      [criterionId]: Number(numValue.toFixed(2)),
    }))

    // Recalculate all scaled scores for this criterion
    const segment = competitionSettings.segments.find((s) => s.id === selectedSegmentId)
    const criterion = segment?.criteria.find((c) => c.id === criterionId)

    if (criterion) {
      setScaledScores((prev) => {
        const updated = { ...prev }

        Object.keys(rawScores).forEach((contestantId) => {
          if (!updated[contestantId]) {
            updated[contestantId] = {}
          }

          const rawValue = rawScores[contestantId]?.[criterionId] || 0
          const scaledValue = (rawValue * criterion.maxScore) / numValue

          // Ensure exactly 2 decimal places
          updated[contestantId][criterionId] = Number(scaledValue.toFixed(2))
        })

        return updated
      })
    }
  }

  // Save pre-judged scores
  const handleSaveScores = async () => {
    if (!selectedSegmentId) {
      toast.error("No segment selected")
      return
    }

    setIsSaving(true)

    try {
      // Get pre-judged criteria in the selected segment
      const segment = competitionSettings.segments.find((s) => s.id === selectedSegmentId)
      const prejudgedCriteria = segment?.criteria.filter((c) => c.isPrejudged) || []

      // Update criteria with prejudgedBy and prejudgedAt information
      const updatedSegments = competitionSettings.segments.map((segment) => {
        if (segment.id === selectedSegmentId) {
          const updatedCriteria = segment.criteria.map((criterion) => {
            if (criterion.isPrejudged) {
              return {
                ...criterion,
                prejudgedBy: adminId,
                prejudgedAt: new Date().toISOString(),
              }
            }
            return criterion
          })

          return {
            ...segment,
            criteria: updatedCriteria,
          }
        }
        return segment
      })

      // Update the competition settings with the updated segments
      setCompetitionSettings({
        ...competitionSettings,
        segments: updatedSegments,
      })

      // Log the scores we're about to save
      console.log("Saving pre-judged scores:", {
        segmentId: selectedSegmentId,
        scaledScores,
        judges: judges.map((j) => j.id),
      })

      // Update scores in the store for EACH JUDGE ONLY (not admin)
      const savePromises: Promise<any>[] = []

      // Save scores only for actual judges, not for "admin"
      judges.forEach((judge) => {
        Object.entries(scaledScores).forEach(([contestantId, criteriaScores]) => {
          Object.entries(criteriaScores).forEach(([criterionId, score]) => {
            // Ensure exactly 2 decimal places before saving
            const roundedScore = Number(score.toFixed(2))

            // Save the score for this judge - setScores will handle rounding
            setScores(selectedSegmentId, contestantId, judge.id, criterionId, roundedScore)

            // Add a small delay between requests
            const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
            savePromises.push(delay(50))
          })
        })
      })

      // Wait for all scores to be saved
      await Promise.all(savePromises)

      // Save the updated competition settings to database
      await saveCompetition()

      toast.success("Pre-judged scores saved successfully")
    } catch (error) {
      console.error("Error saving pre-judged scores:", error)
      toast.error(`Failed to save pre-judged scores: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Check if there are any pre-judged criteria in any segment
  const hasPrejudgedCriteria = competitionSettings.segments.some((segment) =>
    segment.criteria.some((criterion) => criterion.isPrejudged),
  )

  if (!hasPrejudgedCriteria) {
    return null // Don't render anything if there are no pre-judged criteria
  }

  // Get selected segment
  const selectedSegment = competitionSettings.segments.find((s) => s.id === selectedSegmentId)

  // Get pre-judged criteria for the selected segment
  const prejudgedCriteria = selectedSegment?.criteria.filter((c) => c.isPrejudged) || []

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === selectedSegmentId)

  // Then in your component, modify the formatDisplayValue function:
  const formatDisplayValue = (value: number) => {
    // First round to exactly 2 decimal places
    const roundedValue = roundToTwoDecimals(value)

    // For whole numbers, don't show decimal places
    if (Math.floor(roundedValue) === roundedValue) {
      return roundedValue.toString()
    }

    // For numbers with decimal places, show up to 2 decimal places
    return roundedValue.toFixed(2).replace(/\.?0+$/, "")
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Pre-judged Scores Input</CardTitle>
        <CardDescription>
          Enter raw scores from pre-judging and they will be automatically scaled to match the criteria's maximum score
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <span>Pre-judged Scores Management</span>
                <Badge variant="outline" className="bg-blue-50 text-blue-700">
                  {prejudgedCriteria.length} Pre-judged {prejudgedCriteria.length === 1 ? "Criterion" : "Criteria"}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              {competitionSettings.segments.length > 1 && (
                <div className="mb-4">
                  <label className="block text-sm font-medium mb-1">Select Segment</label>
                  <Select value={selectedSegmentId || ""} onValueChange={setSelectedSegmentId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a segment" />
                    </SelectTrigger>
                    <SelectContent>
                      {competitionSettings.segments
                        .filter((segment) => segment.criteria.some((c) => c.isPrejudged))
                        .map((segment) => (
                          <SelectItem key={segment.id} value={segment.id}>
                            {segment.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {selectedSegment && prejudgedCriteria.length === 0 ? (
                <div className="flex items-center p-4 bg-amber-50 border border-amber-200 rounded-md">
                  <AlertCircle className="h-5 w-5 text-amber-600 mr-2" />
                  <p className="text-amber-800">
                    No pre-judged criteria found in this segment. To create pre-judged criteria, mark criteria as
                    "Pre-judged" when creating them.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">{selectedSegment?.name} Segment</h3>
                    <Button onClick={handleSaveScores} disabled={isSaving} className="flex items-center gap-2">
                      {isSaving ? (
                        <>Saving...</>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Save Pre-judged Scores
                        </>
                      )}
                    </Button>
                  </div>

                  {/* Max Raw Score Configuration */}
                  <div className="border p-4 rounded-md bg-slate-50">
                    <h4 className="font-medium mb-2 flex items-center gap-2">
                      <Calculator className="h-4 w-4" />
                      Configure Maximum Raw Scores
                    </h4>
                    <p className="text-sm text-muted-foreground mb-3">
                      Set the maximum possible raw score for each criterion. This will be used to scale the raw scores
                      to match the criterion's maximum score.
                    </p>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {prejudgedCriteria.map((criterion) => (
                        <div key={criterion.id} className="flex flex-col gap-1">
                          <label className="text-sm font-medium">{criterion.name}</label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="number"
                              min={1}
                              step={0.1}
                              value={maxRawScores[criterion.id] || 100}
                              onChange={(e) => handleMaxRawScoreChange(criterion.id, e.target.value)}
                              className="w-24"
                            />
                            <span className="text-sm text-muted-foreground">→ {criterion.maxScore} points</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {segmentContestants.length === 0 ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-md">
                      <p className="text-amber-800">
                        No contestants found in this segment. Add contestants to the segment to enter pre-judged scores.
                      </p>
                    </div>
                  ) : (
                    <div className="border rounded-md overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-[200px]">Contestant</TableHead>
                            {prejudgedCriteria.map((criterion) => (
                              <TableHead key={criterion.id}>
                                <div className="flex flex-col">
                                  <span>{criterion.name}</span>
                                  <span className="text-xs text-muted-foreground">
                                    Raw (max: {formatDisplayValue(maxRawScores[criterion.id] || 100)}) → Scaled (max:{" "}
                                    {criterion.maxScore})
                                  </span>
                                </div>
                              </TableHead>
                            ))}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {segmentContestants.map((contestant) => (
                            <TableRow key={contestant.id}>
                              <TableCell className="font-medium">{contestant.name}</TableCell>
                              {prejudgedCriteria.map((criterion) => {
                                const rawScore = rawScores[contestant.id]?.[criterion.id] ?? 0
                                const scaledScore = scaledScores[contestant.id]?.[criterion.id] ?? 0

                                // Check if any judge has a score for this criterion (pre-judged scores should be the same for all judges)
                                let isScored = false
                                if (judges.length > 0) {
                                  isScored =
                                    scores[selectedSegmentId]?.[contestant.id]?.[judges[0].id]?.[criterion.id] !==
                                    undefined
                                }

                                return (
                                  <TableCell key={criterion.id}>
                                    <div className="flex flex-col gap-2">
                                      <div className="flex items-center gap-2">
                                        <Input
                                          type="number"
                                          min={0}
                                          max={maxRawScores[criterion.id] || 100}
                                          step={0.1}
                                          value={rawScore}
                                          onChange={(e) =>
                                            handleRawScoreChange(contestant.id, criterion.id, e.target.value)
                                          }
                                          className="w-20"
                                        />
                                        <span className="text-sm">→</span>
                                        <TooltipProvider>
                                          <Tooltip>
                                            <TooltipTrigger asChild>
                                              <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded">
                                                <span className="font-medium">{formatDisplayValue(scaledScore)}</span>
                                                {isScored && <CheckCircle className="h-4 w-4 text-green-500" />}
                                              </div>
                                            </TooltipTrigger>
                                            <TooltipContent>
                                              <p>Scaled score that will be saved</p>
                                            </TooltipContent>
                                          </Tooltip>
                                        </TooltipProvider>
                                      </div>
                                    </div>
                                  </TableCell>
                                )
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
