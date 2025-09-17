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
            
            /* Page setup - Enhanced A4 Landscape */
            @page {
              size: A4 landscape;
              margin: 10mm 8mm;
            }
            
            /* Container for each result section */
            .result-section {
              page-break-inside: avoid !important;
              margin-bottom: 10mm;
              display: block;
              width: 100%;
            }
            
            /* Enhanced header styles for PDF */
            .header {
              text-align: center;
              margin-bottom: 6mm;
              padding: 4mm 0;
              border-bottom: 0.3mm solid #2c3e50;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            }
            
            .header h1 {
              font-size: 12pt;
              font-weight: bold;
              margin-bottom: 2mm;
              color: #2c3e50;
              text-transform: uppercase;
              letter-spacing: 1pt;
            }
            
            .header h2 {
              font-size: 10pt;
              margin-bottom: 2mm;
              color: #34495e;
              font-weight: 600;
            }
            
            .header p {
              font-size: 9pt;
              margin-bottom: 0.5mm;
              color: #7f8c8d;
            }
            
            .header .competition-info {
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-top: 2mm;
              font-size: 8pt;
              color: #555;
            }
            
            /* Enhanced division header */
            .division-header {
              background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
              color: white;
              padding: 2mm 3mm;
              font-weight: bold;
              font-size: 9pt;
              border-top-left-radius: 2mm;
              border-top-right-radius: 2mm;
              margin-top: 4mm;
              text-align: center;
              text-transform: uppercase;
              letter-spacing: 0.3pt;
            }
            
            /* Enhanced table styles for PDF */
            table {
              width: 100%;
              border-collapse: collapse;
              margin-bottom: 6mm;
              font-size: 9pt;
              border: 0.2mm solid #2c3e50;
            }
            
            th, td {
              border: 0.1mm solid #2c3e50;
              padding: 1.5mm 1mm;
              text-align: center;
              vertical-align: middle;
            }
            
            th {
              background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
              color: white;
              font-weight: bold;
              font-size: 8pt;
              text-transform: uppercase;
              letter-spacing: 0.3pt;
              padding: 2mm 1mm;
            }
            
            tbody tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            
            tbody tr:hover {
              background-color: #e3f2fd;
            }
            
            /* Enhanced column widths for better space usage */
            .col-rank { width: 5%; }
            .col-contestant { width: 15%; }
            .col-avg-rank { width: 6%; }
            .col-final-rank { width: 6%; }
            
            /* Dynamic judge column widths - more aggressive scaling */
            .col-judge-score, .col-judge-rank {
              width: calc(68% / var(--judge-count, 1));
              min-width: 6mm;
              max-width: 12mm;
            }
            
            /* For tables with many judges, make text smaller */
            .many-judges table {
              font-size: 7pt;
            }
            
            .many-judges th, .many-judges td {
              padding: 0.8mm 0.5mm;
              font-size: 7pt;
            }
            
            .many-judges .col-contestant {
              width: 12%;
            }
            
            .many-judges .col-rank, .many-judges .col-avg-rank, .many-judges .col-final-rank {
              width: 4%;
            }
            
            /* For very many judges (8+), use even more compact layout */
            .very-many-judges table {
              font-size: 6pt;
            }
            
            .very-many-judges th, .very-many-judges td {
              padding: 0.5mm 0.3mm;
              font-size: 6pt;
            }
            
            .very-many-judges .col-contestant {
              width: 10%;
            }
            
            .very-many-judges .col-rank, .very-many-judges .col-avg-rank, .very-many-judges .col-final-rank {
              width: 3%;
            }
            
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
            
            /* Signature section - only break if needed */
            .signature-section {
              page-break-before: auto;
              padding-top: 8mm;
              margin-top: 10mm;
            }
            
            /* Try to keep signature section with content */
            .signature-section {
              page-break-inside: avoid;
            }
            
            .signature-title {
              text-align: center;
              font-size: 9pt;
              margin-bottom: 12mm;
              font-weight: bold;
              color: #2c3e50;
              text-transform: uppercase;
              letter-spacing: 0.5pt;
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
                  (judge, index) => `
                <div class="signature">
                  <div class="signature-line"></div>
                  <p class="signature-name">${judge.name} - J${index + 1}</p>
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

    // Add the enhanced main header section
    html += `
      <div class="result-section">
        <div class="header">
          <h1>${competitionSettings.name}</h1>
          <h2>${segmentName} - Final Results</h2>
          <p>${format(new Date(), "MMMM d, yyyy")}</p>
          <div class="competition-info">
            <span><strong>Ranking Method:</strong> ${competitionSettings.ranking.method.toUpperCase()}</span>
            <span><strong>Tiebreaker:</strong> ${competitionSettings.ranking.tiebreaker}</span>
            <span><strong>Total Contestants:</strong> ${segmentContestants.length}</span>
          </div>
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
  const renderResultTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    // Calculate rankings
    const rankings = calculateSegmentScores(contestantsGroup, judges, scores, segmentId, competitionSettings.ranking)

    // For each judge, calculate their individual rankings
    const judgeRankings: Record<string, Record<string, number>> = {}

    judges.forEach((judge) => {
      const judgeScores: Record<string, number> = {}

      contestantsGroup.forEach((contestant) => {
        // Get total score from this judge for this contestant
        let totalScore = 0
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          totalScore = Object.values(scores[segmentId][contestant.id][judge.id] as Record<string, number>).reduce((sum, score) => sum + score, 0)
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

    // Calculate column width for judge columns with enhanced spacing
    const judgeColWidth = (62 / (judges.length * 2)).toFixed(1)

    // Determine if we need compact styling for many judges
    const hasManyJudges = judges.length >= 6
    const hasVeryManyJudges = judges.length >= 8
    const tableClass = hasVeryManyJudges ? 'very-many-judges' : (hasManyJudges ? 'many-judges' : '')
    
    // Start table with enhanced styling
    html += `
      <table class="${tableClass}" style="--judge-count: ${judges.length};">
        <colgroup>
          <col class="col-rank">
          <col class="col-contestant">
    `

    // Add column definitions for judge scores and ranks
    judges.forEach(() => {
      html += `<col class="col-judge-score" style="width: ${judgeColWidth}%;">`
    })

    judges.forEach(() => {
      html += `<col class="col-judge-rank" style="width: ${judgeColWidth}%;">`
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
    judges.forEach((judge, index) => {
      html += `<th class="text-xs">J${index + 1}</th>`
    })

    // Add judge names for ranks
    judges.forEach((judge, index) => {
      html += `<th class="text-xs">J${index + 1}</th>`
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
          totalScore = Object.values(scores[segmentId][contestant.id][judge.id] as Record<string, number>).reduce((sum, score) => sum + score, 0)
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

    // Determine if we need compact styling for many judges
    const hasManyJudges = judges.length >= 6
    const hasVeryManyJudges = judges.length >= 8
    
    return (
      <div className="mb-6">
        {groupTitle && (
          <div className="bg-primary/10 px-4 py-2 rounded-t-md print-division">
            <h3 className="text-lg font-semibold">{groupTitle}</h3>
          </div>
        )}

        <table className={`w-full border-collapse print-table ${hasVeryManyJudges ? 'very-many-judges' : (hasManyJudges ? 'many-judges' : '')}`}>
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
              {judges.map((judge, index) => (
                <th key={`score-${judge.id}`} className="print-cell text-center px-2 py-1 text-xs">
                  J{index + 1}
                </th>
              ))}
              {/* Judge names for ranks */}
              {judges.map((judge, index) => (
                <th key={`rank-${judge.id}`} className="print-cell text-center px-2 py-1 text-xs">
                  J{index + 1}
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
        <Button onClick={handlePrint} className="flex items-center gap-2" variant="outline">
          <Printer className="h-4 w-4" />
          Print (Browser)
        </Button>

        <Button
          onClick={generatePDF}
          className="flex items-center gap-2"
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
          <div className="text-center mb-6 print-header">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-gray-800">{competitionSettings.name}</h1>
            <h2 className="text-xl font-semibold text-gray-700">{segmentName} - Final Results</h2>
            <p className="text-sm text-gray-600">{format(new Date(), "MMMM d, yyyy")}</p>
            <div className="flex justify-between items-center mt-2 text-xs text-gray-600">
              <span><strong>Ranking Method:</strong> {competitionSettings.ranking.method.toUpperCase()}</span>
              <span><strong>Tiebreaker:</strong> {competitionSettings.ranking.tiebreaker}</span>
              <span><strong>Total Contestants:</strong> {segmentContestants.length}</span>
            </div>
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
          <div className="mt-8 signature-section">
            <div className="grid grid-cols-3 gap-6">
              {judges.map((judge, index) => (
                <div key={judge.id} className="text-center">
                  <div className="border-b border-black pt-12"></div>
                  <p className="mt-1">{judge.name} - J{index + 1}</p>
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
            size: A4 landscape;
            margin: 10mm 8mm;
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
            font-size: 9pt;
            table-layout: fixed;
          }
          
          /* Compact styling for many judges */
          .print-table.many-judges {
            font-size: 7pt;
          }
          
          .print-table.many-judges .print-cell {
            padding: 0.8mm 0.5mm;
            font-size: 7pt;
          }
          
          /* Very compact styling for very many judges */
          .print-table.very-many-judges {
            font-size: 6pt;
          }
          
          .print-table.very-many-judges .print-cell {
            padding: 0.5mm 0.3mm;
            font-size: 6pt;
          }
          
          .print-cell {
            border: 0.1mm solid #2c3e50;
            padding: 1.5mm 1mm;
            text-align: center;
            font-size: 9pt;
            vertical-align: middle;
          }
          
          .print-header-row {
            background: linear-gradient(135deg, #34495e 0%, #2c3e50 100%);
            color: white;
            font-weight: bold;
            text-transform: uppercase;
            letter-spacing: 0.2pt;
          }
          
          .print-row:nth-child(even) {
            background-color: #f8f9fa;
          }
          
          .print-row {
            page-break-inside: avoid;
          }
          
          .print-header {
            background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            padding: 15px;
            border-bottom: 2px solid #2c3e50;
            margin-bottom: 20px;
          }
          
          .print-division {
            background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
            color: white;
            font-weight: bold;
            padding: 8px 12px;
            margin-top: 15px;
            text-align: center;
            text-transform: uppercase;
            letter-spacing: 0.3pt;
            border-radius: 4px 4px 0 0;
          }
          
          /* Ensure signature lines print well */
          .border-b {
            border-bottom-width: 1px !important;
            border-bottom-color: black !important;
          }
          
          /* Control page breaks */
          .signature-section {
            page-break-before: auto;
            margin-top: 20px;
            padding-top: 15px;
          }
          
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
