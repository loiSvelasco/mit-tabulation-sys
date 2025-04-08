"use client"

import React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { convertScoresToRanks } from "@/utils/rankingUtils"

interface Props {
  segmentId: string
}

const JudgeComparison: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // For each judge, calculate their ranking of contestants
  const judgeRankings: Record<string, Record<string, number>> = {}

  judges.forEach((judge) => {
    const judgeScores: Record<string, number> = {}

    segmentContestants.forEach((contestant) => {
      if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
        const judgeTotal = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
          (sum, score) => sum + score,
          0,
        )
        judgeScores[contestant.id] = judgeTotal
      }
    })

    judgeRankings[judge.id] = convertScoresToRanks(judgeScores)
  })

  // Calculate total ranks (sum of all judges' rankings)
  const totalRanks: Record<string, number> = {}

  segmentContestants.forEach((contestant) => {
    let total = 0
    judges.forEach((judge) => {
      total += judgeRankings[judge.id]?.[contestant.id] || 0
    })
    totalRanks[contestant.id] = total
  })

  // Sort contestants by total rank (lower is better)
  const sortedContestants = [...segmentContestants].sort((a, b) => {
    return (totalRanks[a.id] || 0) - (totalRanks[b.id] || 0)
  })

  // Calculate variance in scores and ranks
  const calculateVariance = (contestantId: string) => {
    // Variance in scores
    const judgeScores = judges.map((judge) => {
      if (!scores[segmentId]?.[contestantId]?.[judge.id]) return 0
      return Object.values(scores[segmentId][contestantId][judge.id]).reduce((sum, score) => sum + score, 0)
    })
    const nonZeroScores = judgeScores.filter((score) => score > 0)

    let scoreVariance = 0
    if (nonZeroScores.length > 1) {
      const mean = nonZeroScores.reduce((sum, score) => sum + score, 0) / nonZeroScores.length
      scoreVariance = Math.sqrt(
        nonZeroScores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / nonZeroScores.length,
      )
    }

    // Variance in ranks
    const judgeRanks = judges.map((judge) => judgeRankings[judge.id]?.[contestantId] || 0)
    const nonZeroRanks = judgeRanks.filter((rank) => rank > 0)

    let rankVariance = 0
    if (nonZeroRanks.length > 1) {
      const mean = nonZeroRanks.reduce((sum, rank) => sum + rank, 0) / nonZeroRanks.length
      rankVariance = Math.sqrt(
        nonZeroRanks.reduce((sum, rank) => sum + Math.pow(rank - mean, 2), 0) / nonZeroRanks.length,
      )
    }

    return { scoreVariance, rankVariance }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Judge Scoring Comparison</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Compare how each judge scored and ranked the contestants. High variance may indicate disagreement among judges.
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead rowSpan={2}>Contestant</TableHead>
            {judges.map((judge) => (
              <TableHead key={judge.id} colSpan={2} className="text-center">
                {judge.name}
              </TableHead>
            ))}
            <TableHead rowSpan={2} className="text-right">
              Avg. Rank
            </TableHead>
            <TableHead rowSpan={2} className="text-right">
              Variance
            </TableHead>
          </TableRow>
          <TableRow>
            {judges.map((judge) => (
              <React.Fragment key={judge.id}>
                <TableHead className="text-center">Score</TableHead>
                <TableHead className="text-center">Rank</TableHead>
              </React.Fragment>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedContestants.map((contestant) => {
            const { scoreVariance, rankVariance } = calculateVariance(contestant.id)
            const avgRank =
              judges.length > 0
                ? judges.reduce((sum, judge) => sum + (judgeRankings[judge.id]?.[contestant.id] || 0), 0) /
                  judges.length
                : 0

            return (
              <TableRow key={contestant.id}>
                <TableCell className="font-medium">{contestant.name}</TableCell>
                {judges.map((judge) => (
                  <React.Fragment key={judge.id}>
                    <TableCell className="text-center">
                      {scores[segmentId]?.[contestant.id]?.[judge.id]
                        ? Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
                            (sum, score) => sum + score,
                            0,
                          )
                        : 0}
                    </TableCell>
                    <TableCell className="text-center">{judgeRankings[judge.id]?.[contestant.id] || "-"}</TableCell>
                  </React.Fragment>
                ))}
                <TableCell className="text-right">{avgRank.toFixed(1)}</TableCell>
                <TableCell className="text-right">
                  <span
                    title={`Score variance: ${scoreVariance.toFixed(2)}, Rank variance: ${rankVariance.toFixed(2)}`}
                  >
                    {scoreVariance.toFixed(2)}
                  </span>
                </TableCell>
              </TableRow>
            )
          })}
          {sortedContestants.length === 0 && (
            <TableRow>
              <TableCell colSpan={judges.length * 2 + 3} className="text-center py-4 text-muted-foreground">
                No contestants in this segment
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}

export default JudgeComparison
