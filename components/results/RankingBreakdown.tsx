"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateSegmentScores, convertScoresToRanks } from "@/utils/rankingUtils"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Info } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

  // Add debug logging
  console.log("RankingBreakdown - Separate by gender:", separateByGender)
  console.log("RankingBreakdown - Male contestants:", maleContestants.length)
  console.log("RankingBreakdown - Female contestants:", femaleContestants.length)
  console.log("RankingBreakdown - All contestants:", segmentContestants.length)

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
        }
        judgeScores[contestant.id] = totalScore
      })

      judgeRankings[judge.id] = convertScoresToRanks(judgeScores)
    })

    return (
      <div className="mb-6">
        {groupTitle && <h3 className="text-md font-semibold mb-2">{groupTitle}</h3>}
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
            {contestantsGroup.length > 0 ? (
              [...contestantsGroup]
                .sort((a, b) => {
                  const rankA = rankings[a.id]?.rank || 0
                  const rankB = rankings[b.id]?.rank || 0
                  return rankA - rankB
                })
                .map((contestant) => (
                  <TableRow key={contestant.id}>
                    <TableCell>{contestant.name}</TableCell>
                    {judges.map((judge) => {
                      // Get total score from this judge for this contestant
                      let score = 0
                      if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                        score = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, s) => sum + s, 0)
                      }
                      const rank = judgeRankings[judge.id]?.[contestant.id] || "-"

                      return (
                        <TableCell key={judge.id}>
                          {score} / {rank}
                        </TableCell>
                      )
                    })}
                    <TableCell className="font-medium">{rankings[contestant.id]?.score.toFixed(2) || "0.00"}</TableCell>
                    <TableCell className="font-medium">{rankings[contestant.id]?.rank || "-"}</TableCell>
                  </TableRow>
                ))
            ) : (
              <TableRow>
                <TableCell colSpan={judges.length + 3} className="text-center py-4 text-muted-foreground">
                  No contestants in this category
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
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
        <Tabs defaultValue="male" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="male">Male ({maleContestants.length})</TabsTrigger>
            <TabsTrigger value="female">Female ({femaleContestants.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="male">{renderBreakdownTable(maleContestants)}</TabsContent>
          <TabsContent value="female">{renderBreakdownTable(femaleContestants)}</TabsContent>
        </Tabs>
      ) : (
        renderBreakdownTable(segmentContestants)
      )}
    </div>
  )
}

export default RankingBreakdown
