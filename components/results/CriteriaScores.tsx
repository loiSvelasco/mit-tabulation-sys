"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { convertScoresToRanks } from "@/utils/rankingUtils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

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

  // Add debug logging
  console.log("CriteriaScores - Separate by gender:", separateByGender)
  console.log("CriteriaScores - Male contestants:", maleContestants.length)
  console.log("CriteriaScores - Female contestants:", femaleContestants.length)
  console.log("CriteriaScores - All contestants:", segmentContestants.length)

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
  const criteria = segment?.criteria || []

  // Render criteria scores table for a specific group of contestants
  const renderCriteriaScoresTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate average scores per criterion for each contestant
    const criteriaScores: Record<string, Record<string, number>> = {}

    contestantsGroup.forEach((contestant) => {
      criteriaScores[contestant.id] = {}

      criteria.forEach((criterion) => {
        let totalScore = 0
        let count = 0

        judges.forEach((judge) => {
          if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
            totalScore += scores[segmentId][contestant.id][judge.id][criterion.id]
            count++
          }
        })

        criteriaScores[contestant.id][criterion.id] = count > 0 ? totalScore / count : 0
      })
    })

    // Calculate total scores for ranking
    const totalScores: Record<string, number> = {}
    contestantsGroup.forEach((contestant) => {
      totalScores[contestant.id] = Object.values(criteriaScores[contestant.id]).reduce((sum, score) => sum + score, 0)
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
        {groupTitle && <h3 className="text-md font-semibold mb-2">{groupTitle}</h3>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Contestant</TableHead>
              {criteria.map((criterion) => (
                <TableHead key={criterion.id}>
                  {criterion.name}
                  <br />
                  <span className="text-xs font-normal">({criterion.maxScore} pts)</span>
                </TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedContestants.length > 0 ? (
              sortedContestants.map((contestant) => {
                const rank = ranks[contestant.id] || "-"
                const total = totalScores[contestant.id] || 0

                return (
                  <TableRow key={contestant.id} className={rank === 1 ? "bg-primary/5" : ""}>
                    <TableCell>{rank}</TableCell>
                    <TableCell className="font-medium">{contestant.name}</TableCell>
                    {criteria.map((criterion) => {
                      const score = criteriaScores[contestant.id][criterion.id] || 0
                      const percentage = criterion.maxScore > 0 ? (score / criterion.maxScore) * 100 : 0

                      return (
                        <TableCell key={criterion.id}>
                          {score.toFixed(2)}
                          <span className="text-xs text-muted-foreground ml-1">({percentage.toFixed(0)}%)</span>
                        </TableCell>
                      )
                    })}
                    <TableCell className="text-right font-medium">{total.toFixed(2)}</TableCell>
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
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Criteria Breakdown</h2>
      <p className="text-sm text-muted-foreground mb-4">Average scores per criterion across all judges</p>

      {separateByGender ? (
        <Tabs defaultValue="male" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="male">Male ({maleContestants.length})</TabsTrigger>
            <TabsTrigger value="female">Female ({femaleContestants.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="male">{renderCriteriaScoresTable(maleContestants)}</TabsContent>
          <TabsContent value="female">{renderCriteriaScoresTable(femaleContestants)}</TabsContent>
        </Tabs>
      ) : (
        renderCriteriaScoresTable(segmentContestants)
      )}
    </div>
  )
}

export default CriteriaScores
