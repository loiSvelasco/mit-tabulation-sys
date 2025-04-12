"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { convertScoresToRanks } from "@/utils/rankingUtils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Props {
  segmentId: string
}

// Update the DetailedScores component to use criterion-specific scores
const DetailedScores: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()
  const separateByGender = competitionSettings.separateRankingByGender

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender - using case-insensitive comparison
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Add debug logging
  console.log("DetailedScores - Separate by gender:", separateByGender)
  console.log("DetailedScores - Male contestants:", maleContestants.length)
  console.log("DetailedScores - Female contestants:", femaleContestants.length)
  console.log("DetailedScores - All contestants:", segmentContestants.length)

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)

  // Calculate total maximum possible score
  const totalMaxScore = segment?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) || 0

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
        {groupTitle && <h3 className="text-md font-semibold mb-2">{groupTitle}</h3>}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Rank</TableHead>
              <TableHead>Contestant</TableHead>
              {judges.map((judge) => (
                <TableHead key={judge.id}>{judge.name}</TableHead>
              ))}
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Average</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {contestantsGroup.length > 0 ? (
              [...contestantsGroup]
                .sort((a, b) => (ranks[a.id] || 99) - (ranks[b.id] || 99))
                .map((contestant) => {
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

                  return (
                    <TableRow key={contestant.id} className={rank === 1 ? "bg-primary/5" : ""}>
                      <TableCell>{rank}</TableCell>
                      <TableCell className="font-medium">{contestant.name}</TableCell>
                      {judges.map((judge) => {
                        let judgeTotal = 0
                        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                          judgeTotal = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
                            (sum, score) => sum + score,
                            0,
                          )
                        }

                        return (
                          <TableCell key={judge.id}>
                            {judgeTotal || 0}
                            {totalMaxScore > 0 && (
                              <span className="text-xs text-muted-foreground ml-1">
                                ({Math.round(((judgeTotal || 0) / totalMaxScore) * 100)}%)
                              </span>
                            )}
                          </TableCell>
                        )
                      })}
                      <TableCell className="text-right font-medium">{total.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{average.toFixed(2)}</TableCell>
                      <TableCell className="text-right">{percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  )
                })
            ) : (
              <TableRow>
                <TableCell colSpan={judges.length + 5} className="text-center py-4 text-muted-foreground">
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
      <h2 className="text-lg font-semibold mb-4">Detailed Scores</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Total possible score per contestant: <span className="font-medium">{totalMaxScore}</span>
      </p>

      {separateByGender ? (
        <Tabs defaultValue="male" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="male">Male ({maleContestants.length})</TabsTrigger>
            <TabsTrigger value="female">Female ({femaleContestants.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="male">{renderDetailedScoresTable(maleContestants)}</TabsContent>
          <TabsContent value="female">{renderDetailedScoresTable(femaleContestants)}</TabsContent>
        </Tabs>
      ) : (
        renderDetailedScoresTable(segmentContestants)
      )}
    </div>
  )
}

export default DetailedScores
