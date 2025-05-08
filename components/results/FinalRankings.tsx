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

              {rankingMethod === "avg-rank" ? (
                <>
                  {criteria.map((criterion) => (
                    <TableHead key={criterion.id} className="text-center bg-muted">
                      {criterion.name}
                    </TableHead>
                  ))}
                  <TableHead className="text-center bg-muted">Total Score</TableHead>
                  <TableHead className="text-center bg-muted">Rank</TableHead>
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

              <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                {rankingMethod === "rank-avg-rank" ? "Final Rank" : "Avg Rank"}
              </TableHead>
              <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                Final Rank
              </TableHead>
              <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                Status
              </TableHead>
            </TableRow>
            <TableRow className="divide-x divide-border">
              <TableHead className="bg-muted"></TableHead>

              {rankingMethod === "avg-rank" ? (
                <>
                  {criteria.map((criterion) => (
                    <TableHead key={`sub-${criterion.id}`} className="text-center px-2 py-1 text-xs bg-muted">
                      (max: {criterion.maxScore})
                    </TableHead>
                  ))}
                  <TableHead className="text-center px-2 py-1 text-xs bg-muted">Sum</TableHead>
                  <TableHead className="text-center px-2 py-1 text-xs bg-muted">Position</TableHead>
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

                      {rankingMethod === "avg-rank" ? (
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
                      ) : (
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

                      <TableCell className="text-center align-middle">
                        {avgRank > 0 ? avgRank.toFixed(2) : "-"}
                      </TableCell>

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
                          colSpan={rankingMethod === "avg-rank" ? criteria.length + 6 : 4 + judges.length * 2}
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
                                <p className="text-sm">
                                  Simple average of all judges' scores:{" "}
                                  {avgScores[contestant.id] > 0 ? avgScores[contestant.id].toFixed(2) : "-"}
                                </p>
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
                                <div className="text-sm">
                                  <p>Criteria are weighted differently:</p>
                                  <ul className="list-disc list-inside">
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

                                      return (
                                        <li key={criterion.id}>
                                          {criterion.name}: {weight} × {avgScore.toFixed(2)} ={" "}
                                          {weightedScore.toFixed(2)}
                                        </li>
                                      )
                                    })}
                                  </ul>
                                </div>
                              )}
                              {competitionSettings.ranking.method === "trimmed" && (
                                <div className="text-sm">
                                  <p>
                                    Trimmed mean (removing {competitionSettings.ranking.trimPercentage}% of extreme
                                    scores):
                                  </p>
                                  <p>
                                    Original scores:{" "}
                                    {judges
                                      .map((judge) => {
                                        const total = getJudgeTotalScore(scores, segmentId, contestant.id, judge.id)
                                        return total > 0 ? total.toFixed(2) : null
                                      })
                                      .filter(Boolean)
                                      .join(", ")}
                                  </p>
                                  <p>After trimming: {rankings[contestant.id]?.score?.toFixed(2) || "-"}</p>
                                </div>
                              )}
                              {competitionSettings.ranking.method === "median" && (
                                <p className="text-sm">
                                  Median score: {rankings[contestant.id]?.score?.toFixed(2) || "-"}
                                </p>
                              )}
                              {competitionSettings.ranking.method === "borda" && (
                                <p className="text-sm">
                                  Borda count (points based on rank):{" "}
                                  {rankings[contestant.id]?.score?.toFixed(2) || "-"}
                                </p>
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
                  colSpan={rankingMethod === "avg-rank" ? criteria.length + 6 : 4 + judges.length * 2}
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
