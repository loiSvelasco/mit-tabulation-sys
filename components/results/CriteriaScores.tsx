"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { convertScoresToRanks, roundToTwoDecimals } from "@/utils/rankingUtils"
import { PrintCriteriaRanking } from "@/components/print-criteria-ranking"
import { Trophy } from "lucide-react"

interface Props {
  segmentId: string
}

const CriteriaScores: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()
  const separateByGender = competitionSettings.separateRankingByGender

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender - using case-insensitive comparison
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
  const criteria = segment?.criteria || []

  // Render criteria scores table for a specific group of contestants
  const renderCriteriaScoresTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate average scores per criterion for each contestant
    const criteriaScores: Record<string, Record<string, number>> = {}
    const rawCriteriaScores: Record<string, Record<string, number[]>> = {}

    // Track highest scores for each criterion
    const highestScores: Record<string, number> = {}

    // Initialize highest scores with zero
    criteria.forEach((criterion) => {
      highestScores[criterion.id] = 0
    })

    contestantsGroup.forEach((contestant) => {
      criteriaScores[contestant.id] = {}
      rawCriteriaScores[contestant.id] = {}

      criteria.forEach((criterion) => {
        let totalScore = 0
        let count = 0
        const rawScores: number[] = []

        judges.forEach((judge) => {
          if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
            const score = scores[segmentId][contestant.id][judge.id][criterion.id]
            totalScore += score
            count++
            rawScores.push(score)
          } else {
            rawScores.push(0)
          }
        })

        const avgScore = count > 0 ? roundToTwoDecimals(totalScore / count) : 0
        criteriaScores[contestant.id][criterion.id] = avgScore
        rawCriteriaScores[contestant.id][criterion.id] = rawScores

        // Update highest score for this criterion if needed
        if (avgScore > highestScores[criterion.id]) {
          highestScores[criterion.id] = avgScore
        }
      })
    })

    // Calculate total scores for ranking
    const totalScores: Record<string, number> = {}
    contestantsGroup.forEach((contestant) => {
      totalScores[contestant.id] = roundToTwoDecimals(
        Object.values(criteriaScores[contestant.id]).reduce((sum, score) => sum + score, 0),
      )
    })

    // Convert to ranks
    const ranks = convertScoresToRanks(totalScores)

    // Sort contestants by rank
    const sortedContestants = [...contestantsGroup].sort((a, b) => {
      const rankA = ranks[a.id] || 99
      const rankB = ranks[b.id] || 99
      return rankA - rankB
    })

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
                <TableHead className="text-center align-middle bg-muted">Rank</TableHead>
                <TableHead className="text-center align-middle bg-muted">Contestant</TableHead>
                {criteria.map((criterion) => (
                  <TableHead key={criterion.id} className="text-center align-middle bg-muted">
                    {criterion.name}
                    <br />
                    <span className="text-xs font-normal">({criterion.maxScore} pts)</span>
                  </TableHead>
                ))}
                <TableHead className="text-center align-middle bg-muted">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {sortedContestants.length > 0 ? (
                sortedContestants.map((contestant, index) => {
                  const rank = ranks[contestant.id] || "-"
                  const total = totalScores[contestant.id] || 0
                  const isEven = index % 2 === 0

                  return (
                    <TableRow
                      key={contestant.id}
                      className={`divide-x divide-border ${rank === 1 ? "bg-primary/5" : isEven ? "bg-muted/20" : ""}`}
                    >
                      <TableCell className="text-center align-middle">{rank}</TableCell>
                      <TableCell className="text-center align-middle">{contestant.name}</TableCell>
                      {criteria.map((criterion) => {
                        const score = criteriaScores[contestant.id][criterion.id] || 0
                        const rawScores = rawCriteriaScores[contestant.id][criterion.id] || []
                        const percentage = criterion.maxScore > 0 ? (score / criterion.maxScore) * 100 : 0

                        // Check if this is the highest score for this criterion
                        const isHighestScore = score > 0 && score === highestScores[criterion.id]

                        return (
                          <TableCell
                            key={criterion.id}
                            className={`text-center align-middle ${isHighestScore ? "bg-green-100 dark:bg-green-900/30" : ""}`}
                          >
                            <div className="flex items-center justify-center">
                              <span className="font-medium">{score.toFixed(2)}</span>
                              {isHighestScore && <Trophy className="h-4 w-4 text-amber-500 ml-1" />}
                              <span className="text-xs text-muted-foreground ml-1">
                                ({roundToTwoDecimals(percentage).toFixed(0)}%)
                              </span>
                            </div>
                            <div className="text-xs font-mono text-muted-foreground mt-1">
                              Raw: {rawScores.map((s) => roundToTwoDecimals(s)).join(", ")}
                            </div>
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-center align-middle font-medium">{total.toFixed(2)}</TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={criteria.length + 3} className="text-center py-4 text-muted-foreground">
                    No contestants in this category
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>

        <div className="mt-2 text-xs flex items-center">
          <Trophy className="h-3 w-3 text-amber-500 mr-1" />
          <span className="text-muted-foreground">Indicates highest score in the criterion</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold mb-4">Criteria Breakdown</h2>
          <p className="text-sm text-muted-foreground mb-4">Average scores per criterion across all judges</p>
        </div>
        <PrintCriteriaRanking className="float-right" key={segment?.id} segmentId={segment?.id} />
      </div>

      {separateByGender ? (
        <div className="space-y-6">
          {maleContestants.length > 0 && renderCriteriaScoresTable(maleContestants, "Male Division")}
          {femaleContestants.length > 0 && renderCriteriaScoresTable(femaleContestants, "Female Division")}
        </div>
      ) : (
        renderCriteriaScoresTable(segmentContestants)
      )}
    </div>
  )
}

export default CriteriaScores
