"use client"

import type React from "react"
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { calculateAverageScore } from "@/utils/rankingUtils"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

interface Props {
  segmentId: string
}

const CriteriaScores: React.FC<Props> = ({ segmentId }) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore()

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
  const criteria = segment?.criteria || []

  // Get segment-specific scores
  const segmentScores = scores[segmentId] || {}

  // Get criterion-specific scores for a contestant from a judge
  const getCriterionScore = (contestantId: string, judgeId: string, criterionId: string) => {
    return segmentScores[contestantId]?.[judgeId]?.[criterionId] || 0
  }

  // Calculate maximum possible score for a criterion
  const getMaxScore = (criterion: { maxScore: number }) => {
    return criterion.maxScore
  }

  // Calculate total of all criteria max scores
  const getTotalMaxScore = () => {
    return criteria.reduce((sum, criterion) => sum + criterion.maxScore, 0)
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Criteria Breakdown</h2>

      <div className="flex justify-between items-center mb-4">
        <p className="text-sm">
          <span className="font-medium">Total Possible Score:</span> {getTotalMaxScore()}
        </p>
      </div>

      <Tabs defaultValue={criteria[0]?.id || "all"}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All Criteria</TabsTrigger>
          {criteria.map((criterion) => (
            <TabsTrigger key={criterion.id} value={criterion.id}>
              {criterion.name}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="all">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead rowSpan={2}>Contestant</TableHead>
                {criteria.map((criterion) => (
                  <TableHead key={criterion.id} colSpan={judges.length} className="text-center border-x">
                    {criterion.name} (Max: {criterion.maxScore})
                  </TableHead>
                ))}
                <TableHead rowSpan={2} className="text-right">
                  Total
                </TableHead>
                <TableHead rowSpan={2} className="text-right">
                  %
                </TableHead>
              </TableRow>
              <TableRow>
                {criteria.map((criterion) =>
                  judges.map((judge) => (
                    <TableHead key={`${criterion.id}-${judge.id}`} className="text-center text-xs font-normal">
                      {judge.name}
                    </TableHead>
                  )),
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {segmentContestants.map((contestant) => {
                // Calculate total score across all criteria for this contestant
                let totalScore = 0
                criteria.forEach((criterion) => {
                  judges.forEach((judge) => {
                    totalScore += getCriterionScore(contestant.id, judge.id, criterion.id)
                  })
                })

                // Calculate percentage of total possible score
                const percentage = (totalScore / (getTotalMaxScore() * judges.length)) * 100

                return (
                  <TableRow key={contestant.id}>
                    <TableCell>{contestant.name}</TableCell>
                    {criteria.map((criterion) =>
                      judges.map((judge) => {
                        const score = getCriterionScore(contestant.id, judge.id, criterion.id)
                        return (
                          <TableCell key={`${contestant.id}-${criterion.id}-${judge.id}`} className="text-center">
                            {score.toFixed(1)}
                          </TableCell>
                        )
                      }),
                    )}
                    <TableCell className="text-right font-medium">{totalScore.toFixed(1)}</TableCell>
                    <TableCell className="text-right">{percentage.toFixed(1)}%</TableCell>
                  </TableRow>
                )
              })}
              {segmentContestants.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={criteria.length * judges.length + 3}
                    className="text-center py-4 text-muted-foreground"
                  >
                    No contestants in this segment
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        {criteria.map((criterion) => (
          <TabsContent key={criterion.id} value={criterion.id}>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contestant</TableHead>
                  {judges.map((judge) => (
                    <TableHead key={judge.id}>{judge.name}</TableHead>
                  ))}
                  <TableHead className="text-right">Average</TableHead>
                  <TableHead className="text-right">Out of {criterion.maxScore}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {segmentContestants.map((contestant) => {
                  const judgeScores = judges.map((judge) => getCriterionScore(contestant.id, judge.id, criterion.id))
                  const average = calculateAverageScore(judgeScores)
                  const percentage = (average / getMaxScore(criterion)) * 100

                  return (
                    <TableRow key={contestant.id}>
                      <TableCell>{contestant.name}</TableCell>
                      {judges.map((judge) => (
                        <TableCell key={judge.id}>
                          {getCriterionScore(contestant.id, judge.id, criterion.id).toFixed(1)}
                        </TableCell>
                      ))}
                      <TableCell className="text-right font-medium">{average.toFixed(1)}</TableCell>
                      <TableCell className="text-right">{percentage.toFixed(1)}%</TableCell>
                    </TableRow>
                  )
                })}
                {segmentContestants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={judges.length + 3} className="text-center py-4 text-muted-foreground">
                      No contestants in this segment
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  )
}

export default CriteriaScores
