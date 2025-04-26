"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Printer, FileDown, Loader2 } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { format } from "date-fns"
import { calculateSegmentScores, convertScoresToRanks, roundToTwoDecimals } from "@/utils/rankingUtils"

export function PrintResults({ segmentId }: { segmentId: string }) {
  const [isGenerating, setIsGenerating] = useState(false)
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

  // Handle print action (browser printing)
  const handlePrint = () => {
    window.print()
  }

  // Generate PDF using browser's print to PDF functionality with controlled layout
  const generatePDF = async () => {
    setIsGenerating(true)

    try {
      // Create a new window
      const printWindow = window.open("", "_blank")

      if (!printWindow) {
        throw new Error("Could not open print window. Please check your popup blocker settings.")
      }

      // Write the HTML content to the new window
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${competitionSettings.name} - ${segmentName} Results</title>
          <style>
            /* Reset and base styles */
            * {
              box-sizing: border-box;
              margin: 0;
              padding: 0;
            }
            
            body {
              font-family: Arial, sans-serif;
              line-height: 1.2;
              color: #000;
              background: #fff;
              width: 100%;
              height: 100%;
              margin: 0;
              padding: 0;
            }
            
            /* Page setup */
            @page {
              size: landscape;
              margin: 8mm;
            }
            
            /* Container for each result section */
            .result-section {
              page-break-inside: avoid !important;
              margin-bottom: 10mm;
              display: block;
              width: 100%;
            }
            
            /* Header styles - more compact */
            .header {
              text-align: center;
              margin-bottom: 3mm;
              padding-bottom: 2mm;
              border-bottom: 0.3mm solid #eee;
            }
            
            .header h1 {
              font-size: 14pt;
              font-weight: bold;
              margin-bottom: 1mm;
            }
            
            .header h2 {
              font-size: 12pt;
              margin-bottom: 1mm;
            }
            
            .header p {
              font-size: 8pt;
              margin-bottom: 0.5mm;
            }
            
            /* Division header - more compact */
            .division-header {
              background-color: #f0f0f0;
              padding: 1mm 2mm;
              font-weight: bold;
              font-size: 10pt;
              border-top-left-radius: 1mm;
              border-top-right-radius: 1mm;
              margin-top: 3mm;
            }
            
            /* Table styles - more compact */
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 3mm;
              font-size: 8pt;
            }
            
            th, td {
              border: 0.2mm solid #000;
              padding: 1mm;
              text-align: center;
            }
            
            th {
              background-color: #f0f0f0;
              font-weight: bold;
            }
            
            /* Column widths for better space usage */
            .col-rank { width: 5%; }
            .col-contestant { width: 15%; }
            .col-avg-rank { width: 6%; }
            .col-final-rank { width: 6%; }
            
            /* Utility classes */
            .text-center { text-align: center; }
            .text-left { text-align: left; }
            .font-bold { font-weight: bold; }
            .text-sm { font-size: 8pt; }
            .text-xs { font-size: 7pt; }
            
            /* Notes */
            .note {
              font-size: 8pt;
              margin-top: 2mm;
              margin-bottom: 3mm;
            }
            
            /* Signature section */
            .signature-section {
              page-break-before: always;
              padding-top: 8mm;
            }
            
            .signature-title {
              text-align: center;
              font-size: 12pt;
              margin-bottom: 10mm;
            }
            
            .signatures {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 8mm;
            }
            
            .signature {
              text-align: center;
            }
            
            .signature-line {
              border-bottom: 0.5mm solid #000;
              height: 12mm;
            }
            
            .signature-name {
              margin-top: 1mm;
              font-size: 9pt;
            }
          </style>
        </head>
        <body>
          ${renderResultSections()}
          
          <!-- Signature Section -->
          <div class="signature-section">
            <h3 class="signature-title">Judges' Signatures</h3>
            <div class="signatures">
              ${judges
                .map(
                  (judge) => `
                <div class="signature">
                  <div class="signature-line"></div>
                  <p class="signature-name">${judge.name}</p>
                </div>
              `,
                )
                .join("")}
            </div>
          </div>
          
          <script>
            // Automatically open print dialog when the page loads
            window.onload = function() {
              setTimeout(function() {
                window.print();
                // Close the window after printing (or if print is canceled)
                setTimeout(function() {
                  window.close();
                }, 500);
              }, 500);
            };
          </script>
        </body>
        </html>
      `)

      printWindow.document.close()
    } catch (error) {
      console.error("Error generating PDF:", error)
      alert("There was an error generating the PDF. Please try again.")
    } finally {
      setIsGenerating(false)
    }
  }

  // Render result sections for PDF
  const renderResultSections = () => {
    let html = ""

    // Add the main header section
    html += `
      <div class="result-section">
        <div class="header">
          <h1>${competitionSettings.name}</h1>
          <h2>${segmentName} - Final Results</h2>
          <p>${format(new Date(), "MMMM d, yyyy")}</p>
          <p>
            <span class="font-bold">Ranking Method:</span> ${competitionSettings.ranking.method.toUpperCase()}
            <span style="margin: 0 3mm;">|</span>
            <span class="font-bold">Tiebreaker:</span> ${competitionSettings.ranking.tiebreaker}
          </p>
        </div>
    `

    // Add tables based on gender separation
    if (separateByGender) {
      if (maleContestants.length > 0) {
        html += renderResultTable(maleContestants, "Male Division")
      }

      if (femaleContestants.length > 0) {
        html += renderResultTable(femaleContestants, "Female Division")
      }
    } else {
      html += renderResultTable(segmentContestants)
    }

    // Add advancing note if applicable
    if (segment && segment.advancingCandidates > 0) {
      html += `
        <p class="note">
          <span class="font-bold">Note:</span> Top ${segment.advancingCandidates} contestants will advance to the next segment.
        </p>
      `
    }

    // Close the result section
    html += `</div>`

    return html
  }

  // Render a table for PDF as HTML string
  const renderResultTable = (contestantsGroup, groupTitle?: string) => {
    // Calculate rankings
    const rankings = calculateSegmentScores(contestantsGroup, judges, scores, segmentId, competitionSettings.ranking)

    // For each judge, calculate their individual rankings
    const judgeRankings = {}

    judges.forEach((judge) => {
      const judgeScores = {}

      contestantsGroup.forEach((contestant) => {
        // Get total score from this judge for this contestant
        let totalScore = 0
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          totalScore = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, score) => sum + score, 0)
          // Round the total score
          totalScore = roundToTwoDecimals(totalScore)
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

    let html = ""

    // Add division title if provided
    if (groupTitle) {
      html += `
        <div class="division-header">
          <h3>${groupTitle}</h3>
        </div>
      `
    }

    // Calculate column width for judge columns
    const judgeColWidth = (68 / (judges.length * 2)).toFixed(1)

    // Start table
    html += `
      <table>
        <colgroup>
          <col class="col-rank">
          <col class="col-contestant">
    `

    // Add column definitions for judge scores and ranks
    judges.forEach(() => {
      html += `<col style="width: ${judgeColWidth}%;">`
    })

    judges.forEach(() => {
      html += `<col style="width: ${judgeColWidth}%;">`
    })

    html += `
          <col class="col-avg-rank">
          <col class="col-final-rank">
        </colgroup>
        <thead>
          <tr>
            <th>Rank</th>
            <th>Contestant</th>
            <th colspan="${judges.length}">Raw Scores</th>
            <th colspan="${judges.length}">Ranks</th>
            <th>Avg Rank</th>
            <th>Final Rank</th>
          </tr>
          <tr>
            <th></th>
            <th></th>
    `

    // Add judge names for scores
    judges.forEach((judge) => {
      html += `<th class="text-xs">${judge.name}</th>`
    })

    // Add judge names for ranks
    judges.forEach((judge) => {
      html += `<th class="text-xs">${judge.name}</th>`
    })

    // Complete header row
    html += `
            <th></th>
            <th></th>
          </tr>
        </thead>
        <tbody>
    `

    // Add contestant rows
    if (sortedContestants.length > 0) {
      sortedContestants.forEach((contestant) => {
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

        const avgRank = rankCount > 0 ? roundToTwoDecimals(totalRank / rankCount) : 0

        // Start row
        html += `
          <tr>
            <td>${rankings[contestant.id]?.rank ? rankings[contestant.id].rank.toFixed(2) : "-"}</td>
            <td class="text-left">
              ${contestant.name}
              ${contestant.gender ? `<span class="text-xs" style="margin-left: 1mm;">(${contestant.gender})</span>` : ""}
            </td>
        `

        // Add scores
        judges.forEach((judge) => {
          let score = 0
          if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
            score = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, s) => sum + s, 0)
            score = roundToTwoDecimals(score)
          }

          html += `<td>${score > 0 ? score.toFixed(2) : "-"}</td>`
        })

        // Add ranks
        judges.forEach((judge) => {
          const rank = judgeRankings[judge.id]?.[contestant.id] || "-"
          html += `<td>${typeof rank === "number" ? rank.toFixed(2) : rank}</td>`
        })

        // Add average and final rank
        html += `
            <td>${avgRank > 0 ? avgRank.toFixed(2) : "-"}</td>
            <td class="font-bold">${rankings[contestant.id]?.rank ? rankings[contestant.id].rank.toFixed(2) : "-"}</td>
          </tr>
        `
      })
    } else {
      // No contestants
      html += `
        <tr>
          <td colspan="${4 + judges.length * 2}" class="text-center">
            No contestants in this category
          </td>
        </tr>
      `
    }

    // Close table
    html += `
        </tbody>
      </table>
    `

    return html
  }

  // Render the rankings table for a specific group of contestants (for browser printing)
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
          // Round the total score
          totalScore = roundToTwoDecimals(totalScore)
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

                const avgRank = rankCount > 0 ? roundToTwoDecimals(totalRank / rankCount) : 0

                return (
                  <tr key={contestant.id} className="print-row">
                    <td className="print-cell text-center">
                      {rankings[contestant.id]?.rank ? rankings[contestant.id].rank.toFixed(2) : "-"}
                    </td>
                    <td className="print-cell">
                      {contestant.name}
                      {contestant.gender && <span className="ml-2 text-xs">({contestant.gender})</span>}
                    </td>

                    {/* Raw scores for each judge */}
                    {judges.map((judge) => {
                      let score = 0
                      if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
                        score = Object.values(scores[segmentId][contestant.id][judge.id]).reduce((sum, s) => sum + s, 0)
                        // Round the score
                        score = roundToTwoDecimals(score)
                      }

                      return (
                        <td key={`score-${judge.id}`} className="print-cell text-center">
                          {score > 0 ? score.toFixed(2) : "-"}
                        </td>
                      )
                    })}

                    {/* Ranks from each judge */}
                    {judges.map((judge) => {
                      const rank = judgeRankings[judge.id]?.[contestant.id] || "-"

                      return (
                        <td key={`rank-${judge.id}`} className="print-cell text-center">
                          {typeof rank === "number" ? rank.toFixed(2) : rank}
                        </td>
                      )
                    })}

                    {/* Average rank */}
                    <td className="print-cell text-center">{avgRank > 0 ? avgRank.toFixed(2) : "-"}</td>

                    {/* Final rank */}
                    <td className="print-cell text-center font-bold">
                      {rankings[contestant.id]?.rank ? rankings[contestant.id].rank.toFixed(2) : "-"}
                    </td>
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
      <div className="flex items-center gap-2">
        <Button onClick={handlePrint} className="flex items-center gap-2 print:hidden" variant="outline">
          <Printer className="h-4 w-4" />
          Print (Browser)
        </Button>

        <Button
          onClick={generatePDF}
          className="flex items-center gap-2 print:hidden"
          variant="default"
          disabled={isGenerating}
        >
          {isGenerating ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Generating PDF...
            </>
          ) : (
            <>
              <FileDown className="h-4 w-4" />
              Generate PDF
            </>
          )}
        </Button>
      </div>

      {/* Content for browser printing */}
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
            <div className="grid grid-cols-3 gap-6">
              {judges.map((judge) => (
                <div key={judge.id} className="text-center">
                  <div className="border-b border-black pt-12"></div>
                  <p className="mt-1">{judge.name}</p>
                </div>
              ))}
            </div>
          </div>
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
