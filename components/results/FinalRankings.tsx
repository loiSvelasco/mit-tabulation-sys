"use client"

// Let's update the imports section to add the needed components
import React, { useState, useCallback, useMemo, useEffect } from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight, HelpCircle, Info, BarChart2, LineChart, PieChart } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateSegmentScores, convertScoresToRanks, roundToTwoDecimals } from "@/utils/rankingUtils"
import { useDatabaseRankings } from "@/hooks/useDatabaseRankings"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Slider } from "@/components/ui/slider"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PrintResults } from "../print-results"

// Type definitions
interface Contestant {
  id: string
  name: string
  gender?: string
  currentSegmentId?: string
}

interface Judge {
  id: string
  name: string
}

interface Criterion {
  id: string
  name: string
  maxScore: number
  weight?: number
}

interface Segment {
  id: string
  name: string
  criteria: Criterion[]
  advancingCandidates?: number
}

interface RankingSettings {
  method: string
  tiebreaker: string
  trimPercentage?: number
  customFormula?: string
}

interface CompetitionSettings {
  segments: Segment[]
  ranking: RankingSettings
  separateRankingByGender: boolean
}

interface ScoreEntry {
  [criterionId: string]: number
}

interface ContestantScores {
  [judgeId: string]: ScoreEntry
}

interface SegmentScores {
  [contestantId: string]: ContestantScores
}

interface Scores {
  [segmentId: string]: SegmentScores
}

interface RankingResult {
  rank: number
  score: number
}

interface Rankings {
  [contestantId: string]: RankingResult
}

interface JudgeRankings {
  [contestantId: string]: number
}

interface AllJudgeRankings {
  [judgeId: string]: JudgeRankings
}

interface JudgeScores {
  [contestantId: string]: number
}

interface AllJudgeScores {
  [judgeId: string]: JudgeScores
}

interface TotalScores {
  [contestantId: string]: number
}

interface AvgCriteriaScores {
  [contestantId: string]: {
    [criterionId: string]: number
  }
}

interface RankingCalculations {
  rankings: Rankings
  judgeRankings: AllJudgeRankings
  judgeScores: AllJudgeScores
  totalScores: TotalScores
  avgScores: TotalScores
  avgCriteriaScores: AvgCriteriaScores
}


// Helper functions for common calculations
function getJudgeTotalScore(scores: Scores, segmentId: string, contestantId: string, judgeId: string): number {
  if (!scores[segmentId]?.[contestantId]?.[judgeId]) return 0

  const total = Object.values(scores[segmentId][contestantId][judgeId]).reduce((sum, score) => sum + score, 0)
  return roundToTwoDecimals(total)
}

function getCriterionScore(
  scores: Scores,
  segmentId: string,
  contestantId: string,
  judgeId: string,
  criterionId: string,
): number {
  return scores[segmentId]?.[contestantId]?.[judgeId]?.[criterionId] || 0
}

function calculatePercentage(value: number, maxValue: number): number {
  if (!maxValue || maxValue <= 0) return 0
  return roundToTwoDecimals((value / maxValue) * 100)
}

function calculateAvgCriterionScore(
  scores: Scores,
  segmentId: string,
  contestantId: string,
  judges: Judge[],
  criterionId: string,
): number {
  let totalScore = 0
  let count = 0

  judges.forEach((judge) => {
    const score = getCriterionScore(scores, segmentId, contestantId, judge.id, criterionId)
    if (score > 0) {
      totalScore += score
      count++
    }
  })

  return count > 0 ? roundToTwoDecimals(totalScore / count) : 0
}

function calculateAvgRank(judgeRankings: AllJudgeRankings, contestantId: string): number {
  let totalRank = 0
  let rankCount = 0

  Object.values(judgeRankings).forEach((rankings) => {
    const rank = rankings[contestantId]
    if (rank) {
      totalRank += rank
      rankCount++
    }
  })

  return rankCount > 0 ? roundToTwoDecimals(totalRank / rankCount) : 0
}

// Add a helper function to format a formula for display
const formatFormula = (formula: string): string => {
  // Replace common operations for better readability
  return formula
    .replace(/\*/g, " × ")
    .replace(/\//g, " ÷ ")
    .replace(/\+/g, " + ")
    .replace(/-/g, " - ")
    .replace(/Math\.min/g, "min")
    .replace(/Math\.max/g, "max")
    .replace(/Math\.sqrt/g, "√")
    .replace(/Math\.pow$$([^,]+), ?([^)]+)$$/g, "$1^$2")
}

// Add a function to parse and evaluate formula steps
const evaluateFormulaSteps = (
  formula: string,
  variables: Record<string, number>,
): { steps: Array<{ description: string; result: number }>; finalResult: number } => {
  // This is a simplified parser. For complex formulas, we'd need a more robust approach.
  const steps: Array<{ description: string; result: number }> = []
  let processedFormula = formula

  // Replace variables with their values
  Object.entries(variables).forEach(([name, value]) => {
    const regex = new RegExp(name, "g")
    processedFormula = processedFormula.replace(regex, value.toString())
    steps.push({
      description: `Replace ${name} with its value ${value.toFixed(2)}`,
      result: value,
    })
  })

  // Try to evaluate the formula
  try {
    // eslint-disable-next-line no-new-func
    const evalFunction = new Function(`return ${processedFormula}`)
    const result = evalFunction()
    steps.push({
      description: `Evaluate the expression: ${formatFormula(processedFormula)}`,
      result: roundToTwoDecimals(result),
    })
    return { steps, finalResult: roundToTwoDecimals(result) }
  } catch (error) {
    console.error("Error evaluating formula:", error)
    steps.push({
      description: `Error evaluating: ${formatFormula(processedFormula)}`,
      result: 0,
    })
    return { steps, finalResult: 0 }
  }
}

interface Props {
  segmentId: string
}

