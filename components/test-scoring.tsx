"use client"

import { useState, useEffect } from "react"
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { toast } from "sonner"

export default function TestScoring() {
  const { contestants, judges, competitionSettings, scores, setScores, selectedCompetitionId } = useCompetitionStore()
  const [selectedJudge, setSelectedJudge] = useState<string | null>(null)
  const [selectedSegment, setSelectedSegment] = useState<string | null>(null)
  const [selectedCriterion, setSelectedCriterion] = useState<string | null>(null)
  const [scoreInputs, setScoreInputs] = useState<Record<string, number>>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Get the selected segment
  const segment = selectedSegment ? competitionSettings.segments.find((s) => s.id === selectedSegment) : null

  // Get the selected criterion
  const criterion = selectedCriterion && segment ? segment.criteria.find((c) => c.id === selectedCriterion) : null

  // Get contestants in the selected segment
  const segmentContestants = selectedSegment ? contestants.filter((c) => c.currentSegmentId === selectedSegment) : []

  // Initialize score inputs when judge, segment, or criterion changes
  useEffect(() => {
    if (selectedJudge && selectedSegment && selectedCriterion) {
      initializeScoreInputs()
    }
  }, [selectedJudge, selectedSegment, selectedCriterion])

  const initializeScoreInputs = () => {
    const newScoreInputs: Record<string, number> = {}

    segmentContestants.forEach((contestant) => {
      // Check if there's an existing score for this criterion
      if (
        selectedJudge &&
        selectedSegment &&
        selectedCriterion &&
        scores[selectedSegment]?.[contestant.id]?.[selectedJudge]?.[selectedCriterion]
      ) {
        newScoreInputs[contestant.id] = scores[selectedSegment][contestant.id][selectedJudge][selectedCriterion]
      } else {
        newScoreInputs[contestant.id] = 0
      }
    })

    setScoreInputs(newScoreInputs)
  }

  // Handle score input change
  const handleScoreChange = (contestantId: string, value: string) => {
    const numValue = Number(value)
    const maxScore = criterion?.maxScore || 100

    // Validate score
    if (numValue < 0) {
      setScoreInputs((prev) => ({ ...prev, [contestantId]: 0 }))
    } else if (numValue > maxScore) {
      setScoreInputs((prev) => ({ ...prev, [contestantId]: maxScore }))
    } else {
      setScoreInputs((prev) => ({ ...prev, [contestantId]: numValue }))
    }
  }

  // Update the handleSubmitScores function to ensure scores are properly saved
  const handleSubmitScores = async () => {
    if (!selectedJudge || !selectedSegment || !selectedCriterion) {
      toast.error("Please select a judge, segment, and criterion")
      return
    }

    setIsSubmitting(true)

    try {
      // Save each score
      for (const [contestantId, score] of Object.entries(scoreInputs)) {
        // Use the updated setScores function with criterionId
        setScores(selectedSegment, contestantId, selectedJudge, selectedCriterion, score)
      }

      toast.success("Scores saved successfully")

      // Log the current scores for debugging
      console.log("Current scores after saving:", scores)
    } catch (error) {
      console.error("Error saving scores:", error)
      toast.error("Failed to save scores")
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div>
      <CardHeader>
        <CardTitle>Test Scoring Interface</CardTitle>
        <CardDescription>
          This is a test interface for entering scores. In a production environment, judges would have their own
          interface.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="judge-select">Select Judge</Label>
              <Select
                value={selectedJudge || ""}
                onValueChange={(value) => {
                  setSelectedJudge(value)
                }}
              >
                <SelectTrigger id="judge-select">
                  <SelectValue placeholder="Select a judge" />
                </SelectTrigger>
                <SelectContent>
                  {judges.map((judge) => (
                    <SelectItem key={judge.id} value={judge.id}>
                      {judge.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="segment-select">Select Segment</Label>
              <Select
                value={selectedSegment || ""}
                onValueChange={(value) => {
                  setSelectedSegment(value)
                  setSelectedCriterion(null) // Reset criterion when segment changes
                }}
              >
                <SelectTrigger id="segment-select">
                  <SelectValue placeholder="Select a segment" />
                </SelectTrigger>
                <SelectContent>
                  {competitionSettings.segments.map((segment) => (
                    <SelectItem key={segment.id} value={segment.id}>
                      {segment.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="criterion-select">Select Criterion</Label>
              <Select
                value={selectedCriterion || ""}
                onValueChange={(value) => {
                  setSelectedCriterion(value)
                }}
                disabled={!selectedSegment}
              >
                <SelectTrigger id="criterion-select">
                  <SelectValue placeholder="Select a criterion" />
                </SelectTrigger>
                <SelectContent>
                  {segment?.criteria.map((criterion) => (
                    <SelectItem key={criterion.id} value={criterion.id}>
                      {criterion.name} (Max: {criterion.maxScore})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {selectedJudge && selectedSegment && selectedCriterion && (
            <div className="space-y-4">
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Contestant</TableHead>
                      <TableHead>Score (Max: {criterion?.maxScore})</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {segmentContestants.map((contestant) => (
                      <TableRow key={contestant.id}>
                        <TableCell>{contestant.name}</TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            min={0}
                            max={criterion?.maxScore}
                            value={scoreInputs[contestant.id] || 0}
                            onChange={(e) => handleScoreChange(contestant.id, e.target.value)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {segmentContestants.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2} className="text-center py-4 text-muted-foreground">
                          No contestants in this segment
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>

              <Button
                onClick={handleSubmitScores}
                disabled={isSubmitting || segmentContestants.length === 0}
                className="w-full"
              >
                {isSubmitting ? "Saving..." : "Save Scores"}
              </Button>
              <div className="mt-4 p-4 border rounded-md bg-muted/20">
                <h3 className="text-sm font-medium mb-2">Debug: Current Scores</h3>
                <pre className="text-xs overflow-auto max-h-40">{JSON.stringify(scores, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </div>
  )
}
