"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateSegmentScores } from "@/utils/rankingUtils"

interface Props {
  segmentId: string
}

const FinalRankings: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)

  // Calculate rankings using the ranking-utils
  const rankings = calculateSegmentScores(segmentContestants, judges, scores, segmentId, competitionSettings.ranking)

  // Sort contestants by rank
  const sortedContestants = [...segmentContestants].sort((a, b) => {
    const rankA = rankings[a.id]?.rank || 0
    const rankB = rankings[b.id]?.rank || 0
    return rankA - rankB
  })

  // Add more debug logging to verify the ranking method being used
  console.log("FinalRankings - Ranking Config:", competitionSettings.ranking)
  console.log("FinalRankings - Method:", competitionSettings.ranking.method)
  console.log("FinalRankings - Scores:", scores)
  console.log("Final Rankings - Method:", competitionSettings.ranking.method)
  console.log("FinalRankings - Scores and Ranks:", rankings)

  // Calculate total maximum possible score
  const totalMaxScore = segment?.criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0) || 0

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Final Rankings</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Using <span className="font-medium">{competitionSettings.ranking.method.toUpperCase()}</span> ranking method
        with <span className="font-medium">{competitionSettings.ranking.tiebreaker}</span> tiebreaker
      </p>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Contestant</TableHead>
            <TableHead>Score</TableHead>
            <TableHead className="text-right">Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedContestants.map((contestant, index) => {
            const ranking = rankings[contestant.id]
            const isAdvancing = segment && index < (segment.advancingCandidates || 0)

            return (
              <TableRow key={contestant.id} className={isAdvancing ? "bg-green-50" : ""}>
                <TableCell className="font-medium">{ranking?.rank || "-"}</TableCell>
                <TableCell>
                  {contestant.name}
                  {contestant.gender && <span className="ml-2 text-xs">({contestant.gender})</span>}
                </TableCell>
                <TableCell>{ranking?.score.toFixed(2) || "0.00"}</TableCell>
                <TableCell className="text-right">
                  {isAdvancing && segment && segment.advancingCandidates > 0 ? (
                    <Badge className="bg-green-500">Advancing</Badge>
                  ) : (
                    <Badge variant="outline">Not Advancing</Badge>
                  )}
                </TableCell>
              </TableRow>
            )
          })}
          {sortedContestants.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                No contestants in this segment
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {segment && segment.advancingCandidates > 0 && (
        <p className="text-sm mt-4">
          <span className="font-medium">Note:</span> Top {segment.advancingCandidates} contestants will advance to the
          next segment.
        </p>
      )}
    </div>
  )
}

export default FinalRankings
