"use client"

import { useState, useEffect } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { Info, Calculator, Save, CheckCircle } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Badge } from "@/components/ui/badge"

// Helper function to round to two decimal places
function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2))
}

// Helper function to format display values
function formatDisplayValue(value: number) {
  // First round to exactly 2 decimal places
  const roundedValue = roundToTwoDecimals(value)

  // For whole numbers, don't show decimal places
  if (Math.floor(roundedValue) === roundedValue) {
    return roundedValue.toString()
  }

  // For numbers with decimal places, show up to 2 decimal places
  return roundedValue.toFixed(2).replace(/\.?0+$/, "")
}

export const CarryForwardConfig = () => {
  const { competitionSettings, contestants, scores, setScores, saveCompetition } = useCompetitionStore()

  // State for the selected segment and criterion
  const [selectedSegmentId, setSelectedSegmentId] = useState<string>("")
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>("")

  // State for selected source segments
  const [sourceSegments, setSourceSegments] = useState<string[]>([])

  // State for scaling factor (percentage)
  const [scalingFactor, setScalingFactor] = useState<number>(20)

  // State for calculation method
  const [calculationMethod, setCalculationMethod] = useState<"percentage" | "rawAverage" | "accumulatedPoints">(
    "rawAverage",
  )

  // State for calculated preview scores
  const [previewScores, setPreviewScores] = useState<
    {
      contestantId: string
      name: string
      score: number
      rawAverage: number
      judgeScores: Record<string, number>
    }[]
  >([])

  // State for saving
  const [isSaving, setIsSaving] = useState(false)

  // Get all segments that have carry-forward criteria
  const segmentsWithCarryForward = competitionSettings.segments.filter((segment) =>
    segment.criteria.some((criterion) => criterion.isCarryForward),
  )

  // Get all carry-forward criteria for the selected segment
  const carryForwardCriteria = selectedSegmentId
    ? competitionSettings.segments
        .find((segment) => segment.id === selectedSegmentId)
        ?.criteria.filter((criterion) => criterion.isCarryForward) || []
    : []

  // Get all previous segments (segments that come before the selected segment)
  const previousSegments = competitionSettings.segments.filter((segment) => {
    const selectedSegmentIndex = competitionSettings.segments.findIndex((s) => s.id === selectedSegmentId)
    const currentSegmentIndex = competitionSettings.segments.findIndex((s) => s.id === segment.id)
    return currentSegmentIndex < selectedSegmentIndex
  })

  // Set initial segment selection
  useEffect(() => {
    if (competitionSettings.segments.length > 0 && !selectedSegmentId) {
      const segmentWithCarryForward = competitionSettings.segments.find((segment) =>
        segment.criteria.some((criterion) => criterion.isCarryForward),
      )

      if (segmentWithCarryForward) {
        setSelectedSegmentId(segmentWithCarryForward.id)
      } else if (competitionSettings.segments.length > 1) {
        // Select the second segment if available (since first segment can't have carry-forward)
        setSelectedSegmentId(competitionSettings.segments[1].id)
      }
    }
  }, [competitionSettings.segments, selectedSegmentId])

  // Reset criterion when segment changes
  useEffect(() => {
    setSelectedCriterionId("")
    setSourceSegments([])
    setPreviewScores([])
  }, [selectedSegmentId])

  // Calculate preview scores when source segments, scaling factor, or calculation method changes
  useEffect(() => {
    if (!selectedSegmentId || !selectedCriterionId || sourceSegments.length === 0) {
      setPreviewScores([])
      return
    }

    calculatePreviewScores()
  }, [sourceSegments, scalingFactor, selectedCriterionId, calculationMethod])

  // Calculate preview scores based on selected source segments and scaling factor
  const calculatePreviewScores = () => {
    if (!selectedSegmentId || !selectedCriterionId || sourceSegments.length === 0) return

    const selectedCriterion = competitionSettings.segments
      .find((segment) => segment.id === selectedSegmentId)
      ?.criteria.find((criterion) => criterion.id === selectedCriterionId)

    if (!selectedCriterion) return

    const contestantScores = contestants.map((contestant) => {
      // For each source segment, get the total score for each judge
      const judgeScoresMap: Record<string, number> = {}

      sourceSegments.forEach((segmentId) => {
        const segment = competitionSettings.segments.find((s) => s.id === segmentId)
        if (!segment) return

        // Get all judges who scored this contestant in this segment
        const judges = Object.keys(scores[segmentId]?.[contestant.id] || {})

        judges.forEach((judgeId) => {
          // Calculate total score for this judge across all criteria
          let judgeTotalScore = 0
          segment.criteria.forEach((criterion) => {
            const criterionScore = scores[segmentId]?.[contestant.id]?.[judgeId]?.[criterion.id] || 0
            judgeTotalScore += criterionScore
          })

          // Add to judge's total (or initialize if first segment)
          judgeScoresMap[judgeId] = (judgeScoresMap[judgeId] || 0) + judgeTotalScore
        })
      })

      // Calculate the average of all judge total scores
      const judgeScores = Object.values(judgeScoresMap)
      const rawAverage =
        judgeScores.length > 0 ? judgeScores.reduce((sum, score) => sum + score, 0) / judgeScores.length : 0

      // Calculate final score based on calculation method
      let finalScore = 0

      if (calculationMethod === "rawAverage") {
        // For raw average, just use the average directly
        finalScore = rawAverage
      } else if (calculationMethod === "percentage") {
        // For percentage, apply the scaling factor to the average
        finalScore = rawAverage * (scalingFactor / 100)
      } else if (calculationMethod === "accumulatedPoints") {
        // For accumulated points, sum all judge scores and apply scaling factor
        const totalAccumulatedPoints = Object.values(judgeScoresMap).reduce((sum, score) => sum + score, 0)
        finalScore = totalAccumulatedPoints * (scalingFactor / 100)
      }

      // Round to 2 decimal places
      finalScore = roundToTwoDecimals(finalScore)
      const roundedRawAverage = roundToTwoDecimals(rawAverage)

      return {
        contestantId: contestant.id,
        name: contestant.name,
        score: finalScore,
        rawAverage: roundedRawAverage,
        judgeScores: judgeScoresMap,
      }
    })

    setPreviewScores(contestantScores)
  }

  // Apply calculated scores to all judges
  const applyCarryForwardScores = async () => {
    if (!selectedSegmentId || !selectedCriterionId || previewScores.length === 0) {
      toast.error("Please select a segment, criterion, and source segments first.")
      return
    }

    setIsSaving(true)

    try {
      // Get all judges
      const judges = useCompetitionStore.getState().judges

      // Apply scores for each judge and contestant
      previewScores.forEach((previewScore) => {
        judges.forEach((judge) => {
          setScores(selectedSegmentId, previewScore.contestantId, judge.id, selectedCriterionId, previewScore.score)
        })
      })

      // Update the criterion in the competition settings to mark it as a carry-forward criterion
      // and store the source segments, scaling factor, and calculation method
      const updatedSegments = competitionSettings.segments.map((segment) => {
        if (segment.id === selectedSegmentId) {
          const updatedCriteria = segment.criteria.map((criterion) => {
            if (criterion.id === selectedCriterionId) {
              return {
                ...criterion,
                isCarryForward: true,
                sourceSegments: sourceSegments,
                scalingFactor: scalingFactor / 100,
                calculationMethod: calculationMethod,
              }
            }
            return criterion
          })
          return { ...segment, criteria: updatedCriteria }
        }
        return segment
      })

      useCompetitionStore.getState().setCompetitionSettings({
        ...competitionSettings,
        segments: updatedSegments,
      })

      // Save changes to the database
      await saveCompetition()

      toast.success("Carry-forward scores have been applied to all judges and saved.")
    } catch (error) {
      console.error("Error applying carry-forward scores:", error)
      toast.error(`Failed to apply carry-forward scores: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsSaving(false)
    }
  }

  // Count how many criteria have been configured
  const configuredCriteriaCount = competitionSettings.segments.reduce((count, segment) => {
    return count + segment.criteria.filter((c) => c.isCarryForward && c.sourceSegments?.length > 0).length
  }, 0)

  // If there are no segments with carry-forward criteria, show nothing
  if (segmentsWithCarryForward.length === 0) {
    return null
  }

  // Get unique judge IDs from the preview scores
  const uniqueJudgeIds =
    previewScores.length > 0 ? [...new Set(previewScores.flatMap((score) => Object.keys(score.judgeScores)))] : []

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Carry-Forward Scores</CardTitle>
        <CardDescription>Configure criteria that carry forward scores from previous segments</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="single" collapsible defaultValue="item-1">
          <AccordionItem value="item-1">
            <AccordionTrigger>
              <div className="flex items-center gap-2">
                <span>Carry-Forward Scores Management</span>
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  {configuredCriteriaCount} Configured {configuredCriteriaCount === 1 ? "Criterion" : "Criteria"}
                </Badge>
              </div>
            </AccordionTrigger>
            <AccordionContent>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Configuration Panel */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Configuration</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {/* Segment Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Select Segment</label>
                      <Select value={selectedSegmentId} onValueChange={setSelectedSegmentId}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a segment" />
                        </SelectTrigger>
                        <SelectContent>
                          {segmentsWithCarryForward.map((segment) => (
                            <SelectItem key={segment.id} value={segment.id}>
                              {segment.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Criterion Selection */}
                    <div>
                      <label className="block text-sm font-medium mb-1">Select Carry-Forward Criterion</label>
                      <Select
                        value={selectedCriterionId}
                        onValueChange={setSelectedCriterionId}
                        disabled={!selectedSegmentId || carryForwardCriteria.length === 0}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              !selectedSegmentId
                                ? "Select a segment first"
                                : carryForwardCriteria.length === 0
                                  ? "No carry-forward criteria in this segment"
                                  : "Select a criterion"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {carryForwardCriteria.map((criterion) => (
                            <SelectItem key={criterion.id} value={criterion.id}>
                              {criterion.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Calculation Method Selection */}
                    {selectedSegmentId && selectedCriterionId && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Calculation Method</label>
                        <RadioGroup
                          value={calculationMethod}
                          onValueChange={(value) =>
                            setCalculationMethod(value as "percentage" | "rawAverage" | "accumulatedPoints")
                          }
                          className="space-y-2"
                        >
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="rawAverage" id="rawAverage" />
                            <Label htmlFor="rawAverage">Raw Average</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    Uses the average of each judge's total scores directly as the carry-forward score.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="percentage" id="percentage" />
                            <Label htmlFor="percentage">Percentage of Average</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    Takes the average of each judge's total scores and applies the scaling factor to get
                                    the final score.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <div className="flex items-center space-x-2">
                            <RadioGroupItem value="accumulatedPoints" id="accumulatedPoints" />
                            <Label htmlFor="accumulatedPoints">Percentage of Total Points</Label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help ml-1" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    Takes the total accumulated points across all judges and applies the scaling factor
                                    to get the final score.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </RadioGroup>
                      </div>
                    )}

                    {/* Source Segments Selection */}
                    {selectedSegmentId && selectedCriterionId && (
                      <div>
                        <label className="block text-sm font-medium mb-1">Select Source Segments</label>
                        <div className="mt-1 space-y-2 border rounded-md p-3">
                          {previousSegments.length === 0 ? (
                            <p className="text-muted-foreground">
                              No previous segments available. Carry-forward can only use segments that come before the
                              current segment.
                            </p>
                          ) : (
                            previousSegments.map((segment) => (
                              <div key={segment.id} className="flex items-center gap-2">
                                <Checkbox
                                  id={`segment-${segment.id}`}
                                  checked={sourceSegments.includes(segment.id)}
                                  onCheckedChange={(checked) => {
                                    if (checked) {
                                      setSourceSegments([...sourceSegments, segment.id])
                                    } else {
                                      setSourceSegments(sourceSegments.filter((id) => id !== segment.id))
                                    }
                                  }}
                                />
                                <label htmlFor={`segment-${segment.id}`}>{segment.name}</label>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Scaling Factor - Show for both percentage-based methods */}
                    {selectedSegmentId &&
                      selectedCriterionId &&
                      sourceSegments.length > 0 &&
                      (calculationMethod === "percentage" || calculationMethod === "accumulatedPoints") && (
                        <div className="border p-4 rounded-md bg-slate-50">
                          <div className="flex justify-between items-center mb-2">
                            <label className="text-sm font-medium">Scaling Factor: {scalingFactor}%</label>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="max-w-xs">
                                    {calculationMethod === "percentage"
                                      ? "The scaling factor determines what percentage of the average score will be carried forward. For example, 20% of an average score of 27.9 would be 5.58."
                                      : "The scaling factor determines what percentage of the total accumulated points will be carried forward. For example, 20% of a total of 195 points would be 39."}
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Slider
                            value={[scalingFactor]}
                            min={1}
                            max={100}
                            step={1}
                            onValueChange={(value) => setScalingFactor(value[0])}
                          />
                        </div>
                      )}

                    {/* Apply Button */}
                    {selectedSegmentId && selectedCriterionId && sourceSegments.length > 0 && (
                      <div className="flex justify-end">
                        <Button onClick={applyCarryForwardScores} disabled={previewScores.length === 0 || isSaving}>
                          {isSaving ? (
                            <>Saving...</>
                          ) : (
                            <>
                              <Save className="h-4 w-4 mr-2" />
                              Apply to All Judges
                            </>
                          )}
                        </Button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Preview Panel */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-medium">Preview</h3>
                    {calculationMethod && (
                      <Badge variant="outline" className="bg-slate-100">
                        {calculationMethod === "rawAverage"
                          ? "Raw Average"
                          : calculationMethod === "percentage"
                            ? `Percentage of Average (${scalingFactor}%)`
                            : `Percentage of Total Points (${scalingFactor}%)`}
                      </Badge>
                    )}
                  </div>

                  {previewScores.length > 0 ? (
                    <div className="space-y-4">
                      <div className="border rounded-md overflow-hidden">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead>Contestant</TableHead>
                              <TableHead>
                                {calculationMethod === "accumulatedPoints" ? "Total Points" : "Average Score"}
                              </TableHead>
                              <TableHead>Carry-Forward Score</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {previewScores.map((preview) => (
                              <TableRow key={preview.contestantId}>
                                <TableCell>{preview.name}</TableCell>
                                <TableCell>
                                  {calculationMethod === "accumulatedPoints"
                                    ? formatDisplayValue(
                                        Object.values(preview.judgeScores).reduce((sum, score) => sum + score, 0),
                                      )
                                    : formatDisplayValue(preview.rawAverage)}
                                </TableCell>
                                <TableCell className="font-medium">
                                  <div className="flex items-center gap-1">
                                    <span>{formatDisplayValue(preview.score)}</span>
                                    {scores[selectedSegmentId]?.[preview.contestantId]?.[
                                      useCompetitionStore.getState().judges[0]?.id
                                    ]?.[selectedCriterionId] && <CheckCircle className="h-4 w-4 text-green-500" />}
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>

                      {/* Detailed Judge Scores (Expandable) */}
                      <Accordion type="single" collapsible>
                        <AccordionItem value="details">
                          <AccordionTrigger className="text-sm font-medium">Detailed Judge Scores</AccordionTrigger>
                          <AccordionContent>
                            <div className="border rounded-md overflow-x-auto mt-2">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Contestant</TableHead>
                                    {uniqueJudgeIds.map((judgeId, index) => (
                                      <TableHead key={judgeId}>Judge {index + 1}</TableHead>
                                    ))}
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {previewScores.map((preview) => (
                                    <TableRow key={preview.contestantId}>
                                      <TableCell>{preview.name}</TableCell>
                                      {uniqueJudgeIds.map((judgeId) => (
                                        <TableCell key={judgeId}>
                                          {formatDisplayValue(preview.judgeScores[judgeId] || 0)}
                                        </TableCell>
                                      ))}
                                    </TableRow>
                                  ))}
                                </TableBody>
                              </Table>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 border rounded-md bg-slate-50">
                      <div className="text-center text-muted-foreground">
                        <Calculator className="h-12 w-12 mx-auto mb-2 text-slate-300" />
                        <p>No preview available</p>
                        <p className="text-sm mt-1">Configure the settings to see the preview scores</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </CardContent>
    </Card>
  )
}
