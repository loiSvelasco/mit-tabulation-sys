"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateSegmentScores, convertScoresToRanks } from "@/utils/rankingUtils"
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

  // Group contestants by gender if needed
  const groupedContestants = separateByGender
    ? {
        Male: segmentContestants.filter((c) => c.gender === "Male"),
        Female: segmentContestants.filter((c) => c.gender === "Female"),
      }
    : { All: segmentContestants }

  // Calculate rankings for each group
  const groupRankings: Record<string, Record<string, { score: number; rank: number }>> = {}

  Object.entries(groupedContestants).forEach(([group, groupContestants]) => {
    groupRankings[group] = calculateSegmentScores(
      groupContestants,
      judges,
      scores,
      segmentId,
      competitionSettings.ranking,
    )
  })

  // For each judge, calculate their individual rankings
  const judgeRankings: Record<string, Record<string, Record<string, number>>> = {}

  Object.entries(groupedContestants).forEach(([group, groupContestants]) => {
    judgeRankings[group] = {}

    judges.forEach((judge) => {
      const judgeScores: Record<string, number> = {}

      groupContestants.forEach((contestant) => {
        judgeScores[contestant.id] = scores[contestant.id]?.[judge.id] || 0
      })

      judgeRankings[group][judge.id] = convertScoresToRanks(judgeScores)
    })
  })

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

      {Object.entries(groupedContestants).map(([group, groupContestants]) => (
        <div key={group} className="mb-6">
          <h3 className="font-semibold mb-2">{separateByGender ? `${group} Division` : "Overall"}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contestant</TableHead>
                {judges.map((judge) => (
                  <TableHead key={judge.id}>
                    {judge.name}
                    <br />
                    <span className="text-xs font-normal">(Score / Rank)</span>
                  </TableHead>
                ))}
                <TableHead>Final Score</TableHead>
                <TableHead>Final Rank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupContestants
                .sort((a, b) => {
                  const rankA = groupRankings[group][a.id]?.rank || 0
                  const rankB = groupRankings[group][b.id]?.rank || 0
                  console.log(`Sorting ${a.name}: Rank ${rankA} vs ${b.name}: Rank ${rankB}`)
                  return rankA - rankB
                })
                .map((contestant) => (
                  <TableRow key={contestant.id}>
                    <TableCell>{contestant.name}</TableCell>
                    {judges.map((judge) => {
                      const score = scores[contestant.id]?.[judge.id] || 0
                      const rank = judgeRankings[group][judge.id]?.[contestant.id] || "-"

                      return (
                        <TableCell key={judge.id}>
                          {score} / {rank}
                        </TableCell>
                      )
                    })}
                    <TableCell className="font-medium">
                      {groupRankings[group][contestant.id]?.score.toFixed(2) || "0.00"}
                    </TableCell>
                    <TableCell className="font-medium">{groupRankings[group][contestant.id]?.rank || "-"}</TableCell>
                  </TableRow>
                ))}
              {groupContestants.length === 0 && (
                <TableRow>
                  <TableCell colSpan={judges.length + 3} className="text-center py-4 text-muted-foreground">
                    No contestants in this group
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      ))}
    </div>
  )
}

export default RankingBreakdown