const FinalRankings: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore() as {
    contestants: Contestant[]
    judges: Judge[]
    scores: Scores
    competitionSettings: CompetitionSettings
  }

  const separateByGender = competitionSettings.separateRankingByGender
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [refreshKey, setRefreshKey] = useState(0) // Used to force re-render
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  // Get the selected segment and criteria
  const segment = useMemo(
    () => competitionSettings.segments.find((s) => s.id === segmentId),
    [competitionSettings.segments, segmentId],
  )

  const criteria = useMemo(() => segment?.criteria || [], [segment])

  // Get contestants in the selected segment
  const segmentContestants = useMemo(
    () => contestants.filter((c) => c.currentSegmentId === segmentId),
    [contestants, segmentId],
  )

  // Get database-driven rankings for the main display
  const { 
    lastUpdated,
    refreshRankings
  } = useDatabaseRankings(
    segmentId,
    segmentContestants,
    judges,
    competitionSettings,
    false
  )

  // Auto-refresh rankings when scores change in the store
  useEffect(() => {
    // Only refresh if we have data and it's not already refreshing
    if (segmentId && segmentContestants.length > 0 && judges.length > 0 && !isRefreshing) {
      console.log("Scores changed, auto-refreshing rankings...")
      // Use a small delay to avoid too frequent refreshes
      const timeoutId = setTimeout(() => {
        refreshRankings()
      }, 100)
      
      return () => clearTimeout(timeoutId)
    }
  }, [scores, segmentId, segmentContestants.length, judges.length, isRefreshing, refreshRankings])

  // Group contestants by gender if needed - using case-insensitive comparison
  const maleContestants = useMemo(
    () => segmentContestants.filter((c) => c.gender?.toLowerCase() === "male"),
    [segmentContestants],
  )

  const femaleContestants = useMemo(
    () => segmentContestants.filter((c) => c.gender?.toLowerCase() === "female"),
    [segmentContestants],
  )

  // Toggle row expansion
  const toggleRowExpansion = useCallback((contestantId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [contestantId]: !prev[contestantId],
    }))
  }, [])

  // Enhanced refresh handler with proper async handling
  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return // Prevent multiple clicks
    
    setIsRefreshing(true)
    setRefreshError(null)
    
    try {
      await refreshRankings()
      console.log("Rankings refreshed successfully")
    } catch (error) {
      console.error("Error refreshing rankings:", error)
      setRefreshError(error instanceof Error ? error.message : "Failed to refresh rankings")
    } finally {
      setIsRefreshing(false)
    }
  }, [isRefreshing, refreshRankings])

  // Reset function for debugging
  const handleReset = useCallback(() => {
    // Clear expanded rows
    setExpandedRows({})
    // Force re-render by updating the refresh key
    setRefreshKey((prev) => prev + 1)
    console.log("Rankings display reset for debugging")
  }, [])

  const renderRankingsTable = useCallback(
    (contestantsGroup: Contestant[], groupTitle?: string) => {
      return (
        <RankingsTable
          segmentId={segmentId}
          contestantsGroup={contestantsGroup}
          groupTitle={groupTitle}
          judges={judges}
          scores={scores}
          competitionSettings={competitionSettings}
          expandedRows={expandedRows}
          toggleRowExpansion={toggleRowExpansion}
        />
      )
    },
    [competitionSettings, expandedRows, judges, scores, segmentId, toggleRowExpansion],
  )

  return (
    <div>
      <div className="flex items-center gap-2 justify-between">
        <div className="flex items-center gap-2">
        <h2 className="flex text-lg font-semibold mb-2">Final Rankings</h2>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            (Updated: {lastUpdated.toLocaleTimeString()})
          </span>
        )}
          <Popover>
          <PopoverTrigger>
            <HelpCircle size={16} className="text-muted-foreground" />
          </PopoverTrigger>
          <PopoverContent className="w-80">
            <div className="space-y-2">
              <h3 className="font-medium">About Rankings</h3>
              <p className="text-sm text-muted-foreground">
                This table shows the final rankings calculated using the selected method. Click the arrow next to each
                contestant to see detailed breakdowns and visualizations.
              </p>
              <h4 className="text-sm font-medium mt-2">Available Methods:</h4>
              <ul className="text-xs space-y-1">
                <li>
                  <span className="font-medium">AVG</span> - Simple average of scores
                </li>
                <li>
                  <span className="font-medium">MEDIAN</span> - Middle value of all scores
                </li>
                <li>
                  <span className="font-medium">TRIMMED</span> - Average after removing extreme values
                </li>
                <li>
                  <span className="font-medium">WEIGHTED</span> - Scores weighted by criteria importance
                </li>
                <li>
                  <span className="font-medium">BORDA</span> - Points assigned based on ranks
                </li>
                <li>
                  <span className="font-medium">CUSTOM</span> - User-defined formula
                </li>
              </ul>
            </div>
          </PopoverContent>
        </Popover>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className={`px-3 py-1 text-sm rounded flex items-center gap-1 transition-colors ${
              isRefreshing 
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                : 'bg-primary/10 text-primary hover:bg-primary/20'
            }`}
            title={isRefreshing ? "Refreshing rankings..." : "Refresh rankings from database"}
          >
            {isRefreshing ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary" />
            ) : (
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            )}
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </button>
          <PrintResults key={segment?.id} segmentId={segmentId} />
        </div>
      </div>

      {/* Error display for refresh failures */}
      {refreshError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm text-red-700">Refresh failed: {refreshError}</span>
            <button
              onClick={() => setRefreshError(null)}
              className="ml-auto text-red-500 hover:text-red-700"
              title="Dismiss error"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <p className="text-sm text-muted-foreground mb-4">
        Using{" "}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="font-medium underline decoration-dotted">
              {competitionSettings.ranking.method.toUpperCase()}
            </TooltipTrigger>
            <TooltipContent>
              {competitionSettings.ranking.method === "avg" && "Calculates the arithmetic mean of all judges' scores."}
              {competitionSettings.ranking.method === "median" && "Uses the middle value from the set of all scores."}
              {competitionSettings.ranking.method === "trimmed" &&
                `Removes the highest and lowest ${competitionSettings.ranking.trimPercentage || 20}% of scores before calculating the average.`}
              {competitionSettings.ranking.method === "weighted" &&
                "Applies weights to different criteria when calculating scores."}
              {competitionSettings.ranking.method === "borda" &&
                "Assigns points based on ranks (higher for better ranks)."}
              {competitionSettings.ranking.method === "custom" &&
                "Uses a custom mathematical formula to calculate scores."}
              {competitionSettings.ranking.method === "avg-rank" &&
                "Calculates total scores, then ranks contestants accordingly."}
              {competitionSettings.ranking.method === "rank-avg-rank" &&
                "Converts each judge's scores to ranks, then averages those ranks."}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>{" "}
        ranking method with{" "}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="font-medium underline decoration-dotted">
              {competitionSettings.ranking.tiebreaker}
            </TooltipTrigger>
            <TooltipContent>
              {competitionSettings.ranking.tiebreaker === "none" && "No tiebreaker is applied."}
              {competitionSettings.ranking.tiebreaker === "highest-score" &&
                "Breaks ties by comparing the highest individual score received."}
              {competitionSettings.ranking.tiebreaker === "head-to-head" &&
                "Breaks ties by comparing how many judges ranked one contestant higher than the other."}
              {competitionSettings.ranking.tiebreaker === "specific-criteria" &&
                "Breaks ties using a specific criterion's scores."}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>{" "}
        tiebreaker
      </p>

      {separateByGender ? (
        <div className="space-y-6">
          {maleContestants.length > 0 && renderRankingsTable(maleContestants, "Male Division")}
          {femaleContestants.length > 0 && renderRankingsTable(femaleContestants, "Female Division")}
          {maleContestants.length === 0 && femaleContestants.length === 0 && (
            <div className="p-8 text-center text-muted-foreground">
              <div className="text-4xl mb-2">📊</div>
              <h3 className="text-lg font-medium mb-1">No Data Yet</h3>
              <p className="text-sm">No contestants have been assigned to this segment yet.</p>
            </div>
          )}
        </div>
      ) : (
        segmentContestants.length > 0 ? (
        renderRankingsTable(segmentContestants)
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            <div className="text-4xl mb-2">📊</div>
            <h3 className="text-lg font-medium mb-1">No Data Yet</h3>
            <p className="text-sm">No contestants have been assigned to this segment yet.</p>
          </div>
        )
      )}

      {segment && segment.advancingCandidates && segment.advancingCandidates > 0 && (
        <p className="text-sm mt-4">
          <span className="font-medium">Note:</span> Top {segment.advancingCandidates} contestants will advance to the
          next segment.
        </p>
      )}
    </div>
  )
}

