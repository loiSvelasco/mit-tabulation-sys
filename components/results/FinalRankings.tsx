"use client"

import React, { useState, useCallback } from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { ChevronDown, ChevronRight, RefreshCw } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateSegmentScores, convertScoresToRanks, roundToTwoDecimals } from "@/utils/rankingUtils"
import { PrintResults } from "../print-results"

interface Props {
  segmentId: string
}

const FinalRankings: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()
  const separateByGender = competitionSettings.separateRankingByGender
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  const [refreshKey, setRefreshKey] = useState(0) // Used to force re-render

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender if needed - using case-insensitive comparison
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
  const criteria = segment?.criteria || []

  // Toggle row expansion
  const toggleRowExpansion = (contestantId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [contestantId]: !prev[contestantId],
    }))
  }

  // Reset function for debugging
  const handleReset = useCallback(() => {
    // Clear expanded rows
    setExpandedRows({})
    // Force re-render by updating the refresh key
    setRefreshKey((prev) => prev + 1)
    console.log("Rankings display reset for debugging")
  }, [])

  // Render the rankings table for a specific group of contestants
  const renderRankingsTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate rankings using the ranking-utils
    const rankings = calculateSegmentScores(contestantsGroup, judges, scores, segmentId, competitionSettings.ranking)

    // For each judge, calculate their individual rankings
    const judgeRankings: Record<string, Record<string, number>> = {}
    const judgeScores: Record<string, Record<string, number>> = {}

    judges.forEach((judge) => {
      const judgeScoreMap: Record<string, number> = {}

      contestantsGroup.forEach((contestant) => {
        // Get total score from this judge for this contestant
        let totalScore = 0
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          totalScore = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, score) => sum + score, 0)
          // Round the total score
          totalScore = roundToTwoDecimals(totalScore)
        }
        judgeScoreMap[contestant.id] = totalScore
      })

      judgeScores[judge.id] = judgeScoreMap
      judgeRankings[judge.id] = convertScoresToRanks(judgeScoreMap)
    })

    // Calculate total and average scores for each contestant
    const totalScores: Record<string, number> = {}
    contestantsGroup.forEach((contestant) => {
      let totalScore = 0

      judges.forEach((judge) => {
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          const judgeTotal = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
            (sum, score) => sum + score,
            0,
          )

          if (judgeTotal > 0) {
            totalScore += judgeTotal
          }
        }
      })

      totalScores[contestant.id] = roundToTwoDecimals(totalScore)
    })
    const avgScores: Record<string, number> = {}

    contestantsGroup.forEach((contestant) => {
      let totalScore = 0
      let count = 0

      judges.forEach((judge) => {
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          const judgeTotal = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
            (sum, score) => sum + score,
            0,
          )

          if (judgeTotal > 0) {
            totalScore += judgeTotal
            count++
          }
        }
      })

      totalScores[contestant.id] = roundToTwoDecimals(totalScore)
      avgScores[contestant.id] = count > 0 ? roundToTwoDecimals(totalScore / count) : 0
    })

    // Calculate average scores per criteria for each contestant
    const avgCriteriaScores: Record<string, Record<string, number>> = {}
    contestantsGroup.forEach((contestant) => {
      const criteriaScores: Record<string, number> = {}

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

    // Sort contestants by rank
    const sortedContestants = [...contestantsGroup].sort((a, b) => {
      const rankA = rankings[a.id]?.rank || 999
      const rankB = rankings[b.id]?.rank || 999
      return rankA - rankB
    })

    // Determine what columns to show based on ranking method
    const rankingMethod = competitionSettings.ranking.method

    // Helper function to calculate average rank for a contestant
    const calculateAvgRank = (contestantId: string) => {
      let totalRank = 0
      let rankCount = 0

      judges.forEach((judge) => {
        const rank = judgeRankings[judge.id]?.[contestantId]
        if (rank) {
          totalRank += rank
          rankCount++
        }
      })

      return rankCount > 0 ? roundToTwoDecimals(totalRank / rankCount) : 0
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

                {/* Dynamic header based on ranking method */}
                {rankingMethod === "avg-rank" ? (
                  <>
                    {/* Show criteria columns */}
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

                {/* Dynamic subheader based on ranking method */}
                {rankingMethod === "avg-rank" ? (
                  <>
                    {/* Subheaders for criteria columns */}
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
                    {/* Judge names for raw scores */}
                    {judges.map((judge) => (
                      <TableHead key={`score-${judge.id}`} className="text-center px-2 py-1 text-xs bg-muted">
                        {judge.name}
                      </TableHead>
                    ))}
                    {/* Judge names for ranks */}
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
                  // Calculate average rank
                  const avgRank = calculateAvgRank(contestant.id)
                  const isAdvancing = segment && index < (segment.advancingCandidates || 0)
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
                        <TableCell className="text-center align-middle">
                          {contestant.name}
                          {/* {contestant.gender && <span className="ml-2 text-xs">({contestant.gender})</span>} */}
                        </TableCell>

                        {/* Dynamic content based on ranking method */}
                        {rankingMethod === "avg-rank" ? (
                          <>
                            {/* Show criteria scores */}
                            {criteria.map((criterion) => {
                              const avgCriterionScore = avgCriteriaScores[contestant.id]?.[criterion.id] || 0
                              const percentage =
                                criterion.maxScore > 0 ? (avgCriterionScore / criterion.maxScore) * 100 : 0

                              return (
                                <TableCell key={criterion.id} className="text-center align-middle">
                                  {avgCriterionScore > 0 ? avgCriterionScore.toFixed(2) : "-"}
                                  <div className="text-xs text-muted-foreground">
                                    ({roundToTwoDecimals(percentage).toFixed(0)}%)
                                  </div>
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
                            {/* Raw scores for each judge */}
                            {judges.map((judge) => {
                              const score = judgeScores[judge.id]?.[contestant.id] || 0

                              return (
                                <TableCell key={`score-${judge.id}`} className="text-center align-middle">
                                  {score > 0 ? score.toFixed(2) : "-"}
                                </TableCell>
                              )
                            })}

                            {/* Ranks from each judge */}
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

                        {/* Average rank */}
                        <TableCell className="text-center align-middle">
                          {avgRank > 0 ? avgRank.toFixed(2) : "-"}
                        </TableCell>

                        {/* Final rank */}
                        <TableCell className="text-center font-bold align-middle bg-primary/5">
                          {rankings[contestant.id]?.rank ? rankings[contestant.id].rank.toFixed(2) : "-"}
                        </TableCell>

                        {/* Status */}
                        <TableCell className="text-center align-middle">
                          {isAdvancing && segment && segment.advancingCandidates > 0 ? (
                            <Badge className="bg-green-500">Advancing</Badge>
                          ) : (
                            <Badge variant="outline">Not Advancing</Badge>
                          )}
                        </TableCell>
                      </TableRow>

                      {/* Expanded row with detailed criteria scores */}
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
                                    // Calculate average for this criterion
                                    let totalCriterionScore = 0
                                    let criterionCount = 0

                                    judges.forEach((judge) => {
                                      if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
                                        totalCriterionScore += scores[segmentId][contestant.id][judge.id][criterion.id]
                                        criterionCount++
                                      }
                                    })

                                    // Round the total and average
                                    totalCriterionScore = roundToTwoDecimals(totalCriterionScore)
                                    const avgCriterionScore =
                                      criterionCount > 0 ? roundToTwoDecimals(totalCriterionScore / criterionCount) : 0

                                    return (
                                      <TableRow key={criterion.id} className="divide-x divide-border">
                                        <TableCell className="text-left">
                                          {criterion.name}
                                          <span className="text-xs text-muted-foreground ml-1">
                                            (max: {criterion.maxScore})
                                          </span>
                                        </TableCell>
                                        {judges.map((judge) => {
                                          const criterionScore =
                                            scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id] || 0
                                          const percentage =
                                            criterion.maxScore > 0 ? (criterionScore / criterion.maxScore) * 100 : 0

                                          return (
                                            <TableCell key={judge.id} className="text-center">
                                              {criterionScore > 0
                                                ? roundToTwoDecimals(criterionScore).toFixed(2)
                                                : "0.00"}
                                              <span className="text-xs text-muted-foreground ml-1">
                                                ({roundToTwoDecimals(percentage).toFixed(0)}%)
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

                                  {/* Total row */}
                                  <TableRow className="divide-x divide-border bg-muted/20">
                                    <TableCell className="font-medium">Total</TableCell>
                                    {judges.map((judge) => {
                                      let total = 0
                                      if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                                        total = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
                                          (sum, score) => sum + score,
                                          0,
                                        )
                                        // Round the total
                                        total = roundToTwoDecimals(total)
                                      }

                                      return (
                                        <TableCell key={judge.id} className="text-center font-medium">
                                          {total > 0 ? total.toFixed(2) : "0.00"}
                                        </TableCell>
                                      )
                                    })}

                                    {/* Sum of totals */}
                                    <TableCell className="text-center font-medium">
                                      {(() => {
                                        let totalScore = 0

                                        judges.forEach((judge) => {
                                          if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                                            const judgeTotal = Object.values(
                                              scores[segmentId][contestant.id][judge.id],
                                            ).reduce((sum, score) => sum + score, 0)

                                            totalScore += judgeTotal
                                          }
                                        })

                                        // Round the total score
                                        return roundToTwoDecimals(totalScore).toFixed(2)
                                      })()}
                                    </TableCell>

                                    {/* Average of totals */}
                                    <TableCell className="text-center font-medium">
                                      {(() => {
                                        let totalScore = 0
                                        let count = 0

                                        judges.forEach((judge) => {
                                          if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                                            const judgeTotal = Object.values(
                                              scores[segmentId][contestant.id][judge.id],
                                            ).reduce((sum, score) => sum + score, 0)

                                            if (judgeTotal > 0) {
                                              totalScore += judgeTotal
                                              count++
                                            }
                                          }
                                        })

                                        // Round the average
                                        return count > 0 ? roundToTwoDecimals(totalScore / count).toFixed(2) : "-"
                                      })()}
                                    </TableCell>
                                  </TableRow>
                                </TableBody>
                              </Table>

                              {/* Ranking method explanation */}
                              <div className="mt-4 p-3 bg-muted/20 rounded-md">
                                <h5 className="font-medium mb-1">
                                  Ranking Calculation ({competitionSettings.ranking.method})
                                </h5>
                                {competitionSettings.ranking.method === "avg" && (
                                  <p className="text-sm">
                                    Simple average of all judges' scores: {(() => {
                                      let totalScore = 0
                                      let count = 0

                                      judges.forEach((judge) => {
                                        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                                          const judgeTotal = Object.values(
                                            scores[segmentId][contestant.id][judge.id],
                                          ).reduce((sum, score) => sum + score, 0)

                                          if (judgeTotal > 0) {
                                            totalScore += judgeTotal
                                            count++
                                          }
                                        }
                                      })

                                      // Round the average
                                      return count > 0 ? roundToTwoDecimals(totalScore / count).toFixed(2) : "-"
                                    })()}
                                  </p>
                                )}
                                {competitionSettings.ranking.method === "avg-rank" && (
                                  <p className="text-sm">
                                    Total scores ({(() => {
                                      let totalScore = 0

                                      judges.forEach((judge) => {
                                        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                                          const judgeTotal = Object.values(
                                            scores[segmentId][contestant.id][judge.id],
                                          ).reduce((sum, score) => sum + score, 0)

                                          if (judgeTotal > 0) {
                                            totalScore += judgeTotal
                                          }
                                        }
                                      })

                                      // Round the total
                                      return roundToTwoDecimals(totalScore).toFixed(2)
                                    })()}) then ranked against other contestants.
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
                                      {criteria.map((criterion) => (
                                        <li key={criterion.id}>
                                          {criterion.name}: {criterion.weight || 1} × {(() => {
                                            let total = 0
                                            let count = 0

                                            judges.forEach((judge) => {
                                              if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
                                                total += scores[segmentId][contestant.id][judge.id][criterion.id]
                                                count++
                                              }
                                            })

                                            // Round the average
                                            return count > 0 ? roundToTwoDecimals(total / count).toFixed(2) : "0.00"
                                          })()} = {(() => {
                                            let total = 0
                                            let count = 0

                                            judges.forEach((judge) => {
                                              if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
                                                total += scores[segmentId][contestant.id][judge.id][criterion.id]
                                                count++
                                              }
                                            })

                                            const avg = count > 0 ? total / count : 0
                                            // Round the weighted score
                                            return roundToTwoDecimals(avg * (criterion.weight || 1)).toFixed(2)
                                          })()}
                                        </li>
                                      ))}
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
                                          if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                                            const total = Object.values(
                                              scores[segmentId][contestant.id][judge.id],
                                            ).reduce((sum, score) => sum + score, 0)
                                            return roundToTwoDecimals(total).toFixed(2)
                                          }
                                          return "0.00"
                                        })
                                        .filter((score) => score !== "0.00")
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
          {/* <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="flex items-center gap-1"
            title="Reset display for debugging"
          >
            <RefreshCw className="h-4 w-4" />
            <span>Reset</span>
          </Button> */}
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

export default FinalRankings
