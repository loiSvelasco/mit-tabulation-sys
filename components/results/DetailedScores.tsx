"use client"

import React from "react"
import { useState } from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { ChevronDown, ChevronRight } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { convertScoresToRanks } from "@/utils/rankingUtils"

interface Props {
  segmentId: string
}

const DetailedScores: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()
  const separateByGender = competitionSettings.separateRankingByGender
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender - using case-insensitive comparison
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
  const criteria = segment?.criteria || []

  // Calculate total maximum possible score
  const totalMaxScore = segment?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) || 0

  // Toggle row expansion
  const toggleRowExpansion = (contestantId: string) => {
    setExpandedRows((prev) => ({
      ...prev,
      [contestantId]: !prev[contestantId],
    }))
  }

  // Render detailed scores table for a specific group of contestants
  const renderDetailedScoresTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate ranks based on total scores
    const contestantTotals: Record<string, number> = {}

    contestantsGroup.forEach((contestant) => {
      let total = 0
      judges.forEach((judge) => {
        // Calculate total score from this judge for this contestant
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          total += Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, score) => sum + score, 0)
        }
      })
      contestantTotals[contestant.id] = total
    })

    const ranks = convertScoresToRanks(contestantTotals)

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
                <TableHead className="text-center align-middle bg-muted">Rank</TableHead>
                <TableHead className="text-center align-middle bg-muted">Contestant</TableHead>
                {judges.map((judge) => (
                  <TableHead key={judge.id} className="text-center align-middle bg-muted">
                    {judge.name}
                  </TableHead>
                ))}
                <TableHead className="text-center align-middle bg-muted">Total</TableHead>
                <TableHead className="text-center align-middle bg-muted">Average</TableHead>
                <TableHead className="text-center align-middle bg-muted">%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {contestantsGroup.length > 0 ? (
                [...contestantsGroup]
                  .sort((a, b) => (ranks[a.id] || 99) - (ranks[b.id] || 99))
                  .map((contestant, index) => {
                    // Calculate total and average scores
                    let total = 0
                    let count = 0

                    judges.forEach((judge) => {
                      let judgeTotal = 0
                      if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                        judgeTotal = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
                          (sum, score) => sum + score,
                          0,
                        )
                        if (judgeTotal > 0) {
                          total += judgeTotal
                          count++
                        }
                      }
                    })

                    const average = count > 0 ? total / count : 0
                    const percentage = totalMaxScore > 0 ? (total / (totalMaxScore * judges.length)) * 100 : 0
                    const rank = ranks[contestant.id] || "-"
                    const isEven = index % 2 === 0
                    const isExpanded = expandedRows[contestant.id] || false

                    return (
                      <React.Fragment key={contestant.id}>
                        <TableRow
                          className={`divide-x divide-border ${
                            rank === 1 ? "bg-primary/5" : isEven ? "bg-muted/20" : ""
                          } cursor-pointer hover:bg-muted/30`}
                          onClick={() => toggleRowExpansion(contestant.id)}
                        >
                          <TableCell className="text-center align-middle p-2">
                            {isExpanded ? (
                              <ChevronDown className="h-4 w-4 inline-block" />
                            ) : (
                              <ChevronRight className="h-4 w-4 inline-block" />
                            )}
                          </TableCell>
                          <TableCell className="text-center align-middle">{rank}</TableCell>
                          <TableCell className="text-center align-middle">{contestant.name}</TableCell>
                          {judges.map((judge) => {
                            let judgeTotal = 0
                            if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                              judgeTotal = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
                                (sum, score) => sum + score,
                                0,
                              )
                            }

                            return (
                              <TableCell key={judge.id} className="text-center align-middle">
                                {judgeTotal || 0}
                                {totalMaxScore > 0 && (
                                  <span className="text-xs text-muted-foreground ml-1">
                                    ({Math.round(((judgeTotal || 0) / totalMaxScore) * 100)}%)
                                  </span>
                                )}
                              </TableCell>
                            )
                          })}
                          <TableCell className="text-center align-middle font-medium">{total.toFixed(1)}</TableCell>
                          <TableCell className="text-center align-middle">{average.toFixed(2)}</TableCell>
                          <TableCell className="text-center align-middle">{percentage.toFixed(1)}%</TableCell>
                        </TableRow>

                        {/* Expanded row with detailed criteria scores */}
                        {isExpanded && (
                          <TableRow
                            key={`${contestant.id}-expanded`}
                            className={`${rank === 1 ? "bg-primary/5" : isEven ? "bg-muted/20" : ""} border-t-0`}
                          >
                            <TableCell colSpan={judges.length + 6} className="p-0">
                              <div className="p-4 bg-muted/5 border-t border-dashed">
                                <h4 className="font-medium mb-2">Detailed Criteria Scores for {contestant.name}</h4>
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
                                      // Calculate sum and average for this criterion
                                      let totalCriterionScore = 0
                                      let criterionCount = 0

                                      judges.forEach((judge) => {
                                        if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
                                          totalCriterionScore +=
                                            scores[segmentId][contestant.id][judge.id][criterion.id]
                                          criterionCount++
                                        }
                                      })

                                      const avgCriterionScore =
                                        criterionCount > 0 ? totalCriterionScore / criterionCount : 0

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
                                                {criterionScore}
                                                <span className="text-xs text-muted-foreground ml-1">
                                                  ({percentage.toFixed(0)}%)
                                                </span>
                                              </TableCell>
                                            )
                                          })}
                                          <TableCell className="text-center font-medium">
                                            {totalCriterionScore.toFixed(1)}
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
                                        }

                                        return (
                                          <TableCell key={judge.id} className="text-center font-medium">
                                            {total}
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

                                              if (judgeTotal > 0) {
                                                totalScore += judgeTotal
                                              }
                                            }
                                          })

                                          return totalScore.toFixed(1)
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

                                          return count > 0 ? (totalScore / count).toFixed(2) : "-"
                                        })()}
                                      </TableCell>
                                    </TableRow>
                                  </TableBody>
                                </Table>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </React.Fragment>
                    )
                  })
              ) : (
                <TableRow>
                  <TableCell colSpan={judges.length + 6} className="text-center py-4 text-muted-foreground">
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
      <h2 className="text-lg font-semibold mb-4">Detailed Scores</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Total possible score per contestant: <span className="font-medium">{totalMaxScore}</span>
      </p>

      {separateByGender ? (
        <div className="space-y-6">
          {maleContestants.length > 0 && renderDetailedScoresTable(maleContestants, "Male Division")}
          {femaleContestants.length > 0 && renderDetailedScoresTable(femaleContestants, "Female Division")}
        </div>
      ) : (
        renderDetailedScoresTable(segmentContestants)
      )}
    </div>
  )
}

export default DetailedScores
