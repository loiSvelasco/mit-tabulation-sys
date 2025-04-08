"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { convertScoresToRanks } from "@/utils/rankingUtils"

interface Props {
  segmentId: string
}

// Update the DetailedScores component to use criterion-specific scores
const DetailedScores: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings, getTotalScore } = useCompetitionStore()

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)

  // Calculate total maximum possible score
  const totalMaxScore = segment?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) || 0

  // Get segment-specific scores
  const segmentScores = scores[segmentId] || {}

  // Calculate ranks based on total scores
  const contestantTotals: Record<string, number> = {}
  segmentContestants.forEach((contestant) => {
    let total = 0
    judges.forEach((judge) => {
      // Use the getTotalScore helper to get the sum of all criterion scores
      total += getTotalScore(segmentId, contestant.id, judge.id)
    })
    contestantTotals[contestant.id] = total
  })

  const ranks = convertScoresToRanks(contestantTotals)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Detailed Scores</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Total possible score per contestant: <span className="font-medium">{totalMaxScore}</span>
      </p>
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
          {segmentContestants
            .sort((a, b) => (ranks[a.id] || 99) - (ranks[b.id] || 99))
            .map((contestant) => {
              // Calculate total and average scores
              let total = 0
              let count = 0

              judges.forEach((judge) => {
                const judgeTotal = getTotalScore(segmentId, contestant.id, judge.id)
                if (judgeTotal > 0) {
                  total += judgeTotal
                  count++
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
                    const judgeTotal = getTotalScore(segmentId, contestant.id, judge.id)

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
            })}
          {segmentContestants.length === 0 && (
            <TableRow>
              <TableCell colSpan={judges.length + 5} className="text-center py-4 text-muted-foreground">
                No contestants in this segment
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default DetailedScores
