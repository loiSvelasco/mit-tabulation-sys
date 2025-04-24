"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateSegmentScores, convertScoresToRanks, roundToTwoDecimals } from "@/utils/rankingUtils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"

interface Props {
  segmentId: string
}

const RankingBreakdown: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()
  const separateByGender = competitionSettings.separateRankingByGender

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender - using case-insensitive comparison
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Get ranking method description
  const getRankingMethodDescription = () => {
    const method = competitionSettings.ranking.method

    switch (method) {
      case "avg":
        return "Simple average of all judges' scores"
      case "avg-rank":
        return "Average the scores, then rank them"
      case "rank-avg-rank":
        return "Convert scores to ranks per judge, average those ranks, then rank the averages"
      case "weighted":
        return "Different criteria have different weights"
      case "trimmed":
        return `Statistical trimming (removing ${competitionSettings.ranking.trimPercentage}% of extreme scores)`
      case "median":
        return "Use the median score instead of average"
      case "borda":
        return "Points assigned based on rank (1st = n points, 2nd = n-1 points, etc.)"
      case "custom":
        return `Custom formula: ${competitionSettings.ranking.customFormula || "Not specified"}`
      default:
        return "Unknown method"
    }
  }

  // Render breakdown table for a specific group of contestants
  const renderBreakdownTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate rankings
    const rankings = calculateSegmentScores(contestantsGroup, judges, scores, segmentId, competitionSettings.ranking)

    // For each judge, calculate their individual rankings
    const judgeRankings: Record<string, Record<string, number>> = {}

    judges.forEach((judge) => {
      const judgeScores: Record<string, number> = {}

      contestantsGroup.forEach((contestant) => {
        // Get total score from this judge for this contestant
        let totalScore = 0
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          totalScore = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, score) => sum + score, 0)
          // Round the total score
          totalScore = roundToTwoDecimals(totalScore)
        }
        judgeScores[contestant.id] = totalScore
      })

      judgeRankings[judge.id] = convertScoresToRanks(judgeScores)
    })

    // Sort contestants by final rank
    const sortedContestants = [...contestantsGroup].sort((a, b) => {
      const rankA = rankings[a.id]?.rank || 999
      const rankB = rankings[b.id]?.rank || 999
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
                <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                  Contestant
                </TableHead>
                <TableHead colSpan={judges.length} className="text-center bg-muted">
                  Raw Scores
                </TableHead>
                <TableHead colSpan={judges.length} className="text-center bg-muted">
                  Ranks
                </TableHead>
                <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                  Avg Rank
                </TableHead>
                <TableHead rowSpan={2} className="align-middle text-center bg-muted">
                  Final Rank
                </TableHead>
              </TableRow>
              <TableRow className="divide-x divide-border">
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
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {sortedContestants.length > 0 ? (
                sortedContestants.map((contestant, index) => {
                  // Calculate average rank
                  let totalRank = 0
                  let rankCount = 0

                  judges.forEach((judge) => {
                    const rank = judgeRankings[judge.id]?.[contestant.id]
                    if (rank) {
                      totalRank += rank
                      rankCount++
                    }
                  })

                  const avgRank = rankCount > 0 ? roundToTwoDecimals(totalRank / rankCount) : 0
                  const isEven = index % 2 === 0

                  return (
                    <TableRow key={contestant.id} className={`divide-x divide-border ${isEven ? "bg-muted/20" : ""}`}>
                      <TableCell className="font-medium text-center align-middle">{contestant.name}</TableCell>

                      {/* Raw scores for each judge */}
                      {judges.map((judge) => {
                        let score = 0
                        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                          score = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
                            (sum, s) => sum + s,
                            0,
                          )
                          // Round the score
                          score = roundToTwoDecimals(score)
                        }

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

                      {/* Average rank */}
                      <TableCell className="text-center align-middle">
                        {avgRank > 0 ? avgRank.toFixed(2) : "-"}
                      </TableCell>

                      {/* Final rank */}
                      <TableCell className="text-center font-bold align-middle bg-primary/5">
                        {rankings[contestant.id]?.rank ? rankings[contestant.id].rank.toFixed(2) : "-"}
                      </TableCell>
                    </TableRow>
                  )
                })
              ) : (
                <TableRow>
                  <TableCell colSpan={2 + judges.length * 2 + 2} className="text-center py-4 text-muted-foreground">
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
      <h2 className="text-lg font-semibold mb-4">Ranking Breakdown</h2>

      <Alert className="mb-4">
        <Info className="h-4 w-4" />
        <AlertDescription>
          Using <span className="font-medium">{competitionSettings.ranking.method.toUpperCase()}</span> method:{" "}
          {getRankingMethodDescription()}. Tiebreaker:{" "}
          <span className="font-medium">{competitionSettings.ranking.tiebreaker}</span>
        </AlertDescription>
      </Alert>

      {separateByGender ? (
        <div className="space-y-6">
          {maleContestants.length > 0 && renderBreakdownTable(maleContestants, "Male Division")}
          {femaleContestants.length > 0 && renderBreakdownTable(femaleContestants, "Female Division")}
        </div>
      ) : (
        renderBreakdownTable(segmentContestants)
      )}
    </div>
  )
}

export default RankingBreakdown
