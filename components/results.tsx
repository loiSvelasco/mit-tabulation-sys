"use client"

import React, { useState, useEffect } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import FinalRankings from "./results/FinalRankings"
import DetailedScores from "./results/DetailedScores"
import JudgeComparison from "./results/JudgeComparison"
import RankingBreakdown from "./results/RankingBreakdown"
import CriteriaScores from "./results/CriteriaScores"
import TestScoring from "./test-scoring"
import { Button } from "@/components/ui/button"
import { ChevronRight, Award, BarChart3, RefreshCw, Clock } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { calculateSegmentScores } from "@/utils/rankingUtils"
import { ActiveCriteriaManager } from "@/components/admin/active-criteria-manager"
import { usePolling } from "@/hooks/usePolling"
import { Badge } from "@/components/ui/badge"

export function Results() {
  const {
    competitionSettings,
    contestants,
    updateContestantSegment,
    scores,
    judges,
    setScores,
    selectedCompetitionId,
  } = useCompetitionStore()
  const { segments } = competitionSettings
  const [selectedSegmentId, setSelectedSegmentId] = React.useState<string>(segments[0]?.id || "no-segments")
  const [activeContentTab, setActiveContentTab] = React.useState<string>("overview")
  const [showTestScoring, setShowTestScoring] = React.useState(false)
  const [activeTab, setActiveTab] = useState("final-rankings")

  // Add a debug panel to help troubleshoot score issues
  const [showDebug, setShowDebug] = React.useState(false)

  // Log the competition settings and ID for debugging
  useEffect(() => {
    console.log("Competition Settings:", competitionSettings)
    console.log("Selected Competition ID from store:", selectedCompetitionId)
  }, [competitionSettings, selectedCompetitionId])

  // Use polling for updates (5 second interval)
  const { isPolling, lastUpdate, error, refresh, startPolling, stopPolling } = usePolling(selectedCompetitionId, 5000)

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

  // Add this function to the Results component
  const handleAdvanceToNextSegment = () => {
    if (!nextSegment) {
      toast.error("This is the last segment. Cannot advance further.")
      return
    }

    if (!currentSegment) {
      toast.error("Current segment not found.")
      return
    }

    // Get the number of contestants that should advance
    const advancingCount = currentSegment.advancingCandidates || 0

    if (advancingCount <= 0) {
      toast.error(`Please set the number of advancing candidates for ${currentSegment.name} segment.`)
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
      if (competitionSettings.ranking.method === "rank-avg-rank" || competitionSettings.ranking.method === "avg-rank") {
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
      if (competitionSettings.ranking.method === "rank-avg-rank" || competitionSettings.ranking.method === "avg-rank") {
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
      const advancingContestants = [...advancingMaleContestants, ...advancingFemaleContestants]

      // Log for debugging
      console.log("Advancing male contestants:", advancingMaleContestants.length)
      console.log("Advancing female contestants:", advancingFemaleContestants.length)
      console.log("Total advancing contestants:", advancingContestants.length)

      // Move advancing contestants to the next segment
      advancingContestants.forEach((contestant) => {
        // Update segment
        updateContestantSegment(contestant.id, nextSegment.id)
      })

      toast.success(
        `Advanced ${advancingMaleContestants.length} male and ${advancingFemaleContestants.length} female contestants to ${nextSegment.name}`,
      )
    } else {
      // Original logic for when gender separation is not enabled
      // Get contestants sorted by their ranking
      const sortedContestants = [...currentContestants]

      // Sort contestants based on the ranking method
      // For rank-based methods (lower is better)
      if (competitionSettings.ranking.method === "rank-avg-rank" || competitionSettings.ranking.method === "avg-rank") {
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

          console.log(`Results - Comparing for advancement: ${a.name} (score ${scoreA}) vs ${b.name} (score ${scoreB})`)

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

      // Move advancing contestants to the next segment
      advancingContestants.forEach((contestant) => {
        // Update segment
        updateContestantSegment(contestant.id, nextSegment.id)
      })

      toast.success(`Advanced ${advancingContestants.length} contestants to ${nextSegment.name}`)
    }

    // Switch to the next segment tab
    setSelectedSegmentId(nextSegment.id)
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
            <Button size="sm" variant="outline" onClick={isPolling ? stopPolling : startPolling}>
              {isPolling ? "Pause Updates" : "Resume Updates"}
            </Button>
            <Button size="sm" variant="outline" onClick={manualRefresh}>
              <RefreshCw className="h-3 w-3 mr-1" /> Refresh Now
            </Button>
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

      {/* Add the Active Criteria Manager at the top of the Results component */}
      <ActiveCriteriaManager />

      {/* Phase 1 Notice */}
      <Alert>
        <BarChart3 className="h-4 w-4" />
        <AlertTitle>Phase 1 Implementation</AlertTitle>
        <AlertDescription>
          This is the Phase 1 implementation of the tabulation system. In Phase 2, we will implement full per-criteria
          scoring and database integration.
        </AlertDescription>
      </Alert>

      {/* Test Scoring Toggle */}
      <div className="flex justify-end">
        <Button variant={showTestScoring ? "default" : "outline"} onClick={() => setShowTestScoring(!showTestScoring)}>
          {showTestScoring ? "Hide Test Scoring" : "Show Test Scoring"}
        </Button>
      </div>

      <div className="flex justify-end mt-2">
        <Button variant="outline" size="sm" onClick={() => setShowDebug(!showDebug)}>
          {showDebug ? "Hide Debug Info" : "Show Debug Info"}
        </Button>
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

              <Button onClick={handleAdvanceToNextSegment} disabled={!nextSegment}>
                Advance to {nextSegment?.name || "Next"} <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Results Tabs */}
      <Tabs defaultValue="final-rankings" value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="final-rankings">Final Rankings</TabsTrigger>
          <TabsTrigger value="ranking-breakdown">Ranking Breakdown</TabsTrigger>
          <TabsTrigger value="detailed-scores">Detailed Scores</TabsTrigger>
          <TabsTrigger value="judge-comparison">Judge Comparison</TabsTrigger>
          <TabsTrigger value="criteria-scores">Criteria Scores</TabsTrigger>
        </TabsList>
        <TabsContent value="final-rankings">
          <FinalRankings segmentId={selectedSegmentId} />
        </TabsContent>
        <TabsContent value="ranking-breakdown">
          <RankingBreakdown segmentId={selectedSegmentId} />
        </TabsContent>
        <TabsContent value="detailed-scores">
          <DetailedScores segmentId={selectedSegmentId} />
        </TabsContent>
        <TabsContent value="judge-comparison">
          <JudgeComparison segmentId={selectedSegmentId} />
        </TabsContent>
        <TabsContent value="criteria-scores">
          <CriteriaScores segmentId={selectedSegmentId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Results
