"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Copy, ClipboardCheck } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { roundToTwoDecimals } from "@/utils/rankingUtils"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export function CriteriaAverageScores() {
  const [selectedCriterionKey, setSelectedCriterionKey] = useState<string>("")
  const [copied, setCopied] = useState(false)
  const [sheetOpen, setSheetOpen] = useState(false)
  const { competitionSettings, contestants, judges, scores } = useCompetitionStore()

  // Parse the selected criterion key to get segment and criterion IDs
  const [segmentId, criterionId] = selectedCriterionKey.split("|")

  // Get the selected segment and criterion
  const segment = competitionSettings.segments.find((s) => s.id === segmentId)
  const selectedCriterion = segment?.criteria.find((c) => c.id === criterionId)

  // Check if we need to separate by gender
  const separateByGender = competitionSettings.separateRankingByGender

  // Get contestants in the selected segment
  const segmentContestants = segmentId ? contestants.filter((c) => c.currentSegmentId === segmentId) : []

  // Group contestants by gender if needed
  const maleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "male")
  const femaleContestants = segmentContestants.filter((c) => c.gender?.toLowerCase() === "female")

  // Get scores and calculate averages for a group of contestants
  const getContestantScores = (contestantsGroup: typeof segmentContestants) => {
    if (!segmentId || !criterionId || !selectedCriterion) return []

    // Calculate scores for each contestant
    const contestantScores = contestantsGroup.map((contestant) => {
      // Get raw scores from each judge
      const judgeScores: Record<string, number> = {}
      let totalScore = 0
      let judgeCount = 0

      judges.forEach((judge) => {
        const score = scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterionId] || 0
        judgeScores[judge.id] = score

        if (score > 0) {
          totalScore += score
          judgeCount++
        }
      })

      const averageScore = judgeCount > 0 ? roundToTwoDecimals(totalScore / judgeCount) : 0

      return {
        contestantId: contestant.id,
        name: contestant.name,
        judgeScores,
        averageScore,
      }
    })

    return contestantScores
  }

  // Generate TSV data (tab-separated values) for copying to spreadsheet
  const generateTSV = (contestantsGroup: typeof segmentContestants, includeHeader = true) => {
    if (!selectedCriterion || !segment) return ""

    const contestantScores = getContestantScores(contestantsGroup)

    let tsv = ""

    // Add header row if requested
    if (includeHeader) {
      tsv += `Contestant\t`

      // Add judge names as headers
      judges.forEach((judge) => {
        tsv += `${judge.name}\t`
      })

      tsv += `Average Score (${segment.name} - ${selectedCriterion.name})\n`
    }

    // Add data rows
    contestantScores.forEach((row) => {
      tsv += `${row.name}\t`

      // Add scores from each judge
      judges.forEach((judge) => {
        tsv += `${row.judgeScores[judge.id] || 0}\t`
      })

      tsv += `${row.averageScore}\n`
    })

    return tsv
  }

  // Handle copy to clipboard
  const handleCopy = () => {
    if (!selectedCriterion || !segment) return

    let content = ""

    if (separateByGender) {
      // If separating by gender, include headers for each section
      if (maleContestants.length > 0) {
        content += "Male Division\n"
        content += generateTSV(maleContestants)
        content += "\n"
      }

      if (femaleContestants.length > 0) {
        content += "Female Division\n"
        content += generateTSV(femaleContestants)
      }
    } else {
      // Otherwise just generate for all contestants
      content = generateTSV(segmentContestants)
    }

    // Copy to clipboard
    navigator.clipboard.writeText(content).then(
      () => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      },
      (err) => {
        console.error("Could not copy text: ", err)
      },
    )
  }

  // Render the scores table for a specific group of contestants
  const renderScoresTable = (contestantsGroup: typeof segmentContestants, groupTitle?: string) => {
    if (!segmentId || !criterionId || !selectedCriterion || !segment) return null

    const contestantScores = getContestantScores(contestantsGroup)

    return (
      <div className="mb-3">
        {groupTitle && (
          <div className="bg-primary/10 px-2 py-1 rounded-t-md text-xs font-medium">
            <h3 className="text-sm font-semibold">{groupTitle}</h3>
          </div>
        )}

        <div className="overflow-x-auto max-w-full">
          <table className="w-full border-collapse table-fixed text-xs leading-tight">
            <colgroup>
              <col style={{ width: "140px" }} />
              {judges.map(() => (
                <col key={`col-${Math.random()}`} style={{ width: "60px" }} />
              ))}
              <col style={{ width: "70px" }} />
            </colgroup>
            <thead>
              <tr className="bg-muted/50">
                <th className="border border-gray-300 px-1 py-1 text-left font-medium">Contestant</th>
                {judges.map((judge) => (
                  <th
                    key={judge.id}
                    className="border border-gray-300 px-1 py-1 text-center whitespace-nowrap overflow-hidden text-ellipsis font-medium"
                    title={judge.name}
                  >
                    {judge.name.length > 8 ? `${judge.name.substring(0, 7)}…` : judge.name}
                  </th>
                ))}
                <th className="border border-gray-300 px-1 py-1 text-center bg-muted font-medium">Avg</th>
              </tr>
            </thead>
            <tbody>
              {contestantScores.length > 0 ? (
                contestantScores.map((row) => (
                  <tr key={row.contestantId} className="hover:bg-muted/20">
                    <td className="border border-gray-300 px-1 py-0.5 truncate" title={row.name}>
                      {row.name}
                    </td>
                    {judges.map((judge) => (
                      <td
                        key={`${row.contestantId}-${judge.id}`}
                        className="border border-gray-300 px-1 py-0.5 text-center"
                      >
                        {row.judgeScores[judge.id] || "-"}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-1 py-0.5 text-center font-medium bg-muted/30">
                      {row.averageScore || "-"}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={2 + judges.length} className="border border-gray-300 px-2 py-2 text-center">
                    No contestants
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={selectedCriterionKey}
        onValueChange={setSelectedCriterionKey}
        disabled={competitionSettings.segments.length === 0}
      >
        <SelectTrigger className="w-[280px]">
          <SelectValue placeholder="Select criterion" />
        </SelectTrigger>
        <SelectContent>
          {competitionSettings.segments.map((segment) => (
            <SelectGroup key={segment.id}>
              <SelectLabel>{segment.name}</SelectLabel>
              {segment.criteria.map((criterion) => (
                <SelectItem key={`${segment.id}|${criterion.id}`} value={`${segment.id}|${criterion.id}`}>
                  {criterion.name} ({criterion.maxScore} pts)
                </SelectItem>
              ))}
            </SelectGroup>
          ))}
        </SelectContent>
      </Select>

      <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
        <SheetTrigger asChild>
          <Button
            variant="default"
            className="flex items-center gap-2"
            disabled={!selectedCriterionKey || !segmentId || !criterionId}
          >
            <Copy className="h-4 w-4" />
            View Scores
          </Button>
        </SheetTrigger>
        <SheetContent
          side="right"
          className="w-full sm:max-w-xl md:max-w-2xl lg:max-w-4xl overflow-y-auto"
          // Fix for layout shift - ensure the sheet is properly positioned
          style={{ position: "fixed", top: 0, bottom: 0, right: 0 }}
        >
          <SheetHeader className="flex flex-row items-center justify-between mb-4">
            <SheetTitle className="text-base">
              {segment?.name} - {selectedCriterion?.name} Scores
            </SheetTitle>
            <Button onClick={handleCopy} variant="outline" size="sm" className="flex items-center gap-1 h-8 px-2">
              {copied ? <ClipboardCheck className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {copied ? "Copied!" : "Copy"}
            </Button>
          </SheetHeader>

          <div className="space-y-4">
            {/* Preview Tables */}
            <div className="border rounded-md p-2 overflow-hidden">
              {separateByGender ? (
                <div className="space-y-3">
                  {maleContestants.length > 0 && renderScoresTable(maleContestants, "Male Division")}
                  {femaleContestants.length > 0 && renderScoresTable(femaleContestants, "Female Division")}
                </div>
              ) : (
                renderScoresTable(segmentContestants)
              )}
            </div>

            {/* Raw Data Preview */}
            <div>
              <h3 className="text-xs font-medium mb-1">Data Preview</h3>
              <div className="border rounded-md p-2 max-h-[20vh] overflow-y-auto font-mono text-[10px] leading-tight whitespace-pre bg-muted/30">
                {separateByGender ? (
                  <>
                    {maleContestants.length > 0 && (
                      <>
                        <div className="font-bold">Male Division</div>
                        <pre>{generateTSV(maleContestants)}</pre>
                        <br />
                      </>
                    )}
                    {femaleContestants.length > 0 && (
                      <>
                        <div className="font-bold">Female Division</div>
                        <pre>{generateTSV(femaleContestants)}</pre>
                      </>
                    )}
                  </>
                ) : (
                  <pre>{generateTSV(segmentContestants)}</pre>
                )}
              </div>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
