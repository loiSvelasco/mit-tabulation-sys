"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { convertScoresToRanks } from "@/utils/rankingUtils"

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

  // Render judge comparison table for a specific group of contestants
  const renderJudgeComparisonTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate ranks for each judge
    const judgeRankings: Record<string, Record<string, number>> = {}
    const judgeScores: Record<string, Record<string, number>> = {}

    judges.forEach((judge) => {
      const scores: Record<string, number> = {}

      contestantsGroup.forEach((contestant) => {
        // Calculate total score from this judge for this contestant
        let totalScore = 0
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          totalScore = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, score) => sum + score, 0)
        }
        scores[contestant.id] = totalScore
      })

      judgeScores[judge.id] = scores
      judgeRankings[judge.id] = convertScoresToRanks(scores)
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
        {groupTitle && (
          <div className="bg-primary/10 px-4 py-2 rounded-t-md">
            <h3 className="text-lg font-semibold">{groupTitle}</h3>
          </div>
        )}
        <div className="overflow-x-auto">
          <Table className="border-collapse">
            <TableHeader>
              <TableRow className="divide-x divide-border">
                <TableHead className="text-center align-middle bg-muted">Contestant</TableHead>
                {judges.map((judge) => (
                  <TableHead key={judge.id} className="text-center align-middle bg-muted">
                    {judge.name}
                    <br />
                    <span className="text-xs font-normal">(Score / Rank)</span>
                  </TableHead>
                ))}
                <TableHead className="text-center align-middle bg-muted">Avg Rank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody className="divide-y divide-border">
              {sortedContestants.length > 0 ? (
                sortedContestants.map((contestant, index) => {
                  const isEven = index % 2 === 0

                  return (
                    <TableRow key={contestant.id} className={`divide-x divide-border ${isEven ? "bg-muted/20" : ""}`}>
                      <TableCell className="text-center align-middle">{contestant.name}</TableCell>

                      {judges.map((judge) => {
                        const rank = judgeRankings[judge.id]?.[contestant.id] || "-"
                        const score = judgeScores[judge.id]?.[contestant.id] || 0

                        return (
                          <TableCell key={judge.id} className="text-center align-middle">
                            {score} / {rank}
                          </TableCell>
                        )
                      })}

                      <TableCell className="text-center align-middle">
                        {avgRanks[contestant.id] ? avgRanks[contestant.id].toFixed(2) : "-"}
                      </TableCell>
                    </TableRow>
                  )
                })
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
      </div>
    )
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Judge Comparison</h2>
      <p className="text-sm text-muted-foreground mb-4">Compare how each judge ranked the contestants</p>

      {separateByGender ? (
        <div className="space-y-6">
          {maleContestants.length > 0 && renderJudgeComparisonTable(maleContestants, "Male Division")}
          {femaleContestants.length > 0 && renderJudgeComparisonTable(femaleContestants, "Female Division")}
        </div>
      ) : (
        renderJudgeComparisonTable(segmentContestants)
      )}
    </div>
  )
}

export default JudgeComparison
