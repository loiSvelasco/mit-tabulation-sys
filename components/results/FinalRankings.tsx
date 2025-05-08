"use client"

import React, { useState, useCallback, useMemo } from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { ChevronDown, ChevronRight } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateSegmentScores, convertScoresToRanks, roundToTwoDecimals } from "@/utils/rankingUtils"
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

// Custom hook for ranking calculations
function useRankingCalculations(
  segmentId: string | undefined,
  contestantsGroup: Contestant[] | undefined,
  judges: Judge[] | undefined,
  scores: Scores | undefined,
  competitionSettings: CompetitionSettings | undefined,
): RankingCalculations {
  return useMemo(() => {
    const emptyResult: RankingCalculations = {
      rankings: {},
      judgeRankings: {},
      judgeScores: {},
      totalScores: {},
      avgScores: {},
      avgCriteriaScores: {},
    }

    if (!segmentId || !contestantsGroup || !judges || !scores || !competitionSettings) {
      return emptyResult
    }

    // Get the selected segment and criteria
    const segment = competitionSettings.segments.find((s) => s.id === segmentId)
    const criteria = segment?.criteria || []

    // Calculate rankings using the ranking-utils
    const rankings = calculateSegmentScores(contestantsGroup, judges, scores, segmentId, competitionSettings.ranking)

    // For each judge, calculate their individual rankings
    const judgeRankings: AllJudgeRankings = {}
    const judgeScores: AllJudgeScores = {}

    judges.forEach((judge) => {
      const judgeScoreMap: JudgeScores = {}

      contestantsGroup.forEach((contestant) => {
        // Get total score from this judge for this contestant
        const totalScore = getJudgeTotalScore(scores, segmentId, contestant.id, judge.id)
        judgeScoreMap[contestant.id] = totalScore
      })

      judgeScores[judge.id] = judgeScoreMap
      judgeRankings[judge.id] = convertScoresToRanks(judgeScoreMap)
    })

    // Calculate total and average scores for each contestant
    const totalScores: TotalScores = {}
    const avgScores: TotalScores = {}

    contestantsGroup.forEach((contestant) => {
      let totalScore = 0
      let count = 0

      judges.forEach((judge) => {
        const judgeTotal = getJudgeTotalScore(scores, segmentId, contestant.id, judge.id)
        if (judgeTotal > 0) {
          totalScore += judgeTotal
          count++
        }
      })

      totalScores[contestant.id] = roundToTwoDecimals(totalScore)
      avgScores[contestant.id] = count > 0 ? roundToTwoDecimals(totalScore / count) : 0
    })

    // Calculate average scores per criteria for each contestant
    const avgCriteriaScores: AvgCriteriaScores = {}
    contestantsGroup.forEach((contestant) => {
      const criteriaScores: { [criterionId: string]: number } = {}

      criteria.forEach((criterion) => {
        let totalCriterionScore = 0
        let criterionCount = 0

        judges.forEach((judge) => {
          if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
            totalCriterionScore += scores[segmentId][contestant.id][judge.id][criterion.id]
            criterionCount++
          }
        })

        criteriaScores[criterion.id] = criterionCount > 0 ? roundToTwoDecimals(totalCriterionScore / criterionCount) : 0
      })

      avgCriteriaScores[contestant.id] = criteriaScores
    })

    return {
      rankings,
      judgeRankings,
      judgeScores,
      totalScores,
      avgScores,
      avgCriteriaScores,
    }
  }, [segmentId, contestantsGroup, judges, scores, competitionSettings])
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
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-2">Final Rankings</h2>
          <p className="text-sm text-muted-foreground mb-4">
            Using <span className="font-medium">{competitionSettings.ranking.method.toUpperCase()}</span> ranking method
            with <span className="font-medium">{competitionSettings.ranking.tiebreaker}</span> tiebreaker
          </p>
        </div>
        <div className="flex items-center gap-2">
          <PrintResults className="float-right" key={`${segment?.id}-${refreshKey}`} segmentId={segment?.id} />
        </div>
      </div>

      {separateByGender ? (
        <div className="space-y-6">
          {maleContestants.length > 0 && renderRankingsTable(maleContestants, "Male Division")}
          {femaleContestants.length > 0 && renderRankingsTable(femaleContestants, "Female Division")}
        </div>
      ) : (
        renderRankingsTable(segmentContestants)
      )}

      {segment && segment.advancingCandidates > 0 && (
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

  const { rankings, judgeRankings, judgeScores, totalScores, avgScores, avgCriteriaScores } = useRankingCalculations(
    segmentId,
    contestantsGroup,
    judges,
    scores,
    competitionSettings,
  )

  const sortedContestants = useMemo(() => {
    return [...contestantsGroup].sort((a, b) => {
      const rankA = rankings[a.id]?.rank ?? 999
      const rankB = rankings[b.id]?.rank ?? 999
      return rankA - rankB
    })
  }, [contestantsGroup, rankings])

  const rankingMethod = competitionSettings.ranking.method

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
                        competitionSettings.segments.find((s) => s.id === segmentId)?.advancingCandidates > 0 ? (
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
                                              : "0.00"}
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
                                        {total > 0 ? total.toFixed(2) : "0.00"}
                                      </TableCell>
                                    )
                                  })}

                                  <TableCell className="text-center font-medium">
                                    {totalScores[contestant.id]?.toFixed(2) || "0.00"}
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
                                      <p>Sum of scores: {totalScores[contestant.id]?.toFixed(2) || "0.00"}</p>
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
                                  Total scores ({totalScores[contestant.id]?.toFixed(2) || "0.00"}) then ranked against
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
                                            {criteria.reduce(
                                              (sum, c) => sum + (typeof c.weight === "number" ? c.weight : 1),
                                              0,
                                            )}
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
                                <p className="text-sm">
                                  Custom formula: {competitionSettings.ranking.customFormula || "Not specified"}
                                </p>
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
