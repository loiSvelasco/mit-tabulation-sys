"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { convertScoresToRanks } from "@/utils/rankingUtils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Props {
  segmentId: string
}

const JudgeComparison: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()
  const separateByGender = competitionSettings.separateRankingByGender

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender - using case-insensitive comparison
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Add debug logging
  console.log("JudgeComparison - Separate by gender:", separateByGender)
  console.log("JudgeComparison - Male contestants:", maleContestants.length)
  console.log("JudgeComparison - Female contestants:", femaleContestants.length)
  console.log("JudgeComparison - All contestants:", segmentContestants.length)

  // Render judge comparison table for a specific group of contestants
  const renderJudgeComparisonTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate ranks for each judge
    const judgeRankings: Record<string, Record<string, number>> = {}

    judges.forEach((judge) => {
      const judgeScores: Record<string, number> = {}

      contestantsGroup.forEach((contestant) => {
        // Calculate total score from this judge for this contestant
        let totalScore = 0
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          totalScore = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, score) => sum + score, 0)
        }
        judgeScores[contestant.id] = totalScore
      })

      judgeRankings[judge.id] = convertScoresToRanks(judgeScores)
    })

    // Calculate average rank for each contestant
    const avgRanks: Record<string, number> = {}
    contestantsGroup.forEach((contestant) => {
      let totalRank = 0
      let count = 0

      judges.forEach((judge) => {
        const rank = judgeRankings[judge.id]?.[contestant.id]
        if (rank) {
          totalRank += rank
          count++
        }
      })

      avgRanks[contestant.id] = count > 0 ? totalRank / count : 0
    })

    // Sort contestants by average rank
    const sortedContestants = [...contestantsGroup].sort((a, b) => {
      const avgRankA = avgRanks[a.id] || 0
      const avgRankB = avgRanks[b.id] || 0
      return avgRankA - avgRankB
    })

    return (
      <div className="mb-6">
        {groupTitle && <h3 className="text-md font-semibold mb-2">{groupTitle}</h3>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Contestant</TableHead>
              {judges.map((judge) => (
                <TableHead key={judge.id}>{judge.name}</TableHead>
              ))}
              <TableHead className="text-right">Avg Rank</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedContestants.length > 0 ? (
              sortedContestants.map((contestant) => (
                <TableRow key={contestant.id}>
                  <TableCell className="font-medium">{contestant.name}</TableCell>
                  {judges.map((judge) => {
                    const rank = judgeRankings[judge.id]?.[contestant.id] || "-"
                    return <TableCell key={judge.id}>{rank}</TableCell>
                  })}
                  <TableCell className="text-right">
                    {avgRanks[contestant.id] ? avgRanks[contestant.id].toFixed(2) : "-"}
                  </TableCell>
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={judges.length + 2} className="text-center py-4 text-muted-foreground">
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
      <h2 className="text-lg font-semibold mb-4">Judge Comparison</h2>
      <p className="text-sm text-muted-foreground mb-4">Compare how each judge ranked the contestants</p>

      {separateByGender ? (
        <Tabs defaultValue="male" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="male">Male ({maleContestants.length})</TabsTrigger>
            <TabsTrigger value="female">Female ({femaleContestants.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="male">{renderJudgeComparisonTable(maleContestants)}</TabsContent>
          <TabsContent value="female">{renderJudgeComparisonTable(femaleContestants)}</TabsContent>
        </Tabs>
      ) : (
        renderJudgeComparisonTable(segmentContestants)
      )}
    </div>
  )
}

export default JudgeComparison