interface RankingsTableProps {
  segmentId: string
  contestantsGroup: Contestant[]
  groupTitle?: string
  judges: Judge[]
  scores: Scores
  competitionSettings: CompetitionSettings
  expandedRows: Record<string, boolean>
  toggleRowExpansion: (contestantId: string) => void
}

const RankingsTable: React.FC<RankingsTableProps> = ({
  segmentId,
  contestantsGroup,
  groupTitle,
  judges,
  scores,
  competitionSettings,
  expandedRows,
  toggleRowExpansion,
}) => {
  const criteria = useMemo(() => {
    const segment = competitionSettings.segments.find((s) => s.id === segmentId)
    return segment?.criteria || []
  }, [competitionSettings.segments, segmentId])

  const { 
    rankings, 
    judgeRankings, 
    judgeScores, 
    totalScores, 
    avgScores, 
    avgCriteriaScores,
    isLoading: rankingsLoading,
    lastUpdated,
    error: rankingsError,
    refreshRankings
  } = useDatabaseRankings(
    segmentId,
    contestantsGroup,
    judges,
    competitionSettings,
    false // Don't force refresh by default
  )

  const sortedContestants = useMemo(() => {
    return [...contestantsGroup].sort((a, b) => {
      const rankA = rankings[a.id]?.rank ?? 999
      const rankB = rankings[b.id]?.rank ?? 999
      return rankA - rankB
    })
  }, [contestantsGroup, rankings])

  const rankingMethod = competitionSettings.ranking.method

  // Helper functions for calculating average and median scores
  const calculateAverageScore = (scores: number[]): number => {
    if (scores.length === 0) return 0
    const sum = scores.reduce((acc, score) => acc + score, 0)
    return roundToTwoDecimals(sum / scores.length)
  }

  const calculateMedianScore = (scores: number[]): number => {
    if (scores.length === 0) return 0
    const sortedScores = [...scores].sort((a, b) => a - b)
    const middle = Math.floor(sortedScores.length / 2)

    if (sortedScores.length % 2 === 0) {
      // Even number of scores, take the average of the two middle scores
      return roundToTwoDecimals((sortedScores[middle - 1] + sortedScores[middle]) / 2)
    } else {
      // Odd number of scores, take the middle score
      return roundToTwoDecimals(sortedScores[middle])
    }
  }

  // Add this function in the RankingsTable component before the return statement
  // (after the existing functions but before the if(!contestantsGroup) check):

  const SimulationPanel = ({
    contestant,
    judges,
    scores,
    segmentId,
    updateFormula,
  }: {
    contestant: Contestant
    judges: Judge[]
    scores: Scores
    segmentId: string
    updateFormula: (newFormula: string) => void
  }) => {
    const allScores = getAllJudgeScores(contestant.id)
    const avg_score = calculateAverageScore(allScores)
    const median_score = calculateMedianScore(allScores)
    const min_score = allScores.length ? roundToTwoDecimals(Math.min(...allScores)) : 0
    const max_score = allScores.length ? roundToTwoDecimals(Math.max(...allScores)) : 0
    const judge_count = allScores.length

    const [simulationValues, setSimulationValues] = useState({
      avg_score,
      median_score,
      min_score,
      max_score,
      judge_count,
    })

    const handleSimulate = (variable: string, value: number[]) => {
      setSimulationValues({
        ...simulationValues,
        [variable]: roundToTwoDecimals(value[0]),
      })
    }

    // Define the sliders' min/max values
    const sliderRanges = {
      avg_score: [0, 10],
      median_score: [0, 10],
      min_score: [0, 10],
      max_score: [0, 10],
      judge_count: [1, 10],
    }

    // Custom formula update
    const [customFormula, setCustomFormula] = useState(competitionSettings.ranking.customFormula || "avg_score")

    const handleFormulaUpdate = () => {
      updateFormula(customFormula)
    }

    return (
      <Card className="mt-4">
        <CardHeader>
          <CardTitle className="text-sm font-medium">Formula Simulation</CardTitle>
          <CardDescription>Adjust values to see how they affect the formula result</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(simulationValues).map(([key, value]) => (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">
                    {key.replace(/_/g, " ")}:<span className="ml-2 text-sm">{value.toFixed(2)}</span>
                  </label>
                  <div className="text-sm text-muted-foreground">
                    Actual:{" "}
                    {key === "avg_score"
                      ? avg_score.toFixed(2)
                      : key === "median_score"
                        ? median_score.toFixed(2)
                        : key === "min_score"
                          ? min_score.toFixed(2)
                          : key === "max_score"
                            ? max_score.toFixed(2)
                            : judge_count.toString()}
                  </div>
                </div>
                <Slider
                  defaultValue={[value]}
                  max={sliderRanges[key as keyof typeof sliderRanges][1]}
                  min={sliderRanges[key as keyof typeof sliderRanges][0]}
                  step={key === "judge_count" ? 1 : 0.1}
                  onValueChange={(val) => handleSimulate(key, val)}
                />
              </div>
            ))}

            <div className="space-y-2 pt-4 border-t">
              <label className="text-sm font-medium">Custom Formula:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customFormula}
                  onChange={(e) => setCustomFormula(e.target.value)}
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                />
                <button
                  onClick={handleFormulaUpdate}
                  className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
                >
                  Apply
                </button>
              </div>

              <div className="mt-4 bg-muted p-3 rounded-md">
                <p className="text-sm font-medium">Simulated Result:</p>
                <div className="mt-2">
                  {evaluateFormulaSteps(customFormula, simulationValues).steps.map((step, i) => (
                    <div key={i} className="text-sm py-1 border-b border-dashed border-gray-200 last:border-0">
                      <span>{step.description}</span>
                      {step.result !== undefined && (
                        <span className="ml-2 font-mono text-xs bg-muted-foreground/10 px-1 py-0.5 rounded">
                          = {typeof step.result === "number" ? step.result.toFixed(2) : step.result}
                        </span>
                      )}
                    </div>
                  ))}
                  <div className="mt-2 text-sm font-medium">
                    Final Result: {evaluateFormulaSteps(customFormula, simulationValues).finalResult.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!contestantsGroup || contestantsGroup.length === 0 || !judges || judges.length === 0) {
    return (
      <div className="mb-6">
        {groupTitle && (
          <div className="bg-primary/10 px-4 py-2 rounded-t-md">
            <h3 className="text-lg font-semibold">{groupTitle}</h3>
          </div>
        )}
        <div className="p-4 text-center text-muted-foreground">
          {!contestantsGroup || contestantsGroup.length === 0
            ? "No contestants in this category"
            : "No judges available to calculate rankings"}
        </div>
      </div>
    )
  }

  // Show loading state
  if (rankingsLoading) {
    return (
      <div className="mb-6">
        {groupTitle && (
          <div className="bg-primary/10 px-4 py-2 rounded-t-md">
            <h3 className="text-lg font-semibold">{groupTitle}</h3>
          </div>
        )}
        <div className="p-4 text-center text-muted-foreground">
          <div className="flex items-center justify-center gap-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Loading rankings...
          </div>
        </div>
      </div>
    )
  }

  // Show error state
  if (rankingsError) {
    return (
      <div className="mb-6">
        {groupTitle && (
          <div className="bg-primary/10 px-4 py-2 rounded-t-md">
            <h3 className="text-lg font-semibold">{groupTitle}</h3>
          </div>
        )}
        <div className="p-4 text-center text-destructive">
          <div className="flex flex-col items-center gap-2">
            <p>Error loading rankings: {rankingsError}</p>
            <button 
              onClick={refreshRankings}
              className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Function to get all judge scores for a contestant
  const getAllJudgeScores = (contestantId: string): number[] => {
    const result: number[] = []
    judges.forEach((judge) => {
      const score = judgeScores[judge.id]?.[contestantId] || 0
      if (score > 0) result.push(score)
    })
    return result
  }

  return (
    <div className="mb-6">
      {groupTitle && (
        <div className="bg-primary/10 px-4 py-2 rounded-t-md">
          <h3 className="text-lg font-semibold">{groupTitle}</h3>
        </div>
      )}
      <div className="overflow-x-auto">
        <Table className="border-collapse">
          <TableHeader>
            <TableRow className="divide-x divide-border">
              <TableHead className="w-8 text-center bg-muted"></TableHead>
              <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                Contestant
              </TableHead>

              {rankingMethod === "weighted" ? (
                // Custom header for weighted method
                <>
                  <TableHead colSpan={criteria.length} className="text-center bg-muted">
                    Criteria Scores (with weights)
                  </TableHead>
                  <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                    Weighted Score
                  </TableHead>
                </>
              ) : rankingMethod === "avg-rank" ? (
                <>
                  {criteria.map((criterion) => (
                    <TableHead key={criterion.id} className="text-center bg-muted">
                      {criterion.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-center bg-muted">Total Score</TableHead>
                  <TableHead className="text-center bg-muted">Rank</TableHead>
                </>
              ) : rankingMethod === "median" ? (
                <>
                  <TableHead colSpan={judges.length} className="text-center bg-muted">
                    Judge Scores
                  </TableHead>
                  <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                    Median Score
                  </TableHead>
                </>
              ) : rankingMethod === "trimmed" ? (
                <>
                  <TableHead colSpan={judges.length} className="text-center bg-muted">
                    Judge Scores
                  </TableHead>
                  <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                    Trimmed Mean ({competitionSettings.ranking.trimPercentage}%)
                  </TableHead>
                </>
              ) : rankingMethod === "borda" ? (
                <>
                  <TableHead colSpan={judges.length} className="text-center bg-muted">
                    Judge Ranks
                  </TableHead>
                  <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                    Borda Points
                  </TableHead>
                </>
              ) : rankingMethod === "avg" ? (
                <>
                  <TableHead colSpan={judges.length} className="text-center bg-muted">
                    Judge Scores
                  </TableHead>
                  <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                    Average Score
                  </TableHead>
                </>
              ) : (
                <>
                  <TableHead colSpan={judges.length} className="text-center bg-muted">
                    Raw Scores
                  </TableHead>
                  <TableHead colSpan={judges.length} className="text-center bg-muted">
                    Ranks
                  </TableHead>
                </>
              )}

              {/* Only show Average Rank column for rank-avg-rank method */}
              {rankingMethod === "rank-avg-rank" && (
                <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                  Average Rank
                </TableHead>
              )}

              <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                Final Rank
              </TableHead>
              <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                Status
              </TableHead>
            </TableRow>
            <TableRow className="divide-x divide-border">
              <TableHead className="bg-muted"></TableHead>

              {rankingMethod === "weighted" ? (
                // Criteria with weights for weighted method
                <>
                  {criteria.map((criterion) => (
                    <TableHead key={`sub-${criterion.id}`} className="text-center px-2 py-1 text-xs bg-muted">
                      {criterion.name} (×{typeof criterion.weight === "number" ? criterion.weight : 1})
                    </TableHead>
                  ))}
                </>
              ) : rankingMethod === "avg-rank" ? (
                <>
                  {criteria.map((criterion) => (
                    <TableHead key={`sub-${criterion.id}`} className="text-center px-2 py-1 text-xs bg-muted">
                      (max: {criterion.maxScore})
                    </TableHead>
                  ))}
                  <TableHead className="text-center px-2 py-1 text-xs bg-muted">Sum</TableHead>
                  <TableHead className="text-center px-2 py-1 text-xs bg-muted">Position</TableHead>
                </>
              ) : rankingMethod === "median" || rankingMethod === "trimmed" || rankingMethod === "avg" ? (
                // Judge names for median, trimmed, and avg methods
                <>
                  {judges.map((judge) => (
                    <TableHead key={`score-${judge.id}`} className="text-center px-2 py-1 text-xs bg-muted">
                      {judge.name}
                    </TableHead>
                  ))}
                </>
              ) : rankingMethod === "borda" ? (
                // Judge names for borda method
                <>
                  {judges.map((judge) => (
                    <TableHead key={`rank-${judge.id}`} className="text-center px-2 py-1 text-xs bg-muted">
                      {judge.name}
                    </TableHead>
                  ))}
                </>
              ) : (
                <>
                  {judges.map((judge) => (
                    <TableHead key={`score-${judge.id}`} className="text-center px-2 py-1 text-xs bg-muted">
                      {judge.name}
                    </TableHead>
                  ))}
                  {judges.map((judge) => (
                    <TableHead key={`rank-${judge.id}`} className="text-center px-2 py-1 text-xs bg-muted">
                      {judge.name}
                    </TableHead>
                  ))}
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {sortedContestants.length > 0 ? (
              sortedContestants.map((contestant, index) => {
                const avgRank = calculateAvgRank(judgeRankings, contestant.id)
                const isAdvancing =
                  segmentId &&
                  index < (competitionSettings.segments.find((s) => s.id === segmentId)?.advancingCandidates || 0)
                const isEven = index % 2 === 0
                const rowClass = isAdvancing ? "bg-green-50" : isEven ? "bg-muted/20" : ""
                const isExpanded = expandedRows[contestant.id] || false

                return (
                  <React.Fragment key={contestant.id}>
                    <TableRow
                      className={`divide-x divide-border ${rowClass} cursor-pointer hover:bg-muted/30`}
                      onClick={() => toggleRowExpansion(contestant.id)}
                    >
                      <TableCell className="text-center align-middle p-2">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 inline-block" />
                        ) : (
                          <ChevronRight className="h-4 w-4 inline-block" />
                        )}
                      </TableCell>
                      <TableCell className="text-center align-middle">{contestant.name}</TableCell>

                      {rankingMethod === "weighted" ? (
                        // Custom cells for weighted method
                        <>
                          {criteria.map((criterion) => {
                            const avgCriterionScore = avgCriteriaScores[contestant.id]?.[criterion.id] || 0
                            const weight = typeof criterion.weight === "number" ? criterion.weight : 1
                            const weightedScore = roundToTwoDecimals(avgCriterionScore * weight)
                            const percentage = calculatePercentage(avgCriterionScore, criterion.maxScore)

                            return (
                              <TableCell key={criterion.id} className="text-center align-middle">
                                <div className="font-medium">
                                  {avgCriterionScore > 0 ? avgCriterionScore.toFixed(2) : "-"}
                                </div>
                                <div className="text-xs text-muted-foreground">
                                  {weightedScore.toFixed(2)} ({percentage.toFixed(0)}%)
                                </div>
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center align-middle font-medium">
                            {rankings[contestant.id]?.score ? rankings[contestant.id].score.toFixed(2) : "-"}
                          </TableCell>
                        </>
                      ) : rankingMethod === "avg-rank" ? (
                        <>
                          {criteria.map((criterion) => {
                            const avgCriterionScore = avgCriteriaScores[contestant.id]?.[criterion.id] || 0
                            const percentage = calculatePercentage(avgCriterionScore, criterion.maxScore)

                            return (
                              <TableCell key={criterion.id} className="text-center align-middle">
                                {avgCriterionScore > 0 ? avgCriterionScore.toFixed(2) : "-"}
                                <div className="text-xs text-muted-foreground">({percentage.toFixed(0)}%)</div>
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center align-middle font-medium">
                            {totalScores[contestant.id] > 0 ? totalScores[contestant.id].toFixed(2) : "-"}
                          </TableCell>
                          <TableCell className="text-center align-middle">
                            {rankings[contestant.id]?.score ? rankings[contestant.id].score.toFixed(2) : "-"}
                          </TableCell>
                        </>
                      ) : rankingMethod === "median" ? (
                        // Median method cells
                        <>
                          {judges.map((judge) => {
                            const score = judgeScores[judge.id]?.[contestant.id] || 0
                            return (
                              <TableCell key={`score-${judge.id}`} className="text-center align-middle">
                                {score > 0 ? score.toFixed(2) : "-"}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center align-middle font-medium">
                            {rankings[contestant.id]?.score ? rankings[contestant.id].score.toFixed(2) : "-"}
                          </TableCell>
                        </>
                      ) : rankingMethod === "trimmed" ? (
                        // Trimmed mean method cells
                        <>
                          {judges.map((judge) => {
                            const score = judgeScores[judge.id]?.[contestant.id] || 0
                            const allScores = getAllJudgeScores(contestant.id).sort((a, b) => a - b)
                            const trimCount = Math.floor(
                              (((competitionSettings.ranking.trimPercentage || 20) / 100) * allScores.length) / 2,
                            )

                            // Determine if this score is trimmed (either too high or too low)
                            const isTrimmed =
                              score > 0 &&
                              (allScores.indexOf(score) < trimCount ||
                                allScores.indexOf(score) >= allScores.length - trimCount)

                            return (
                              <TableCell
                                key={`score-${judge.id}`}
                                className={`text-center align-middle ${isTrimmed ? "text-muted-foreground line-through" : ""}`}
                              >
                                {score > 0 ? score.toFixed(2) : "-"}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center align-middle font-medium">
                            {rankings[contestant.id]?.score ? rankings[contestant.id].score.toFixed(2) : "-"}
                          </TableCell>
                        </>
                      ) : rankingMethod === "borda" ? (
                        // Borda count method cells
                        <>
                          {judges.map((judge) => {
                            const rank = judgeRankings[judge.id]?.[contestant.id] || "-"
                            // Calculate Borda points (contestantCount - rank + 1)
                            const bordaPoints = typeof rank === "number" ? contestantsGroup.length - rank + 1 : "-"

                            return (
                              <TableCell key={`rank-${judge.id}`} className="text-center align-middle">
                                {typeof rank === "number" ? (
                                  <>
                                    {rank.toFixed(2)}
                                    <div className="text-xs text-muted-foreground">
                                      ({typeof bordaPoints === "number" ? bordaPoints.toFixed(0) : "-"} pts)
                                    </div>
                                  </>
                                ) : (
                                  rank
                                )}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center align-middle font-medium">
                            {rankings[contestant.id]?.score ? rankings[contestant.id].score.toFixed(2) : "-"}
                          </TableCell>
                        </>
                      ) : rankingMethod === "avg" ? (
                        // Average method cells
                        <>
                          {judges.map((judge) => {
                            const score = judgeScores[judge.id]?.[contestant.id] || 0
                            return (
                              <TableCell key={`score-${judge.id}`} className="text-center align-middle">
                                {score > 0 ? score.toFixed(2) : "-"}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center align-middle font-medium">
                            {rankings[contestant.id]?.score ? rankings[contestant.id].score.toFixed(2) : "-"}
                          </TableCell>
                        </>
                      ) : (
                        // Default (rank-avg-rank) method cells
                        <>
                          {judges.map((judge) => {
                            const score = judgeScores[judge.id]?.[contestant.id] || 0

                            return (
                              <TableCell key={`score-${judge.id}`} className="text-center align-middle">
                                {score > 0 ? score.toFixed(2) : "-"}
                              </TableCell>
                            )
                          })}

                          {judges.map((judge) => {
                            const rank = judgeRankings[judge.id]?.[contestant.id] || "-"

                            return (
                              <TableCell key={`rank-${judge.id}`} className="text-center align-middle">
                                {typeof rank === "number" ? rank.toFixed(2) : rank}
                              </TableCell>
                            )
                          })}
                        </>
                      )}

                      {/* Only show Average Rank for rank-avg-rank method */}
                      {rankingMethod === "rank-avg-rank" && (
                        <TableCell className="text-center align-middle">
                          {avgRank > 0 ? avgRank.toFixed(2) : "-"}
                        </TableCell>
                      )}

                      <TableCell className="text-center font-bold align-middle bg-primary/5">
                        {rankings[contestant.id]?.rank ? rankings[contestant.id].rank.toFixed(2) : "-"}
                      </TableCell>

                      <TableCell className="text-center align-middle">
                        {isAdvancing &&
                        segmentId &&
                        (competitionSettings.segments.find((s) => s.id === segmentId)?.advancingCandidates ?? 0) > 0 ? (
                          <Badge className="bg-green-500">Advancing</Badge>
                        ) : (
                          <Badge variant="outline">Not Advancing</Badge>
                        )}
                      </TableCell>
                    </TableRow>

                    {isExpanded && (
                      <TableRow className={`${rowClass} border-t-0`}>
                        <TableCell
                          colSpan={
                            rankingMethod === "avg-rank"
                              ? criteria.length + 6
                              : rankingMethod === "weighted"
                                ? criteria.length + 5
                                : rankingMethod === "rank-avg-rank"
                                  ? 5 + judges.length * 2
                                  : 4 + judges.length
                          }
                          className="p-0"
                        >
                          <div className="p-4 bg-muted/5 border-t border-dashed">
                            <h4 className="font-medium mb-2">Detailed Criteria Scores</h4>
                            <Table className="border-collapse">
                              <TableHeader>
                                <TableRow className="divide-x divide-border">
                                  <TableHead className="text-center bg-muted/50">Criteria</TableHead>
                                  {judges.map((judge) => (
                                    <TableHead key={judge.id} className="text-center bg-muted/50">
                                      {judge.name}
                                    </TableHead>
                                  ))}
                                  <TableHead className="text-center bg-muted/50">Sum</TableHead>
                                  <TableHead className="text-center bg-muted/50">Average</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody className="divide-y divide-border">
                                {criteria.map((criterion) => {
                                  const criterionScores = judges.map((judge) =>
                                    getCriterionScore(scores, segmentId, contestant.id, judge.id, criterion.id),
                                  )

                                  const totalCriterionScore = roundToTwoDecimals(
                                    criterionScores.reduce((sum, score) => sum + score, 0),
                                  )

                                  const validScores = criterionScores.filter((score) => score > 0)
                                  const avgCriterionScore =
                                    validScores.length > 0
                                      ? roundToTwoDecimals(totalCriterionScore / validScores.length)
                                      : 0

                                  return (
                                    <TableRow key={criterion.id} className="divide-x divide-border">
                                      <TableCell className="text-left">
                                        {criterion.name}
                                        <span className="text-xs text-muted-foreground ml-1">
                                          (max: {criterion.maxScore})
                                        </span>
                                      </TableCell>
                                      {judges.map((judge) => {
                                        const criterionScore = getCriterionScore(
                                          scores,
                                          segmentId,
                                          contestant.id,
                                          judge.id,
                                          criterion.id,
                                        )
                                        const percentage = calculatePercentage(criterionScore, criterion.maxScore)

                                        return (
                                          <TableCell key={judge.id} className="text-center">
                                            {criterionScore > 0
                                              ? roundToTwoDecimals(criterionScore).toFixed(2)
                                              : "-"}
                                            <span className="text-xs text-muted-foreground ml-1">
                                              ({percentage.toFixed(0)}%)
                                            </span>
                                          </TableCell>
                                        )
                                      })}
                                      <TableCell className="text-center font-medium">
                                        {totalCriterionScore.toFixed(2)}
                                      </TableCell>
                                      <TableCell className="text-center font-medium">
                                        {avgCriterionScore.toFixed(2)}
                                      </TableCell>
                                    </TableRow>
                                  )
                                })}

                                <TableRow className="divide-x divide-border bg-muted/20">
                                  <TableCell className="font-medium">Total</TableCell>
                                  {judges.map((judge) => {
                                    const total = getJudgeTotalScore(scores, segmentId, contestant.id, judge.id)
                                    return (
                                      <TableCell key={judge.id} className="text-center font-medium">
                                        {total > 0 ? total.toFixed(2) : "-"}
                                      </TableCell>
                                    )
                                  })}

                                  <TableCell className="text-center font-medium">
                                    {totalScores[contestant.id] ? totalScores[contestant.id].toFixed(2) : "-"}
                                  </TableCell>

                                  <TableCell className="text-center font-medium">
                                    {avgScores[contestant.id] > 0 ? avgScores[contestant.id].toFixed(2) : "-"}
                                  </TableCell>
                                </TableRow>
                              </TableBody>
                            </Table>

                            <div className="mt-4 p-3 bg-muted/20 rounded-md">
                              <h5 className="font-medium mb-1">
                                Ranking Calculation ({competitionSettings.ranking.method})
                              </h5>
                              {competitionSettings.ranking.method === "avg" && (
                                <div className="text-sm space-y-3">
                                  <p>The average method calculates the simple arithmetic mean of all judges' scores:</p>

                                  <div className="p-3 bg-muted/30 rounded-md">
                                    <p className="font-medium">
                                      Formula: Average = (Sum of Scores) / (Number of Judges)
                                    </p>
                                    <div className="mt-2">
                                      <p>
                                        Scores from judges:{" "}
                                        {judges
                                          .map((judge) => {
                                            const score = judgeScores[judge.id]?.[contestant.id] || 0
                                            return score > 0 ? score.toFixed(2) : "-"
                                          })
                                          .join(", ")}
                                      </p>
                                      <p>Sum of scores: {totalScores[contestant.id] ? totalScores[contestant.id].toFixed(2) : "-"}</p>
                                      <p>
                                        Number of judges with scores:{" "}
                                        {
                                          judges.filter((judge) => (judgeScores[judge.id]?.[contestant.id] || 0) > 0)
                                            .length
                                        }
                                      </p>
                                      <p className="font-medium mt-1">
                                        Average score:{" "}
                                        {avgScores[contestant.id] > 0 ? avgScores[contestant.id].toFixed(2) : "-"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-xs text-muted-foreground">
                                    <p>
                                      Note: The average method treats all scores equally and can be influenced by
                                      outliers.
                                    </p>
                                  </div>
                                </div>
                              )}
                              {competitionSettings.ranking.method === "avg-rank" && (
                                <p className="text-sm">
                                  Total scores ({totalScores[contestant.id] ? totalScores[contestant.id].toFixed(2) : "-"}) then ranked against
                                  other contestants.
                                </p>
                              )}
                              {competitionSettings.ranking.method === "rank-avg-rank" && (
                                <div className="text-sm">
                                  <p>
                                    1. Scores converted to ranks per judge:{" "}
                                    {judges
                                      .map((judge) => {
                                        const rank = judgeRankings[judge.id]?.[contestant.id]
                                        return typeof rank === "number" ? rank.toFixed(2) : "-"
                                      })
                                      .join(", ")}
                                  </p>
                                  <p>2. Average of ranks: {avgRank.toFixed(2)}</p>
                                  <p>
                                    3. Final rank based on average rank:{" "}
                                    {rankings[contestant.id]?.rank ? rankings[contestant.id].rank.toFixed(2) : "-"}
                                  </p>
                                </div>
                              )}
                              {competitionSettings.ranking.method === "weighted" && (
                                <div className="text-sm space-y-3">
                                  <p>The weighted method applies different weights to each criterion:</p>

                                  <div className="overflow-x-auto">
                                    <table className="min-w-full border-collapse">
                                      <thead>
                                        <tr className="bg-muted/30">
                                          <th className="px-3 py-2 text-left">Criterion</th>
                                          <th className="px-3 py-2 text-center">Weight</th>
                                          <th className="px-3 py-2 text-center">Avg Score</th>
                                          <th className="px-3 py-2 text-center">Weighted Score</th>
                                          <th className="px-3 py-2 text-center">Contribution %</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {criteria.map((criterion) => {
                                          const avgScore = calculateAvgCriterionScore(
                                            scores,
                                            segmentId,
                                            contestant.id,
                                            judges,
                                            criterion.id,
                                          )
                                          const weight = typeof criterion.weight === "number" ? criterion.weight : 1
                                          const weightedScore = roundToTwoDecimals(avgScore * weight)

                                          // Calculate total weight for percentage calculation
                                          const totalWeight = criteria.reduce(
                                            (sum, c) => sum + (typeof c.weight === "number" ? c.weight : 1),
                                            0,
                                          )

                                          // Calculate contribution percentage
                                          const contributionPct = roundToTwoDecimals((weight / totalWeight) * 100)

                                          return (
                                            <tr key={criterion.id} className="border-t border-gray-200">
                                              <td className="px-3 py-2">{criterion.name}</td>
                                              <td className="px-3 py-2 text-center">{weight}</td>
                                              <td className="px-3 py-2 text-center">{avgScore.toFixed(2)}</td>
                                              <td className="px-3 py-2 text-center">{weightedScore.toFixed(2)}</td>
                                              <td className="px-3 py-2 text-center">{contributionPct}%</td>
                                            </tr>
                                          )
                                        })}
                                        <tr className="border-t border-gray-200 font-medium bg-muted/20">
                                          <td className="px-3 py-2">Total</td>
                                          <td className="px-3 py-2 text-center">
                                            {criteria.length > 0 ? criteria.reduce(
                                              (sum, c) => sum + (typeof c.weight === "number" ? c.weight : 1),
                                              0,
                                            ) : "-"}
                                          </td>
                                          <td className="px-3 py-2 text-center">-</td>
                                          <td className="px-3 py-2 text-center">
                                            {roundToTwoDecimals(
                                              criteria.reduce((sum, criterion) => {
                                                const avgScore = calculateAvgCriterionScore(
                                                  scores,
                                                  segmentId,
                                                  contestant.id,
                                                  judges,
                                                  criterion.id,
                                                )
                                                const weight =
                                                  typeof criterion.weight === "number" ? criterion.weight : 1
                                                return sum + avgScore * weight
                                              }, 0),
                                            ).toFixed(2)}
                                          </td>
                                          <td className="px-3 py-2 text-center">100%</td>
                                        </tr>
                                      </tbody>
                                    </table>
                                  </div>

                                  <div className="mt-3">
                                    <p className="font-medium mb-2">Visualization of Weighted Contributions:</p>
                                    <div className="flex items-end h-24 gap-1">
                                      {criteria.map((criterion) => {
                                        const avgScore = calculateAvgCriterionScore(
                                          scores,
                                          segmentId,
                                          contestant.id,
                                          judges,
                                          criterion.id,
                                        )
                                        const weight = typeof criterion.weight === "number" ? criterion.weight : 1
                                        const weightedScore = roundToTwoDecimals(avgScore * weight)

                                        // Calculate total weighted score for percentage calculation
                                        const totalWeightedScore = criteria.reduce((sum, c) => {
                                          const cAvgScore = calculateAvgCriterionScore(
                                            scores,
                                            segmentId,
                                            contestant.id,
                                            judges,
                                            c.id,
                                          )
                                          const cWeight = typeof c.weight === "number" ? c.weight : 1
                                          return sum + cAvgScore * cWeight
                                        }, 0)

                                        // Calculate height percentage (max 100%)
                                        const heightPct = Math.min(
                                          100,
                                          Math.max(5, (weightedScore / totalWeightedScore) * 100 * 2),
                                        )

                                        // Generate a consistent color based on criterion name
                                        const colorIndex = criteria.findIndex((c) => c.id === criterion.id) % 5
                                        const colors = [
                                          "bg-blue-500",
                                          "bg-green-500",
                                          "bg-yellow-500",
                                          "bg-purple-500",
                                          "bg-pink-500",
                                        ]

                                        return (
                                          <div key={criterion.id} className="flex flex-col items-center">
                                            <div
                                              className={`${colors[colorIndex]} rounded-t w-12 flex items-end justify-center text-white text-xs font-medium`}
                                              style={{ height: `${heightPct}%` }}
                                            >
                                              {Math.round((weightedScore / totalWeightedScore) * 100)}%
                                            </div>
                                            <div
                                              className="text-xs mt-1 w-12 text-center truncate"
                                              title={criterion.name}
                                            >
                                              {criterion.name.length > 8
                                                ? criterion.name.substring(0, 8) + "..."
                                                : criterion.name}
                                            </div>
                                          </div>
                                        )
                                      })}
                                    </div>
                                  </div>

                                  <div className="mt-3 p-3 bg-muted/20 rounded-md">
                                    <p className="font-medium">Final Calculation:</p>
                                    <p>
                                      Weighted Average = (Sum of Weighted Scores) / (Sum of Weights) ={" "}
                                      {rankings[contestant.id]?.score.toFixed(2)}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">
                                      Note: The final rank is determined by comparing this weighted average with other
                                      contestants.
                                    </p>
                                  </div>
                                </div>
                              )}
                              {competitionSettings.ranking.method === "median" && (
                                <div className="text-sm space-y-3">
                                  <p>The median method uses the middle value of all judges' scores:</p>

                                  <div className="p-3 bg-muted/30 rounded-md">
                                    <p className="font-medium">How the median is calculated:</p>
                                    <div className="mt-2">
                                      <p>
                                        Original scores:{" "}
                                        {getAllJudgeScores(contestant.id)
                                          .map((score) => score.toFixed(2))
                                          .join(", ")}
                                      </p>

                                      <p>
                                        Sorted scores:{" "}
                                        {[...getAllJudgeScores(contestant.id)]
                                          .sort((a, b) => a - b)
                                          .map((score) => score.toFixed(2))
                                          .join(", ")}
                                      </p>

                                      <div className="flex items-center gap-1 mt-2 overflow-x-auto">
                                        {[...getAllJudgeScores(contestant.id)]
                                          .sort((a, b) => a - b)
                                          .map((score, index, array) => {
                                            const isMiddle =
                                              array.length % 2 === 1
                                                ? index === Math.floor(array.length / 2)
                                                : index === array.length / 2 - 1 || index === array.length / 2

                                            return (
                                              <div
                                                key={index}
                                                className={`px-3 py-2 border ${isMiddle ? "bg-green-100 border-green-500 font-medium" : "bg-muted/10"} rounded-md text-center min-w-[60px]`}
                                              >
                                                {score.toFixed(2)}
                                                {isMiddle && <div className="text-xs text-green-700">median</div>}
                                              </div>
                                            )
                                          })}
                                      </div>

                                      <p className="font-medium mt-3">
                                        Median score: {rankings[contestant.id]?.score?.toFixed(2) || "-"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-xs text-muted-foreground">
                                    <p>
                                      Note: The median is less affected by outliers than the average. If there are an
                                      even number of scores, the median is the average of the two middle scores.
                                    </p>
                                  </div>
                                </div>
                              )}
                              {competitionSettings.ranking.method === "trimmed" && (
                                <div className="text-sm space-y-3">
                                  <p>The trimmed mean removes extreme scores before calculating the average:</p>

                                  <div className="p-3 bg-muted/30 rounded-md">
                                    <p className="font-medium">How the trimmed mean is calculated:</p>
                                    <div className="mt-2">
                                      <p>
                                        Original scores:{" "}
                                        {getAllJudgeScores(contestant.id)
                                          .map((score) => score.toFixed(2))
                                          .join(", ")}
                                      </p>

                                      <p>
                                        Sorted scores:{" "}
                                        {[...getAllJudgeScores(contestant.id)]
                                          .sort((a, b) => a - b)
                                          .map((score) => score.toFixed(2))
                                          .join(", ")}
                                      </p>

                                      {(() => {
                                        const allScores = [...getAllJudgeScores(contestant.id)].sort((a, b) => a - b)
                                        const trimPercentage = competitionSettings.ranking.trimPercentage || 20
                                        const trimCount = Math.floor(((trimPercentage / 100) * allScores.length) / 2)

                                        return (
                                          <div className="flex items-center gap-1 mt-2 overflow-x-auto">
                                            {allScores.map((score, index) => {
                                              const isTrimmed =
                                                index < trimCount || index >= allScores.length - trimCount

                                              return (
                                                <div
                                                  key={index}
                                                  className={`px-3 py-2 border ${isTrimmed ? "bg-red-50 border-red-200 text-red-500 line-through" : "bg-green-50 border-green-200"} rounded-md text-center min-w-[60px]`}
                                                >
                                                  {score.toFixed(2)}
                                                  <div className="text-xs no-underline">
                                                    {isTrimmed ? "trimmed" : "kept"}
                                                  </div>
                                                </div>
                                              )
                                            })}
                                          </div>
                                        )
                                      })()}

                                      <p className="font-medium mt-3">
                                        Trimmed mean ({competitionSettings.ranking.trimPercentage}%):{" "}
                                        {rankings[contestant.id]?.score?.toFixed(2) || "-"}
                                      </p>
                                    </div>
                                  </div>

                                  <div className="text-xs text-muted-foreground">
                                    <p>
                                      Note: The trimmed mean removes the highest and lowest{" "}
                                      {competitionSettings.ranking.trimPercentage}% of scores, reducing the impact of
                                      outliers while still using most of the data.
                                    </p>
                                  </div>
                                </div>
                              )}
                              {competitionSettings.ranking.method === "borda" && (
                                <div className="text-sm space-y-3">
                                  <p>The Borda count method assigns points based on ranks:</p>

                                  <div className="p-3 bg-muted/30 rounded-md">
                                    <p className="font-medium">How Borda count works:</p>
                                    <p className="text-xs mt-1">
                                      Formula: Points = (Number of contestants) - (Rank) + 1
                                    </p>

                                    <div className="mt-3 overflow-x-auto">
                                      <table className="min-w-full border-collapse">
                                        <thead>
                                          <tr className="bg-muted/30">
                                            <th className="px-3 py-2 text-left">Judge</th>
                                            <th className="px-3 py-2 text-center">Rank Given</th>
                                            <th className="px-3 py-2 text-center">Borda Points</th>
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {judges.map((judge) => {
                                            const rank = judgeRankings[judge.id]?.[contestant.id] || "-"
                                            const bordaPoints =
                                              typeof rank === "number" ? contestantsGroup.length - rank + 1 : "-"

                                            return (
                                              <tr key={judge.id} className="border-t border-gray-200">
                                                <td className="px-3 py-2">{judge.name}</td>
                                                <td className="px-3 py-2 text-center">
                                                  {typeof rank === "number" ? rank.toFixed(2) : rank}
                                                </td>
                                                <td className="px-3 py-2 text-center">
                                                  {typeof bordaPoints === "number"
                                                    ? bordaPoints.toFixed(2)
                                                    : bordaPoints}
                                                </td>
                                              </tr>
                                            )
                                          })}
                                          <tr className="border-t border-gray-200 font-medium bg-muted/20">
                                            <td className="px-3 py-2">Total Borda Points</td>
                                            <td className="px-3 py-2 text-center">-</td>
                                            <td className="px-3 py-2 text-center">
                                              {rankings[contestant.id]?.score?.toFixed(2) || "-"}
                                            </td>
                                          </tr>
                                        </tbody>
                                      </table>
                                    </div>
                                  </div>

                                  <div className="text-xs text-muted-foreground">
                                    <p>
                                      Note: The Borda count method rewards contestants who consistently rank well across
                                      all judges, even if they don't get first place from any judge.
                                    </p>
                                  </div>
                                </div>
                              )}
                              {competitionSettings.ranking.method === "custom" && (
                                <div className="text-sm space-y-3">
                                  <p>The custom formula calculates scores based on a user-defined formula:</p>
                                  <span className="flex items-center gap-1">
                                    <Info className="h-4 w-4" />
                                    Formula Breakdown
                                  </span>
                                  <div className="p-3 bg-muted/30 rounded-md">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium">Custom Formula:</p>
                                      <div className="py-1 px-2 bg-primary/10 rounded font-mono text-sm">
                                        {formatFormula(competitionSettings.ranking.customFormula || "avg_score")}
                                      </div>
                                    </div>

                                    <div className="mt-3">
                                      <p className="text-sm font-medium mb-2">Variables used:</p>
                                      <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                                        {(() => {
                                          const allScores = getAllJudgeScores(contestant.id)
                                          const avg_score = calculateAverageScore(allScores)
                                          const median_score = calculateMedianScore(allScores)
                                          const min_score = allScores.length
                                            ? roundToTwoDecimals(Math.min(...allScores))
                                            : 0
                                          const max_score = allScores.length
                                            ? roundToTwoDecimals(Math.max(...allScores))
                                            : 0
                                          const judge_count = allScores.length

                                          const variables = [
                                            {
                                              name: "avg_score",
                                              value: avg_score,
                                              description: "Average of all scores",
                                            },
                                            {
                                              name: "median_score",
                                              value: median_score,
                                              description: "Middle value of all scores",
                                            },
                                            {
                                              name: "min_score",
                                              value: min_score,
                                              description: "Lowest score received",
                                            },
                                            {
                                              name: "max_score",
                                              value: max_score,
                                              description: "Highest score received",
                                            },
                                            {
                                              name: "judge_count",
                                              value: judge_count,
                                              description: "Number of judges who scored",
                                            },
                                          ]

                                          return variables.map((variable) => (
                                            <div
                                              key={variable.name}
                                              className="flex items-center gap-1 bg-muted/20 p-2 rounded"
                                            >
                                              <TooltipProvider>
                                                <Tooltip>
                                                  <TooltipTrigger>
                                                    <div className="text-sm font-mono">
                                                      {variable.name} = {variable.value.toFixed(2)}
                                                    </div>
                                                  </TooltipTrigger>
                                                  <TooltipContent>{variable.description}</TooltipContent>
                                                </Tooltip>
                                              </TooltipProvider>
                                            </div>
                                          ))
                                        })()}
                                      </div>
                                    </div>

                                    <div className="mt-4">
                                      <p className="text-sm font-medium mb-2">Calculation steps:</p>
                                      {(() => {
                                        const allScores = getAllJudgeScores(contestant.id)
                                        const avg_score = calculateAverageScore(allScores)
                                        const median_score = calculateMedianScore(allScores)
                                        const min_score = allScores.length
                                          ? roundToTwoDecimals(Math.min(...allScores))
                                          : 0
                                        const max_score = allScores.length
                                          ? roundToTwoDecimals(Math.max(...allScores))
                                          : 0
                                        const judge_count = allScores.length

                                        const variables = {
                                          avg_score,
                                          median_score,
                                          min_score,
                                          max_score,
                                          judge_count,
                                        }

                                        const { steps, finalResult } = evaluateFormulaSteps(
                                          competitionSettings.ranking.customFormula || "avg_score",
                                          variables,
                                        )

                                        return (
                                          <div className="space-y-2">
                                            {steps.map((step, index) => (
                                              <div
                                                key={index}
                                                className="bg-muted/10 p-2 rounded text-sm border-l-2 border-primary/50"
                                              >
                                                {step.description}
                                                {step.result !== undefined && (
                                                  <span className="ml-2 font-mono text-xs bg-muted-foreground/10 px-1 py-0.5 rounded">
                                                    ={" "}
                                                    {typeof step.result === "number"
                                                      ? step.result.toFixed(2)
                                                      : step.result}
                                                  </span>
                                                )}
                                              </div>
                                            ))}

                                            <div className="bg-primary/10 p-2 rounded text-sm font-medium border-l-2 border-primary">
                                              Final result: {finalResult.toFixed(2)}
                                            </div>
                                          </div>
                                        )
                                      })()}
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </React.Fragment>
                )
              })
            ) : (
              <TableRow>
                <TableCell
                  colSpan={
                    rankingMethod === "avg-rank"
                      ? criteria.length + 6
                      : rankingMethod === "weighted"
                        ? criteria.length + 5
                        : rankingMethod === "rank-avg-rank"
                          ? 5 + judges.length * 2
                          : 4 + judges.length
                  }
                  className="text-center py-4 text-muted-foreground"
                >
                  No contestants in this category
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

export default FinalRankings
