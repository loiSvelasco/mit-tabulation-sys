"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateSegmentScores } from "@/utils/rankingUtils"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface Props {
  segmentId: string
}

const FinalRankings: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()
  const separateByGender = competitionSettings.separateRankingByGender

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender if needed - using case-insensitive comparison
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Add debug logging
  console.log("FinalRankings - Separate by gender:", separateByGender)
  console.log("FinalRankings - Male contestants:", maleContestants.length)
  console.log("FinalRankings - Female contestants:", femaleContestants.length)
  console.log("FinalRankings - All contestants:", segmentContestants.length)
  console.log("FinalRankings - First contestant gender:", segmentContestants[0]?.gender)

  // Render the rankings table for a specific group of contestants
  const renderRankingsTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate rankings using the ranking-utils
    const rankings = calculateSegmentScores(contestantsGroup, judges, scores, segmentId, competitionSettings.ranking)

    // Sort contestants by rank
    const sortedContestants = [...contestantsGroup].sort((a, b) => {
      const rankA = rankings[a.id]?.rank || 0
      const rankB = rankings[b.id]?.rank || 0
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
              <TableHead>Score</TableHead>
              <TableHead className="text-right">Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedContestants.length > 0 ? (
              sortedContestants.map((contestant, index) => {
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
              })
            ) : (
              <TableRow>
                <TableCell colSpan={4} className="text-center py-4 text-muted-foreground">
                  No contestants in this category
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    )
  }

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Final Rankings</h2>
      <p className="text-sm text-muted-foreground mb-4">
        Using <span className="font-medium">{competitionSettings.ranking.method.toUpperCase()}</span> ranking method
        with <span className="font-medium">{competitionSettings.ranking.tiebreaker}</span> tiebreaker
      </p>

      {separateByGender ? (
        <Tabs defaultValue="male" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="male">Male ({maleContestants.length})</TabsTrigger>
            <TabsTrigger value="female">Female ({femaleContestants.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="male">{renderRankingsTable(maleContestants)}</TabsContent>
          <TabsContent value="female">{renderRankingsTable(femaleContestants)}</TabsContent>
        </Tabs>
      ) : (
        renderRankingsTable(segmentContestants)
      )}

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
