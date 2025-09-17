"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { FileDown, Printer } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { format } from "date-fns"
import { convertScoresToRanks } from "@/utils/rankingUtils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function PrintCriteriaRanking({ segmentId }: { segmentId: string }) {
  const printRef = useRef<HTMLDivElement>(null)
  const [selectedCriterionId, setSelectedCriterionId] = useState<string>("")
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const { competitionSettings, contestants, judges, scores } = useCompetitionStore()

  // Get the selected segment
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
  const segmentName = segment?.name || "Results"

  // Get criteria for this segment
  const criteria = segment?.criteria || []

  // Set first criterion as default if available and none selected
  if (criteria.length > 0 && !selectedCriterionId) {
    setSelectedCriterionId(criteria[0].id)
  }

  // Get the selected criterion
  const selectedCriterion = criteria.find((c) => c.id === selectedCriterionId)

  // Check if we need to separate by gender
  const separateByGender = competitionSettings.separateRankingByGender

  // Get contestants in the selected segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Group contestants by gender if needed
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Handle print action
  const handlePrint = () => {
    if (!selectedCriterionId) return
    window.print()
  }

  // Generate PDF function
  const handleGeneratePDF = async () => {
    if (!selectedCriterionId || !selectedCriterion) return

    setIsGeneratingPDF(true)

    try {
      // Create a new window for the PDF content
      const printWindow = window.open("", "_blank")
      if (!printWindow) {
        alert("Please allow pop-ups to generate the PDF")
        setIsGeneratingPDF(false)
        return
      }

      // Calculate column width for judge columns based on number of judges
      const judgeColWidth = (70 / (judges.length * 2)).toFixed(1)

      // Generate the HTML content for the tables
      const generateTableHTML = () => {
        let tableHTML = ""

        if (separateByGender) {
          if (maleContestants.length > 0) {
            tableHTML += `
              <div class="result-section">
                <div class="division-header">Male Division</div>
                ${generateTableForContestants(maleContestants)}
              </div>
            `
          }

          if (femaleContestants.length > 0) {
            tableHTML += `
              <div class="result-section">
                <div class="division-header">Female Division</div>
                ${generateTableForContestants(femaleContestants)}
              </div>
            `
          }
        } else {
          tableHTML += `
            <div class="result-section">
              ${generateTableForContestants(segmentContestants)}
            </div>
          `
        }

        return tableHTML
      }

      // Generate table for a specific group of contestants
      const generateTableForContestants = (contestantsGroup: typeof segmentContestants) => {
        if (!selectedCriterionId || !selectedCriterion) return ""

        // Get raw scores for the selected criterion for each judge
        const judgeScores: Record<string, Record<string, number>> = {}

        // Initialize judge scores
        judges.forEach((judge) => {
          judgeScores[judge.id] = {}
        })

        // Get raw scores for each contestant from each judge
        contestantsGroup.forEach((contestant) => {
          judges.forEach((judge) => {
            const score = scores[segmentId]?.[contestant.id]?.[judge.id]?.[selectedCriterionId] || 0
            judgeScores[judge.id][contestant.id] = score
          })
        })

        // Convert raw scores to ranks for each judge
        const judgeRanks: Record<string, Record<string, number>> = {}
        judges.forEach((judge) => {
          judgeRanks[judge.id] = convertScoresToRanks(judgeScores[judge.id])
        })

        // Calculate average ranks for each contestant
        const averageRanks: Record<string, number> = {}
        contestantsGroup.forEach((contestant) => {
          let totalRank = 0
          let judgeCount = 0

          judges.forEach((judge) => {
            const rank = judgeRanks[judge.id][contestant.id]
            if (rank) {
              totalRank += rank
              judgeCount++
            }
          })

          averageRanks[contestant.id] = judgeCount > 0 ? totalRank / judgeCount : 999
        })

        // Sort contestants by average rank (lower is better)
        const sortedContestants = [...contestantsGroup].sort((a, b) => {
          const rankA = averageRanks[a.id] || 999
          const rankB = averageRanks[b.id] || 999
          return rankA - rankB
        })

        // Assign final ranks (handling ties)
        const finalRanks: Record<string, number> = {}
        let currentRank = 1
        let previousAvgRank = -1
        let sameRankCount = 0

        sortedContestants.forEach((contestant, index) => {
          const avgRank = averageRanks[contestant.id]

          if (index === 0) {
            // First contestant
            finalRanks[contestant.id] = currentRank
            previousAvgRank = avgRank
            sameRankCount = 1
          } else if (Math.abs(avgRank - previousAvgRank) < 0.001) {
            // Tie with previous contestant
            finalRanks[contestant.id] = currentRank
            sameRankCount++
          } else {
            // New rank
            currentRank += sameRankCount
            finalRanks[contestant.id] = currentRank
            previousAvgRank = avgRank
            sameRankCount = 1
          }
        })

        // Determine if we need compact styling for many judges
        const hasManyJudges = judges.length >= 6
        const tableClass = hasManyJudges ? 'many-judges' : ''
        
        // Generate table HTML
        let tableHTML = `
          <table class="${tableClass}">
            <colgroup>
              <col class="col-rank" style="width: 5%;">
              <col class="col-contestant" style="width: 15%;">
        `

        // Add columns for judge scores
        judges.forEach(() => {
          tableHTML += `<col style="width: ${judgeColWidth}%;">`
        })

        // Add columns for judge ranks
        judges.forEach(() => {
          tableHTML += `<col style="width: ${judgeColWidth}%;">`
        })

        // Add column for average rank
        tableHTML += `
              <col class="col-avg-rank" style="width: 6%;">
            </colgroup>
            <thead>
              <tr>
                <th>Final Rank</th>
                <th>Contestant</th>
        `

        // Add headers for judge scores
        judges.forEach((judge, index) => {
          tableHTML += `
            <th>J${index + 1}<br><span class="small-text">(Score)</span></th>
          `
        })

        // Add headers for judge ranks
        judges.forEach((judge, index) => {
          tableHTML += `
            <th>J${index + 1}<br><span class="small-text">(Rank)</span></th>
          `
        })

        // Add header for average rank
        tableHTML += `
                <th>Average<br><span class="small-text">Rank</span></th>
              </tr>
            </thead>
            <tbody>
        `

        // Add rows for contestants
        if (sortedContestants.length > 0) {
          sortedContestants.forEach((contestant) => {
            tableHTML += `
              <tr>
                <td class="center bold">${finalRanks[contestant.id] || "-"}</td>
                <td>${contestant.name}${contestant.gender ? `<span class="small-text"> (${contestant.gender})</span>` : ""}</td>
            `

            // Add scores from each judge
            judges.forEach((judge) => {
              const score = judgeScores[judge.id][contestant.id] || 0
              tableHTML += `
                <td class="center">${score || "-"}</td>
              `
            })

            // Add ranks from each judge
            judges.forEach((judge) => {
              const rank = judgeRanks[judge.id][contestant.id] || "-"
              tableHTML += `
                <td class="center">${rank}</td>
              `
            })

            // Add average rank
            tableHTML += `
                <td class="center">${averageRanks[contestant.id] < 900 ? averageRanks[contestant.id].toFixed(2) : "-"}</td>
              </tr>
            `
          })
        } else {
          tableHTML += `
            <tr>
              <td colspan="${4 + judges.length * 2}" class="center">No contestants in this category</td>
            </tr>
          `
        }

        tableHTML += `
            </tbody>
          </table>
        `

        return tableHTML
      }

      // Generate signature section HTML
      const generateSignatureHTML = () => {
        let signatureHTML = `
          <div class="signature-section">
            <h3 class="signature-header">Judges' Signatures</h3>
            <div class="signature-grid">
        `

        judges.forEach((judge, index) => {
          signatureHTML += `
            <div class="signature-box">
              <div class="signature-line"></div>
              <p class="signature-name">${judge.name} - J${index + 1}</p>
            </div>
          `
        })

        signatureHTML += `
            </div>
          </div>
        `

        return signatureHTML
      }

      // Write the complete HTML to the new window
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${competitionSettings.name} - ${selectedCriterion.name} Rankings</title>
          <style>
            /* Base styles */
            body {
              font-family: Arial, sans-serif;
              font-size: 8pt;
              line-height: 1.2;
              margin: 0;
              padding: 0;
            }
            
            /* Page setup - Enhanced A4 Landscape */
            @page {
              size: A4 landscape;
              margin: 10mm 8mm;
            }
            
            /* Enhanced header styles */
            .header {
              text-align: center;
              margin-bottom: 4mm;
              padding: 2mm 0;
              border-bottom: 0.3mm solid #333;
              background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%);
            }
            
            .header h1 {
              font-size: 12pt;
              font-weight: bold;
              margin: 0 0 1mm 0;
              color: #2c3e50;
              text-transform: uppercase;
              letter-spacing: 0.5pt;
            }
            
            .header h2 {
              font-size: 10pt;
              margin: 0 0 1mm 0;
              color: #34495e;
              font-weight: 600;
            }
            
            .header h3 {
              font-size: 11pt;
              margin: 0 0 1mm 0;
              color: #e74c3c;
              font-weight: 600;
            }
            
            .header p {
              font-size: 9pt;
              margin: 0;
              color: #7f8c8d;
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
            
            /* Enhanced table styles */
            table {
              width: 100%;
              border-collapse: collapse;
              font-size: 9pt;
              margin-bottom: 4mm;
              table-layout: fixed;
              border: 0.2mm solid #2c3e50;
            }
            
            /* For tables with many judges, make text smaller */
            .many-judges table {
              font-size: 7pt;
            }
            
            .many-judges th, .many-judges td {
              padding: 0.8mm 0.5mm;
              font-size: 7pt;
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
              letter-spacing: 0.2pt;
            }
            
            tbody tr:nth-child(even) {
              background-color: #f8f9fa;
            }
            
            .center {
              text-align: center;
            }
            
            .bold {
              font-weight: bold;
            }
            
            .small-text {
              font-size: 6pt;
            }
            
            /* Section styles */
            .result-section {
              page-break-inside: avoid !important;
              margin-bottom: 5mm;
              display: block;
              width: 100%;
            }
            
            /* Signature section */
            .signature-section {
              page-break-before: always;
              padding-top: 10mm;
            }
            
            .signature-header {
              text-align: center;
              font-size: 10pt;
              margin-bottom: 8mm;
            }
            
            .signature-grid {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 10mm;
            }
            
            .signature-box {
              text-align: center;
            }
            
            .signature-line {
              border-bottom: 0.3mm solid #000;
              height: 15mm;
            }
            
            .signature-name {
              margin-top: 1mm;
              font-size: 8pt;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>${competitionSettings.name}</h1>
            <h2>${segmentName} - Criterion Rankings</h2>
            <h3>${selectedCriterion.name} (${selectedCriterion.maxScore} points)</h3>
            <p>${format(new Date(), "MMMM d, yyyy")}</p>
          </div>
          
          ${generateTableHTML()}
          
          ${generateSignatureHTML()}
        </body>
        </html>
      `)

      // Trigger print and close window after printing
      printWindow.document.close()
      printWindow.focus()

      // Wait for content to load before printing
      setTimeout(() => {
        printWindow.print()
        printWindow.onafterprint = () => printWindow.close()
        setIsGeneratingPDF(false)
      }, 1000)
    } catch (error) {
      console.error("Error generating PDF:", error)
      setIsGeneratingPDF(false)
      alert("An error occurred while generating the PDF")
    }
  }

  // Render the rankings table for a specific group of contestants
  const renderCriteriaRankingsTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    if (!selectedCriterionId || !selectedCriterion) return null

    // Get raw scores for the selected criterion for each judge
    const judgeScores: Record<string, Record<string, number>> = {}

    // Initialize judge scores
    judges.forEach((judge) => {
      judgeScores[judge.id] = {}
    })

    // Get raw scores for each contestant from each judge
    contestantsGroup.forEach((contestant) => {
      judges.forEach((judge) => {
        const score = scores[segmentId]?.[contestant.id]?.[judge.id]?.[selectedCriterionId] || 0
        judgeScores[judge.id][contestant.id] = score
      })
    })

    // Convert raw scores to ranks for each judge
    const judgeRanks: Record<string, Record<string, number>> = {}
    judges.forEach((judge) => {
      judgeRanks[judge.id] = convertScoresToRanks(judgeScores[judge.id])
    })

    // Calculate average ranks for each contestant
    const averageRanks: Record<string, number> = {}
    contestantsGroup.forEach((contestant) => {
      let totalRank = 0
      let judgeCount = 0

      judges.forEach((judge) => {
        const rank = judgeRanks[judge.id][contestant.id]
        if (rank) {
          totalRank += rank
          judgeCount++
        }
      })

      averageRanks[contestant.id] = judgeCount > 0 ? totalRank / judgeCount : 999
    })

    // Sort contestants by average rank (lower is better)
    const sortedContestants = [...contestantsGroup].sort((a, b) => {
      const rankA = averageRanks[a.id] || 999
      const rankB = averageRanks[b.id] || 999
      return rankA - rankB
    })

    // Assign final ranks (handling ties)
    const finalRanks: Record<string, number> = {}
    let currentRank = 1
    let previousAvgRank = -1
    let sameRankCount = 0

    sortedContestants.forEach((contestant, index) => {
      const avgRank = averageRanks[contestant.id]

      if (index === 0) {
        // First contestant
        finalRanks[contestant.id] = currentRank
        previousAvgRank = avgRank
        sameRankCount = 1
      } else if (Math.abs(avgRank - previousAvgRank) < 0.001) {
        // Tie with previous contestant
        finalRanks[contestant.id] = currentRank
        sameRankCount++
      } else {
        // New rank
        currentRank += sameRankCount
        finalRanks[contestant.id] = currentRank
        previousAvgRank = avgRank
        sameRankCount = 1
      }
    })

    // Determine if we need compact styling for many judges
    const hasManyJudges = judges.length >= 6
    
    return (
      <div className="mb-6">
        {groupTitle && (
          <div className="bg-primary/10 px-4 py-2 rounded-t-md print-division">
            <h3 className="text-lg font-semibold">{groupTitle}</h3>
          </div>
        )}

        <table className={`w-full border-collapse print-table ${hasManyJudges ? 'many-judges' : ''}`}>
          <thead>
            <tr className="print-header-row">
              <th className="print-cell text-center">Final Rank</th>
              <th className="print-cell text-center">Contestant</th>
              {judges.map((judge, index) => (
                <th key={`score-${judge.id}`} className="print-cell text-center">
                  J{index + 1}
                  <br />
                  <span className="text-xs">(Score)</span>
                </th>
              ))}
              {judges.map((judge, index) => (
                <th key={`rank-${judge.id}`} className="print-cell text-center">
                  J{index + 1}
                  <br />
                  <span className="text-xs">(Rank)</span>
                </th>
              ))}
              <th className="print-cell text-center">
                Average
                <br />
                <span className="text-xs">Rank</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedContestants.length > 0 ? (
              sortedContestants.map((contestant) => {
                return (
                  <tr key={contestant.id} className="print-row">
                    <td className="print-cell text-center font-bold">{finalRanks[contestant.id] || "-"}</td>
                    <td className="print-cell">
                      {contestant.name}
                      {contestant.gender && <span className="ml-2 text-xs">({contestant.gender})</span>}
                    </td>

                    {/* Scores from each judge */}
                    {judges.map((judge) => {
                      const score = judgeScores[judge.id][contestant.id] || 0
                      return (
                        <td key={`score-${judge.id}`} className="print-cell text-center">
                          {score || "-"}
                        </td>
                      )
                    })}

                    {/* Ranks from each judge */}
                    {judges.map((judge) => {
                      const rank = judgeRanks[judge.id][contestant.id] || "-"
                      return (
                        <td key={`rank-${judge.id}`} className="print-cell text-center">
                          {rank}
                        </td>
                      )
                    })}

                    {/* Average rank */}
                    <td className="print-cell text-center">
                      {averageRanks[contestant.id] < 900 ? averageRanks[contestant.id].toFixed(2) : "-"}
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
    <div className="flex items-center gap-2">
      <Select value={selectedCriterionId} onValueChange={setSelectedCriterionId} disabled={criteria.length === 0}>
        <SelectTrigger className="w-[200px] print:hidden">
          <SelectValue placeholder="Select criterion" />
        </SelectTrigger>
        <SelectContent>
          {criteria.map((criterion) => (
            <SelectItem key={criterion.id} value={criterion.id}>
              {criterion.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button
        onClick={handlePrint}
        className="flex items-center gap-2"
        variant="outline"
        disabled={!selectedCriterionId}
      >
        <Printer className="h-4 w-4" />
        Print (Browser)
      </Button>

      <Button
        onClick={handleGeneratePDF}
        className="flex items-center gap-2"
        variant="default"
        disabled={!selectedCriterionId || isGeneratingPDF}
      >
        {isGeneratingPDF ? (
          <>Generating...</>
        ) : (
          <>
            <FileDown className="h-4 w-4" />
            Generate PDF
          </>
        )}
      </Button>

      {/* Print-only content - hidden on screen but visible when printing */}
      {selectedCriterion && (
        <div ref={printRef} className="hidden print:block">
        <div className="print-container">
          <div className="text-center mb-6 print-header">
            <h1 className="text-2xl font-bold uppercase tracking-wide text-gray-800">{competitionSettings.name}</h1>
            <h2 className="text-xl font-semibold text-gray-700">{segmentName} - Criterion Rankings</h2>
            <h3 className="text-lg font-semibold mt-1 text-red-600">
              {selectedCriterion.name} ({selectedCriterion.maxScore} points)
            </h3>
            <p className="text-sm text-gray-600">{format(new Date(), "MMMM d, yyyy")}</p>
          </div>

            {/* Results Tables */}
            {separateByGender ? (
              <div className="space-y-4">
                {maleContestants.length > 0 && renderCriteriaRankingsTable(maleContestants, "Male Division")}
                {femaleContestants.length > 0 && renderCriteriaRankingsTable(femaleContestants, "Female Division")}
              </div>
            ) : (
              renderCriteriaRankingsTable(segmentContestants)
            )}

            {/* Signature Section */}
            <div className="mt-8 signature-section">
              <h3 className="text-center font-bold mb-6">Judges' Signatures</h3>
              <div className="grid grid-cols-3 gap-6">
                {judges.map((judge, index) => (
                  <div key={judge.id} className="text-center">
                    <div className="border-b border-black pt-12"></div>
                    <p className="mt-1">{judge.name} - J{index + 1}</p>
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
      )}

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
    </div>
  )
}
