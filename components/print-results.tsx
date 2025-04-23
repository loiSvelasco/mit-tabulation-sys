"use client"

import { useRef } from "react"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { format } from "date-fns"
import { calculateSegmentScores, convertScoresToRanks } from "@/utils/rankingUtils"

export function PrintResults({ segmentId }: { segmentId: string }) {
  const printRef = useRef<HTMLDivElement>(null)
  const { competitionSettings, contestants, judges, scores } = useCompetitionStore()

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
  const segmentName = segment?.name || "Results"

  // Check if we need to separate by gender
  const separateByGender = competitionSettings.separateRankingByGender

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender if needed
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Handle print action
  const handlePrint = () => {
    window.print()
  }

  // Render the rankings table for a specific group of contestants
  const renderRankingsTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate rankings using the ranking-utils
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

    // Sort contestants by rank
    const sortedContestants = [...contestantsGroup].sort((a, b) => {
      const rankA = rankings[a.id]?.rank || 999
      const rankB = rankings[b.id]?.rank || 999
      return rankA - rankB
    })

    return (
      <div className="mb-6">
        {groupTitle && (
          <div className="bg-primary/10 px-4 py-2 rounded-t-md print-division">
            <h3 className="text-lg font-semibold">{groupTitle}</h3>
          </div>
        )}

        <table className="w-full border-collapse print-table">
          <thead>
            <tr className="print-header-row">
              <th className="print-cell text-center">Rank</th>
              <th className="print-cell text-center">Contestant</th>
              <th colSpan={judges.length} className="print-cell text-center">
                Raw Scores
              </th>
              <th colSpan={judges.length} className="print-cell text-center">
                Ranks
              </th>
              <th className="print-cell text-center">Avg Rank</th>
              <th className="print-cell text-center">Final Rank</th>
            </tr>
            <tr className="print-header-row">
              <th className="print-cell"></th>
              <th className="print-cell"></th>
              {/* Judge names for raw scores */}
              {judges.map((judge) => (
                <th key={`score-${judge.id}`} className="print-cell text-center px-2 py-1 text-xs">
                  {judge.name}
                </th>
              ))}
              {/* Judge names for ranks */}
              {judges.map((judge) => (
                <th key={`rank-${judge.id}`} className="print-cell text-center px-2 py-1 text-xs">
                  {judge.name}
                </th>
              ))}
              <th className="print-cell"></th>
              <th className="print-cell"></th>
            </tr>
          </thead>
          <tbody>
            {sortedContestants.length > 0 ? (
              sortedContestants.map((contestant, index) => {
                // Calculate average rank
                let totalRank = 0
                let rankCount = 0

                judges.forEach((judge) => {
                  const rank = judgeRankings[judge.id]?.[contestant.id]
                  if (rank) {
                    totalRank += rank
                    rankCount++
                  }
                })

                const avgRank = rankCount > 0 ? totalRank / rankCount : 0

                return (
                  <tr key={contestant.id} className="print-row">
                    <td className="print-cell text-center">{rankings[contestant.id]?.rank || "-"}</td>
                    <td className="print-cell">
                      {contestant.name}
                      {contestant.gender && <span className="ml-2 text-xs">({contestant.gender})</span>}
                    </td>

                    {/* Raw scores for each judge */}
                    {judges.map((judge) => {
                      let score = 0
                      if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                        score = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, s) => sum + s, 0)
                      }

                      return (
                        <td key={`score-${judge.id}`} className="print-cell text-center">
                          {score || "-"}
                        </td>
                      )
                    })}

                    {/* Ranks from each judge */}
                    {judges.map((judge) => {
                      const rank = judgeRankings[judge.id]?.[contestant.id] || "-"

                      return (
                        <td key={`rank-${judge.id}`} className="print-cell text-center">
                          {rank}
                        </td>
                      )
                    })}

                    {/* Average rank */}
                    <td className="print-cell text-center">{avgRank > 0 ? avgRank.toFixed(2) : "-"}</td>

                    {/* Final rank */}
                    <td className="print-cell text-center font-bold">{rankings[contestant.id]?.rank || "-"}</td>
                  </tr>
                )
              })
            ) : (
              <tr>
                <td colSpan={4 + judges.length * 2} className="print-cell text-center py-4">
                  No contestants in this category
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <>
      <Button onClick={handlePrint} className="flex items-center gap-2 print:hidden" variant="default">
        <Printer className="h-4 w-4" />
        Print Results
      </Button>

      {/* Print-only content - hidden on screen but visible when printing */}
      <div ref={printRef} className="hidden print:block">
        <div className="print-container">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold">{competitionSettings.name}</h1>
            <h2 className="text-xl">{segmentName} - Final Results</h2>
            <p className="text-sm text-muted-foreground">{format(new Date(), "MMMM d, yyyy")}</p>
            <p className="text-sm mt-1">
              <span className="font-medium">Ranking Method:</span> {competitionSettings.ranking.method.toUpperCase()}
              <span className="mx-2">|</span>
              <span className="font-medium">Tiebreaker:</span> {competitionSettings.ranking.tiebreaker}
            </p>
          </div>

          {/* Results Tables */}
          {separateByGender ? (
            <div className="space-y-4">
              {maleContestants.length > 0 && renderRankingsTable(maleContestants, "Male Division")}
              {femaleContestants.length > 0 && renderRankingsTable(femaleContestants, "Female Division")}
            </div>
          ) : (
            renderRankingsTable(segmentContestants)
          )}

          {segment && segment.advancingCandidates > 0 && (
            <p className="text-sm mt-2 mb-4">
              <span className="font-medium">Note:</span> Top {segment.advancingCandidates} contestants will advance to
              the next segment.
            </p>
          )}

          {/* Signature Section */}
          <div className="mt-8 page-break-before">
            <h3 className="text-center font-bold mb-6">Judges' Signatures</h3>
            <div className="grid grid-cols-3 gap-6">
              {judges.map((judge) => (
                <div key={judge.id} className="text-center">
                  <div className="border-b border-black pt-12"></div>
                  <p className="mt-1">{judge.name}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Certification Section */}
          {/* <div className="mt-10">
            <h3 className="text-center font-bold mb-6">Certification</h3>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="border-b border-black pt-12"></div>
                <p className="mt-1">Tabulator</p>
              </div>
              <div className="text-center">
                <div className="border-b border-black pt-12"></div>
                <p className="mt-1">Competition Director</p>
              </div>
            </div>
          </div> */}
        </div>
      </div>

      {/* Print-specific styles */}
      <style jsx global>{`
        @media print {
          @page {
            size: landscape;
            margin: 0.75cm;
          }
          
          body * {
            visibility: hidden;
          }
          
          .print-container,
          .print-container * {
            visibility: visible;
          }
          
          .print-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            padding: 15px;
          }
          
          .print-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
            page-break-inside: avoid;
          }
          
          .print-cell {
            border: 1px solid #000;
            padding: 6px;
            text-align: center;
            font-size: 0.9rem;
          }
          
          .print-header-row {
            background-color: #f0f0f0;
          }
          
          .print-row {
            page-break-inside: avoid;
          }
          
          .print-division {
            background-color: #f0f0f0;
            font-weight: bold;
            padding: 6px;
            margin-top: 15px;
          }
          
          /* Ensure signature lines print well */
          .border-b {
            border-bottom-width: 1px !important;
            border-bottom-color: black !important;
          }
          
          /* Control page breaks */
          .page-break-before {
            page-break-before: auto;
          }
          
          /* Prevent orphaned elements */
          h1, h2, h3, table, thead, tbody, tr {
            page-break-inside: avoid;
          }
          
          /* Reduce spacing to fit more on a page */
          h1, h2, h3, p {
            margin-bottom: 0.3rem;
          }
          
          /* Prevent blank pages */
          html, body {
            height: auto;
          }
        }
      `}</style>
    </>
  )
}
