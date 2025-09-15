"use client"

import { AlertDialogTrigger } from "@/components/ui/alert-dialog"

import React, { useState, useEffect } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import FinalRankings from "./results/FinalRankings"
import CriteriaScores from "./results/CriteriaScores"
import TestScoring from "./test-scoring"
import { Button } from "@/components/ui/button"
import { ChevronRight, Award, RefreshCw, Clock, Shuffle, Copy } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { calculateSegmentScores } from "@/utils/rankingUtils"
import ActiveCriteriaManager from "@/components/admin/active-criteria-manager"
import { useOptimizedPolling } from "@/hooks/useOptimizedPolling"
import { Badge } from "@/components/ui/badge"
import { JudgeFinalizationStatus } from "@/components/admin/judge-finalization-status"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import { CriteriaAverageScores } from "@/components/CriteriaAverageScores";
import { MinorAwardsCalculator } from "./results/MinorAwardsCalculator"

// Modify the ContestantSequence component to include a ScrollArea and copy button
const ContestantSequence = ({ segmentId }: { segmentId: string }) => {
  const { contestants } = useCompetitionStore()

  // Get contestants in this segment, sorted by display order
  const segmentContestants = contestants
    .filter((c) => c.currentSegmentId === segmentId)
    .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))

  // Add copy function
  const copySequenceToClipboard = () => {
    // Format the contestant sequence as text
    const sequenceText = segmentContestants
      // .map((contestant, index) => `${contestant.displayOrder || index + 1}. ${contestant.name}`)
      .map((contestant, index) => `${contestant.name}`)
      .join("\n")

    // Copy to clipboard
    navigator.clipboard
      .writeText(sequenceText)
      .then(() => {
        toast.success("Contestant sequence copied to clipboard", {
          description: "You can now paste it anywhere you need",
          duration: 3000,
        })
      })
      .catch((error) => {
        console.error("Failed to copy: ", error)
        toast.error("Failed to copy sequence", {
          description: "Please try again or copy manually",
          duration: 3000,
        })
      })
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={copySequenceToClipboard}
          className="flex items-center gap-1"
          disabled={segmentContestants.length === 0}
        >
          <Copy className="h-4 w-4" />
          <span>Copy Sequence</span>
        </Button>
      </div>
      <ScrollArea className="h-[400px]">
        <div className="space-y-1 py-1">
          {segmentContestants.length === 0 ? (
            <p className="text-center text-muted-foreground">No contestants in this segment</p>
          ) : (
            segmentContestants.map((contestant, index) => (
              <div key={contestant.id} className="flex items-center p-1.5 border rounded-md">
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center mr-2">
                  <span className="font-bold text-sm">{contestant.displayOrder || index + 1}</span>
                </div>
                <div>
                  <p className="font-medium text-sm">{contestant.name}</p>
                  <p className="text-xs text-muted-foreground">Display Order: {contestant.displayOrder || "Not set"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  )
}

export function Results() {
  const {
    competitionSettings,
    contestants,
    updateContestantSegment,
    updateContestantDisplayOrder,
    scores,
    judges,
    setScores,
    selectedCompetitionId,
    saveCompetition,
  } = useCompetitionStore()
  const { segments } = competitionSettings
  const [selectedSegmentId, setSelectedSegmentId] = React.useState<string>(segments[0]?.id || "no-segments")
  const [activeContentTab, setActiveContentTab] = React.useState<string>("overview")
  const [showTestScoring, setShowTestScoring] = React.useState(false)
  const [activeTab, setActiveTab] = useState("final-rankings")
  const [isSaving, setIsSaving] = useState(false)
  const [showSequenceDialog, setShowSequenceDialog] = useState(false)

  // Add this state at the top of the Results component, near other state declarations
  const [showAdvanceDialog, setShowAdvanceDialog] = useState(false)
  const [shuffleNextSegment, setShuffleNextSegment] = useState(true)

  // Add a debug panel to help troubleshoot score issues
  const [showDebug, setShowDebug] = React.useState(false)

  // Log the competition settings and ID for debugging
  useEffect(() => {
    console.log("Competition Settings:", competitionSettings)
    console.log("Selected Competition ID from store:", selectedCompetitionId)
  }, [competitionSettings, selectedCompetitionId])

  // Use optimized polling for updates (10 second interval with change detection)
  const { isPolling, lastUpdate, error, hasChanges, refresh, startPolling, stopPolling } = useOptimizedPolling(selectedCompetitionId, 10000)

  // Find the next segment ID
  const currentSegmentIndex = segments.findIndex((segment) => segment.id === selectedSegmentId)
  const nextSegment = segments[currentSegmentIndex + 1]

  // Get contestants in the current segment
  const currentContestants = contestants.filter((c) => c.currentSegmentId === selectedSegmentId)

  // Get the current segment
  const currentSegment = segments.find((s) => s.id === selectedSegmentId)

  // Function to manually refresh data
  const manualRefresh = () => {
    if (selectedCompetitionId) {
      refresh()
      toast.info("Manually refreshing data...")
    } else {
      toast.error("No competition ID available. Cannot refresh data.")
    }
  }

  // Function to shuffle an array using Fisher-Yates algorithm
  const shuffleArray = <T,>(array: T[]): T[] => {
    const newArray = [...array]
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[newArray[i], newArray[j]] = [newArray[j], newArray[i]]
    }
    return newArray
  }

  // Replace the existing handleAdvanceToNextSegment function with this version
  const handleAdvanceToNextSegment = async () => {
    if (!nextSegment) {
      toast.error("This is the last segment. Cannot advance further.")
      return
    }

    if (!currentSegment) {
      toast.error("Current segment not found.")
      return
    }

    // Show the advance dialog instead of immediately advancing
    setShowAdvanceDialog(true)
  }

  // Add this new function to handle the actual advancement after dialog confirmation
  const confirmAdvanceToNextSegment = async () => {
    setShowAdvanceDialog(false)

    // Temporarily stop polling to prevent conflicts
    stopPolling()
    setIsSaving(true)

    try {
      // Get the number of contestants that should advance
      const advancingCount = currentSegment.advancingCandidates || 0

      if (advancingCount <= 0) {
        toast.error(`Please set the number of advancing candidates for ${currentSegment.name} segment.`)
        setIsSaving(false)
        startPolling()
        return
      }

      // Check if gender separation is enabled
      const separateByGender = competitionSettings.separateRankingByGender

      if (separateByGender) {
        // Handle advancing contestants separately by gender
        const maleContestants = currentContestants.filter((c) => c.gender?.toLowerCase() === "male")
        const femaleContestants = currentContestants.filter((c) => c.gender?.toLowerCase() === "female")

        // Log for debugging
        console.log("Results - Advancing with gender separation")
        console.log("Male contestants:", maleContestants.length)
        console.log("Female contestants:", femaleContestants.length)

        // Process male contestants
        const sortedMaleContestants = [...maleContestants]
        // Sort based on the ranking method
        if (
          competitionSettings.ranking.method === "rank-avg-rank" ||
          competitionSettings.ranking.method === "avg-rank"
        ) {
          // Get rankings from the ranking utils for males
          const maleRankings = calculateSegmentScores(
            maleContestants,
            judges,
            scores,
            selectedSegmentId,
            competitionSettings.ranking,
          )

          // Sort by rank (lower is better)
          sortedMaleContestants.sort((a, b) => {
            const rankA = maleRankings[a.id]?.rank || 999
            const rankB = maleRankings[b.id]?.rank || 999
            return rankA - rankB
          })
        } else {
          // For score-based methods (higher is better)
          const maleRankings = calculateSegmentScores(
            maleContestants,
            judges,
            scores,
            selectedSegmentId,
            competitionSettings.ranking,
          )

          // Sort by score (higher is better)
          sortedMaleContestants.sort((a, b) => {
            const scoreA = maleRankings[a.id]?.score || 0
            const scoreB = maleRankings[b.id]?.score || 0
            return scoreB - scoreA
          })
        }

        // Process female contestants
        const sortedFemaleContestants = [...femaleContestants]
        // Sort based on the ranking method
        if (
          competitionSettings.ranking.method === "rank-avg-rank" ||
          competitionSettings.ranking.method === "avg-rank"
        ) {
          // Get rankings from the ranking utils for females
          const femaleRankings = calculateSegmentScores(
            femaleContestants,
            judges,
            scores,
            selectedSegmentId,
            competitionSettings.ranking,
          )

          // Sort by rank (lower is better)
          sortedFemaleContestants.sort((a, b) => {
            const rankA = femaleRankings[a.id]?.rank || 999
            const rankB = femaleRankings[b.id]?.rank || 999
            return rankA - rankB
          })
        } else {
          // For score-based methods (higher is better)
          const femaleRankings = calculateSegmentScores(
            femaleContestants,
            judges,
            scores,
            selectedSegmentId,
            competitionSettings.ranking,
          )

          // Sort by score (higher is better)
          sortedFemaleContestants.sort((a, b) => {
            const scoreA = femaleRankings[a.id]?.score || 0
            const scoreB = femaleRankings[b.id]?.score || 0
            return scoreB - scoreA
          })
        }

        // Get the top contestants from each gender
        const advancingMaleContestants = sortedMaleContestants.slice(0, advancingCount)
        const advancingFemaleContestants = sortedFemaleContestants.slice(0, advancingCount)

        // Combine the advancing contestants
        let advancingContestants = [...advancingMaleContestants, ...advancingFemaleContestants]

        // Shuffle the advancing contestants if option is selected
        if (shuffleNextSegment) {
          advancingContestants = shuffleArray(advancingContestants)
        }

        // Log for debugging
        console.log("Advancing male contestants:", advancingMaleContestants.length)
        console.log("Advancing female contestants:", advancingFemaleContestants.length)
        console.log("Total advancing contestants:", advancingContestants.length)
        console.log(
          "Order:",
          advancingContestants.map((c) => c.name),
        )

        // Move advancing contestants to the next segment and assign display order
        advancingContestants.forEach((contestant, index) => {
          // Update segment
          updateContestantSegment(contestant.id, nextSegment.id)
          // Assign display order (1-based) if shuffling
          if (shuffleNextSegment) {
            updateContestantDisplayOrder(contestant.id, index + 1)
          } else {
            // If not shuffling, use the original index as display order
            // For males, use their position in the sorted male list
            if (contestant.gender?.toLowerCase() === "male") {
              const originalIndex = sortedMaleContestants.findIndex((c) => c.id === contestant.id)
              updateContestantDisplayOrder(contestant.id, originalIndex + 1)
            } else {
              // For females, use their position in the sorted female list
              const originalIndex = sortedFemaleContestants.findIndex((c) => c.id === contestant.id)
              updateContestantDisplayOrder(contestant.id, originalIndex + 1)
            }
          }
        })

        // Save changes to the database
        await saveCompetition()

        toast.success(
          `Advanced ${advancingMaleContestants.length} male and ${advancingFemaleContestants.length} female contestants to ${nextSegment.name}${shuffleNextSegment ? " with randomized order" : " with original order"}`,
        )
      } else {
        // Original logic for when gender separation is not enabled
        // Get contestants sorted by their ranking
        const sortedContestants = [...currentContestants]

        // Sort contestants based on the ranking method
        // For rank-based methods (lower is better)
        if (
          competitionSettings.ranking.method === "rank-avg-rank" ||
          competitionSettings.ranking.method === "avg-rank"
        ) {
          // Get rankings from the ranking utils
          const rankings = calculateSegmentScores(
            contestants,
            judges,
            scores,
            selectedSegmentId,
            competitionSettings.ranking,
          )

          // Add debug logging
          console.log("Results - Advancing contestants using rank-based method:", competitionSettings.ranking.method)
          console.log("Rankings:", rankings)

          // Sort by rank (lower is better)
          sortedContestants.sort((a, b) => {
            const rankA = rankings[a.id]?.rank || 999
            const rankB = rankings[b.id]?.rank || 999

            console.log(`Results - Comparing for advancement: ${a.name} (rank ${rankA}) vs ${b.name} (rank ${rankB})`)

            return rankA - rankB
          })
        } else {
          // For score-based methods (higher is better)
          // Get rankings from the ranking utils
          const rankings = calculateSegmentScores(
            contestants,
            judges,
            scores,
            selectedSegmentId,
            competitionSettings.ranking,
          )

          // Add debug logging
          console.log("Results - Advancing contestants using score-based method:", competitionSettings.ranking.method)
          console.log("Rankings:", rankings)

          // Sort by score (higher is better)
          sortedContestants.sort((a, b) => {
            const scoreA = rankings[a.id]?.score || 0
            const scoreB = rankings[b.id]?.score || 0

            console.log(
              `Results - Comparing for advancement: ${a.name} (score ${scoreA}) vs ${b.name} (score ${scoreB})`,
            )

            return scoreB - scoreA
          })
        }

        // Add debug logging for the final sorted list
        console.log(
          "Results - Sorted contestants for advancement:",
          sortedContestants.map((c) => c.name),
        )

        // Get the top contestants based on advancingCount
        const advancingContestants = sortedContestants.slice(0, advancingCount)

        // Create a copy that we can shuffle if needed
        let finalContestants = [...advancingContestants]

        // Shuffle the advancing contestants if option is selected
        if (shuffleNextSegment) {
          finalContestants = shuffleArray(finalContestants)
          console.log(
            "Shuffled order:",
            finalContestants.map((c) => c.name),
          )
        }

        // Move advancing contestants to the next segment and assign display order
        finalContestants.forEach((contestant, index) => {
          // Update segment
          updateContestantSegment(contestant.id, nextSegment.id)

          // Assign display order (1-based)
          if (shuffleNextSegment) {
            // If shuffling, use the new shuffled index
            updateContestantDisplayOrder(contestant.id, index + 1)
          } else {
            // If not shuffling, use the original ranking position
            const originalIndex = sortedContestants.findIndex((c) => c.id === contestant.id)
            updateContestantDisplayOrder(contestant.id, originalIndex + 1)
          }
        })

        // Save changes to the database
        await saveCompetition()

        toast.success(
          `Advanced ${advancingContestants.length} contestants to ${nextSegment.name}${shuffleNextSegment ? " with randomized order" : " with original order"}`,
        )
      }

      // Switch to the next segment tab
      setSelectedSegmentId(nextSegment.id)
    } catch (error) {
      console.error("Error advancing contestants:", error)
      toast.error("Failed to advance contestants. Please try again.")
    } finally {
      setIsSaving(false)
      // Resume polling after the operation is complete
      startPolling()
    }
  }

  // Add this new function to reset display orders for debugging
  const resetDisplayOrder = async () => {
    // Temporarily stop polling to prevent conflicts
    stopPolling()
    setIsSaving(true)

    try {
      // Get contestants in the current segment
      const segmentContestants = contestants.filter((c) => c.currentSegmentId === selectedSegmentId)

      // Sort them by ID to have a consistent order
      const sortedContestants = [...segmentContestants].sort((a, b) => Number.parseInt(a.id) - Number.parseInt(b.id))

      // Assign sequential display orders (1, 2, 3...)
      sortedContestants.forEach((contestant, index) => {
        updateContestantDisplayOrder(contestant.id, index + 1)
      })

      // Save changes to the database
      await saveCompetition()

      toast.success(`Reset display order for ${sortedContestants.length} contestants in ${currentSegment?.name}`)
    } catch (error) {
      console.error("Error resetting display order:", error)
      toast.error("Failed to reset display order. Please try again.")
    } finally {
      setIsSaving(false)
      // Resume polling after the operation is complete
      startPolling()
    }
  }

  return (
    <div className="space-y-4">
      {/* Polling status indicator */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <div className={`h-2 w-2 rounded-full ${isPolling ? "bg-green-500" : "bg-red-500"}`}></div>
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{isPolling ? "Auto-refresh active" : "Auto-refresh inactive"}</span>
          {lastUpdate && (
            <Badge variant="outline" className="ml-2">
              Last update: {lastUpdate.toLocaleTimeString()}
            </Badge>
          )}
          {error && <span className="text-red-500 ml-2">{error}</span>}
          <div className="ml-auto flex gap-2">
            {/* <Button size="sm" variant="outline" onClick={isPolling ? stopPolling : startPolling}>
              {isPolling ? "Pause Updates" : "Resume Updates"}
            </Button>
            <Button size="sm" variant="outline" onClick={manualRefresh}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh Now
            </Button> */}
          </div>
        </div>

        {!selectedCompetitionId && (
          <Alert variant="destructive" className="mt-2">
            <AlertTitle>No Competition ID</AlertTitle>
            <AlertDescription>
              No competition ID is available. Updates will not work until a competition is loaded.
              <div className="mt-2">
                <Button size="sm" variant="secondary" onClick={() => window.location.reload()}>
                  Reload Page
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {showDebug && (
          <div className="text-xs bg-muted p-2 rounded">
            <h4 className="font-medium mt-2 mb-1">Competition Info:</h4>
            <div>Competition ID: {selectedCompetitionId || "Not available"}</div>
            <div>Polling Status: {isPolling ? "Active" : "Inactive"}</div>
            <div>Last Update: {lastUpdate ? lastUpdate.toLocaleTimeString() : "Never"}</div>
          </div>
        )}
      </div>

      {/* Place Active Criteria Manager and Judge Finalization Status on the same row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          {/* Use the ActiveCriteriaManager directly */}
          <ActiveCriteriaManager />
        </div>

        {selectedCompetitionId && (
          <div>
            {/* Keep JudgeFinalizationStatus in the main component to receive polling updates */}
            <JudgeFinalizationStatus competitionId={selectedCompetitionId} segmentId={selectedSegmentId} />
          </div>
        )}
      </div>

      {/* Debug and Test Scoring Toggles */}
      <div className="flex justify-end gap-2">
        <CriteriaAverageScores />
        {/* <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </Button>
        <Button
          variant={showTestScoring ? "default" : "outline"}
          size="sm"
          onClick={() => setShowTestScoring(!showTestScoring)}
        >
          {showTestScoring ? "Hide Test Scoring" : "Show Test Scoring"}
        </Button> */}
      </div>

      {showDebug && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Debug Information</CardTitle>
            <CardDescription>Current state of scores and ranking configuration</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <h3 className="text-sm font-medium mb-2">Current Ranking Configuration:</h3>
                <pre className="text-xs bg-muted p-2 rounded">
                  {JSON.stringify(competitionSettings.ranking, null, 2)}
                </pre>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Current Scores Structure:</h3>
                <div className="max-h-60 overflow-auto">
                  <pre className="text-xs bg-muted p-2 rounded">{JSON.stringify(Object.keys(scores), null, 2)}</pre>
                </div>
              </div>
              <div>
                <h3 className="text-sm font-medium mb-2">Selected Segment Scores:</h3>
                <div className="max-h-60 overflow-auto">
                  <pre className="text-xs bg-muted p-2 rounded">
                    {JSON.stringify(scores[selectedSegmentId] || {}, null, 2)}
                  </pre>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {showTestScoring && (
        <Card className="mb-6">
          <TestScoring />
        </Card>
      )}

      {/* Segment Navigation and Advancement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Award className="mr-2 h-5 w-5" />
            Competition Progress
          </CardTitle>
          <CardDescription>View results by segment and advance contestants to the next round</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col space-y-4">
            <div className="flex items-center space-x-2">
              {segments.map((segment, index) => (
                <React.Fragment key={segment.id}>
                  <div
                    className={`px-4 py-2 rounded-md cursor-pointer border-2 ${selectedSegmentId === segment.id ? "border-primary bg-primary/10" : "border-border"}`}
                    onClick={() => setSelectedSegmentId(segment.id)}
                  >
                    <span className="font-medium">{segment.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      ({contestants.filter((c) => c.currentSegmentId === segment.id).length} contestants)
                    </span>
                  </div>

                  {index < segments.length - 1 && <ChevronRight className="h-5 w-5 text-muted-foreground" />}
                </React.Fragment>
              ))}
            </div>

            <Separator />

            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm">
                  <span className="font-medium">Current Segment:</span> {currentSegment?.name}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Contestants:</span> {currentContestants.length}
                </p>
                <p className="text-sm">
                  <span className="font-medium">Advancing:</span> {currentSegment?.advancingCandidates || 0}
                </p>
              </div>

              <div className="flex gap-2">
                {/* Contestant Sequence Dialog */}
                <Dialog>
                  <DialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                      // Disable the button if we're in the first segment
                      disabled={currentSegmentIndex === 0}
                      title={
                        currentSegmentIndex === 0
                          ? "First segment is always in original order"
                          : "View contestant sequence"
                      }
                    >
                      <Shuffle className="h-4 w-4" />
                      View Contestant Sequence
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-md">
                    <DialogHeader>
                      <DialogTitle>Contestant Sequence for {currentSegment?.name}</DialogTitle>
                    </DialogHeader>
                    <ContestantSequence segmentId={selectedSegmentId} />
                  </DialogContent>
                </Dialog>

                {/* Add Reset Display Order Button */}
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="outline"
                      className="flex items-center gap-2"
                      title="Reset display order for debugging"
                    >
                      <RefreshCw className="h-4 w-4" />
                      {/* Reset Display Order */}
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Reset Display Order</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will reset the display order of all contestants in the current segment to sequential
                        numbers (1, 2, 3...). This is for debugging purposes only.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={resetDisplayOrder} disabled={isSaving}>
                        {isSaving ? "Resetting..." : "Reset Display Order"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <Button onClick={handleAdvanceToNextSegment} disabled={!nextSegment}>
                  Advance to {nextSegment?.name || "Next"} <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Advance Confirmation Dialog */}
      <AlertDialog open={showAdvanceDialog} onOpenChange={setShowAdvanceDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Advance Contestants</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to advance the top {currentSegment?.advancingCandidates || 0} contestants to the{" "}
              {nextSegment?.name} segment.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <div className="flex items-center space-x-2 mb-4">
              <input
                type="checkbox"
                id="shuffle-contestants"
                checked={shuffleNextSegment}
                onChange={(e) => setShuffleNextSegment(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
              />
              <label htmlFor="shuffle-contestants" className="text-sm font-medium">
                Randomize contestant order (hide rankings)
              </label>
            </div>
            <div className="bg-muted p-3 rounded-md text-sm">
              {shuffleNextSegment ? (
                <p>
                  <span className="font-medium">Randomized order:</span> Contestants will be shown to judges in a random
                  order, hiding their current rankings.
                </p>
              ) : (
                <p>
                  <span className="font-medium">Original order:</span> Contestants will be shown to judges in order of
                  their current rankings.
                </p>
              )}
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={confirmAdvanceToNextSegment} disabled={isSaving}>
              {isSaving ? "Advancing..." : "Advance Contestants"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Results Tabs */}
      <Tabs defaultValue="final-rankings" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="final-rankings">Final Rankings</TabsTrigger>
          <TabsTrigger value="criteria-scores">Criteria Scores</TabsTrigger>
          <TabsTrigger value="minor-awards">Minor Awards</TabsTrigger>
        </TabsList>
        <TabsContent value="final-rankings">
          <FinalRankings segmentId={selectedSegmentId} />
        </TabsContent>
        <TabsContent value="criteria-scores">
          <CriteriaScores segmentId={selectedSegmentId} />
        </TabsContent>
        <TabsContent value="minor-awards">
          <MinorAwardsCalculator />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Results
