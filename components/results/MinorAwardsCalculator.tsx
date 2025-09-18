"use client"

import React, { useState, useMemo, useRef } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Trophy, Check, ArrowUpDown, Medal, Star, FileSpreadsheet } from "lucide-react"
import { toast } from "sonner"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

interface CriterionOption {
  id: string
  name: string
  segmentId: string
  segmentName: string
  maxScore: number
}

interface CriterionAverage {
  criterionId: string
  criterionName: string
  average: number
  maxScore: number
  percentage: number
  rank?: number // Rank within this criterion
}

interface MinorAwardResult {
  contestantId: string
  contestantName: string
  gender: "Male" | "Female"
  averageScore: number
  percentageScore: number
  totalPoints: number
  rank: number
  criteriaAverages: Record<string, CriterionAverage> // Store averages by criterion ID
  judgeScores: Record<string, Record<string, number>> // Store individual judge scores by criterion ID and judge ID
}

export function MinorAwardsCalculator() {
  const [awardName, setAwardName] = useState("")
  const [selectedCriteria, setSelectedCriteria] = useState<string[]>([])
  const [results, setResults] = useState<MinorAwardResult[]>([])
  const [maleResults, setMaleResults] = useState<MinorAwardResult[]>([])
  const [femaleResults, setFemaleResults] = useState<MinorAwardResult[]>([])
  const [sortField, setSortField] = useState<"rank" | "averageScore" | "percentageScore" | "totalPoints" | string>(
    "rank",
  )
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc")
  const [copied, setCopied] = useState(false)
  const resultsRef = useRef<HTMLDivElement>(null)

  const { competitionSettings, contestants, judges, scores } = useCompetitionStore()
  const { separateRankingByGender } = competitionSettings

  // Get all criteria from all segments
  const criteriaOptions = useMemo(() => {
    const options: CriterionOption[] = []

    competitionSettings.segments.forEach((segment) => {
      segment.criteria.forEach((criterion) => {
        options.push({
          id: criterion.id,
          name: criterion.name,
          segmentId: segment.id,
          segmentName: segment.name,
          maxScore: criterion.maxScore,
        })
      })
    })

    return options
  }, [competitionSettings.segments])

  // Selected criteria details
  const selectedCriteriaDetails = useMemo(() => {
    return criteriaOptions.filter((c) => selectedCriteria.includes(c.id))
  }, [criteriaOptions, selectedCriteria])

  // Group criteria by segment for display
  const criteriaBySegment = useMemo(() => {
    const grouped: Record<string, { segmentName: string; criteria: CriterionOption[] }> = {}

    criteriaOptions.forEach((criterion) => {
      if (!grouped[criterion.segmentId]) {
        grouped[criterion.segmentId] = {
          segmentName: criterion.segmentName,
          criteria: [],
        }
      }

      grouped[criterion.segmentId].criteria.push(criterion)
    })

    return grouped
  }, [criteriaOptions])

  // Handle checkbox change
  const handleCriterionToggle = (criterionId: string) => {
    setSelectedCriteria((prev) => {
      if (prev.includes(criterionId)) {
        return prev.filter((id) => id !== criterionId)
      } else {
        return [...prev, criterionId]
      }
    })
  }

  // Calculate Excel-style RANK.AVG() for an array of values
  const calculateRankAvg = (items: { id: string; value: number }[]): Record<string, number> => {
    // Sort items by value in descending order
    const sortedItems = [...items].sort((a, b) => b.value - a.value)

    const ranks: Record<string, number> = {}
    let currentRank = 1

    // Process items one by one
    for (let i = 0; i < sortedItems.length; i++) {
      // Find all items with the same value
      const currentValue = sortedItems[i].value
      let sameValueCount = 1

      // Count how many items have the same value
      while (i + sameValueCount < sortedItems.length && sortedItems[i + sameValueCount].value === currentValue) {
        sameValueCount++
      }

      // Calculate average rank for tied items
      if (sameValueCount > 1) {
        // For ties, use average of ranks
        const avgRank = (currentRank + (currentRank + sameValueCount - 1)) / 2

        // Assign the same average rank to all tied items
        for (let j = 0; j < sameValueCount; j++) {
          ranks[sortedItems[i + j].id] = avgRank
        }

        // Skip the items we've already processed
        i += sameValueCount - 1
        currentRank += sameValueCount
      } else {
        // No tie, assign the current rank
        ranks[sortedItems[i].id] = currentRank
        currentRank++
      }
    }

    return ranks
  }

  // Calculate rankings based on selected criteria
  const calculateRankings = () => {
    if (selectedCriteria.length === 0) {
      toast.error("No criteria selected", {
        description: "Please select at least one criterion to calculate rankings.",
      })
      return
    }

    if (!awardName) {
      toast.error("No award name", {
        description: "Please enter a name for this award.",
      })
      return
    }

    // Calculate total max score
    const totalMaxScore = selectedCriteriaDetails.reduce((sum, c) => sum + c.maxScore, 0)

    // Store all contestant scores with criteria breakdowns
    const contestantScores: Record<
      string,
      {
        totalScore: number
        totalPoints: number
        count: number
        contestantName: string
        gender: "Male" | "Female"
        criteriaAverages: Record<string, CriterionAverage>
      }
    > = {}

    // For each selected criterion
    selectedCriteriaDetails.forEach((criterion) => {
      const { segmentId, id: criterionId, name: criterionName, maxScore } = criterion

      // Get all contestants who have scores for this criterion
      const segmentScores = scores[segmentId] || {}

      // For ranking within each criterion
      const criterionContestantScores: { id: string; value: number }[] = []

      Object.keys(segmentScores).forEach((contestantId) => {
        const contestantData = contestants.find((c) => c.id === contestantId)
        if (!contestantData) return

        const contestantScoresForSegment = segmentScores[contestantId] || {}
        let criterionTotal = 0
        let judgeCount = 0

        // Calculate average score for this criterion across all judges
        const judgeScoresForCriterion: Record<string, number> = {}
        Object.keys(contestantScoresForSegment).forEach((judgeId) => {
          const judgeScores = contestantScoresForSegment[judgeId] || {}
          const score = judgeScores[criterionId]

          if (score !== undefined) {
            judgeScoresForCriterion[judgeId] = score
            criterionTotal += score
            judgeCount++
          }
        })

        if (judgeCount > 0) {
          // Initialize contestant in the scores object if needed
          if (!contestantScores[contestantId]) {
            contestantScores[contestantId] = {
              totalScore: 0,
              totalPoints: 0,
              count: 0,
              contestantName: contestantData.name,
              gender: contestantData.gender,
              criteriaAverages: {},
              judgeScores: {},
            }
          }

          // Calculate average for this criterion
          const criterionAverage = criterionTotal / judgeCount

          // Add to criterion-specific tracking for ranking
          criterionContestantScores.push({
            id: contestantId,
            value: criterionAverage,
          })

          // Store the criterion average
          contestantScores[contestantId].criteriaAverages[criterionId] = {
            criterionId,
            criterionName,
            average: criterionAverage,
            maxScore,
            percentage: (criterionAverage / maxScore) * 100,
          }

          // Store individual judge scores for this criterion
          contestantScores[contestantId].judgeScores[criterionId] = judgeScoresForCriterion

          // Add this criterion's average to the contestant's total
          contestantScores[contestantId].totalScore += criterionAverage
          contestantScores[contestantId].totalPoints += criterionAverage
          contestantScores[contestantId].count++
        }
      })

      // Calculate ranks within this criterion using RANK.AVG()
      const criterionRanks = calculateRankAvg(criterionContestantScores)

      // Assign ranks to criteria averages
      Object.keys(criterionRanks).forEach((contestantId) => {
        if (contestantScores[contestantId]?.criteriaAverages[criterionId]) {
          contestantScores[contestantId].criteriaAverages[criterionId].rank = criterionRanks[contestantId]
        }
      })
    })

    // Calculate final average and percentage for each contestant
    const calculatedResults: MinorAwardResult[] = []

    Object.keys(contestantScores).forEach((contestantId) => {
      const { totalScore, totalPoints, count, contestantName, gender, criteriaAverages, judgeScores } =
        contestantScores[contestantId]

      // Only include contestants who have scores for all selected criteria
      if (count === selectedCriteriaDetails.length) {
        // Calculate literal sum of all judge scores across all criteria
        let literalTotal = 0
        selectedCriteriaDetails.forEach((criterion) => {
          const criterionJudgeScores = judgeScores[criterion.id] || {}
          Object.values(criterionJudgeScores).forEach((score) => {
            literalTotal += score
          })
        })

        const averageScore = literalTotal / (count * (judges?.length || 1))
        const percentageScore = (literalTotal / (totalMaxScore * (judges?.length || 1))) * 100

        calculatedResults.push({
          contestantId,
          contestantName,
          gender,
          averageScore,
          percentageScore,
          totalPoints: literalTotal, // Use literal sum instead of average-based total
          rank: 0, // Will be set after sorting
          criteriaAverages,
          judgeScores,
        })
      }
    })

    // Calculate overall ranks using RANK.AVG()
    const overallRanks = calculateRankAvg(
      calculatedResults.map((result) => ({
        id: result.contestantId,
        value: result.averageScore,
      })),
    )

    // Assign ranks to results
    calculatedResults.forEach((result) => {
      result.rank = overallRanks[result.contestantId]
    })

    // If gender separation is enabled, create separate rankings for males and females
    if (separateRankingByGender) {
      const maleContestants = calculatedResults.filter((r) => r.gender === "Male")
      const femaleContestants = calculatedResults.filter((r) => r.gender === "Female")

      // Calculate gender-specific ranks using RANK.AVG()
      const maleRanks = calculateRankAvg(
        maleContestants.map((result) => ({
          id: result.contestantId,
          value: result.averageScore,
        })),
      )

      const femaleRanks = calculateRankAvg(
        femaleContestants.map((result) => ({
          id: result.contestantId,
          value: result.averageScore,
        })),
      )

      // Assign ranks to gender-specific results
      maleContestants.forEach((result) => {
        result.rank = maleRanks[result.contestantId]
      })

      femaleContestants.forEach((result) => {
        result.rank = femaleRanks[result.contestantId]
      })

      setMaleResults(maleContestants)
      setFemaleResults(femaleContestants)
    }

    setResults(calculatedResults)
    setCopied(false)

    toast.success("Rankings calculated", {
      description: `${calculatedResults.length} contestants ranked for ${awardName}`,
    })
  }

  // Handle sorting
  const handleSort = (field: "rank" | "averageScore" | "percentageScore" | "totalPoints" | string) => {
    if (sortField === field) {
      // Toggle direction if same field
      setSortDirection(sortDirection === "asc" ? "desc" : "asc")
    } else {
      // Set new field and default direction
      setSortField(field)
      setSortDirection(field === "rank" ? "asc" : "desc")
    }
  }

  // Sort results based on current sort settings
  const sortedResults = useMemo(() => {
    const sorted = [...results]

    sorted.sort((a, b) => {
      let comparison = 0

      if (sortField === "rank") {
        comparison = a.rank - b.rank
      } else if (sortField === "averageScore") {
        comparison = a.averageScore - b.averageScore
      } else if (sortField === "percentageScore") {
        comparison = a.percentageScore - b.percentageScore
      } else if (sortField === "totalPoints") {
        comparison = a.totalPoints - b.totalPoints
      } else if (sortField.startsWith("criterion_")) {
        // Sort by specific criterion
        const criterionId = sortField.replace("criterion_", "")
        const aValue = a.criteriaAverages[criterionId]?.average || 0
        const bValue = b.criteriaAverages[criterionId]?.average || 0
        comparison = aValue - bValue
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [results, sortField, sortDirection])

  // Sort gender-specific results
  const sortedMaleResults = useMemo(() => {
    const sorted = [...maleResults]

    sorted.sort((a, b) => {
      let comparison = 0

      if (sortField === "rank") {
        comparison = a.rank - b.rank
      } else if (sortField === "averageScore") {
        comparison = a.averageScore - b.averageScore
      } else if (sortField === "percentageScore") {
        comparison = a.percentageScore - b.percentageScore
      } else if (sortField === "totalPoints") {
        comparison = a.totalPoints - b.totalPoints
      } else if (sortField.startsWith("criterion_")) {
        // Sort by specific criterion
        const criterionId = sortField.replace("criterion_", "")
        const aValue = a.criteriaAverages[criterionId]?.average || 0
        const bValue = b.criteriaAverages[criterionId]?.average || 0
        comparison = aValue - bValue
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [maleResults, sortField, sortDirection])

  const sortedFemaleResults = useMemo(() => {
    const sorted = [...femaleResults]

    sorted.sort((a, b) => {
      let comparison = 0

      if (sortField === "rank") {
        comparison = a.rank - b.rank
      } else if (sortField === "averageScore") {
        comparison = a.averageScore - b.averageScore
      } else if (sortField === "percentageScore") {
        comparison = a.percentageScore - b.percentageScore
      } else if (sortField === "totalPoints") {
        comparison = a.totalPoints - b.totalPoints
      } else if (sortField.startsWith("criterion_")) {
        // Sort by specific criterion
        const criterionId = sortField.replace("criterion_", "")
        const aValue = a.criteriaAverages[criterionId]?.average || 0
        const bValue = b.criteriaAverages[criterionId]?.average || 0
        comparison = aValue - bValue
      }

      return sortDirection === "asc" ? comparison : -comparison
    })

    return sorted
  }, [femaleResults, sortField, sortDirection])

  // Generate TSV (Tab-Separated Values) for Excel compatibility
  const generateTSV = (resultsToExport: MinorAwardResult[]): string => {
    // Create headers
    const headers = [
      "Rank",
      "Contestant",
      ...selectedCriteriaDetails.map((c) => c.name),
      "Total Points",
      "Average Score",
      "Percentage",
    ]

    // Create rows
    const rows = resultsToExport.map((result) => [
      result.rank.toString(),
      result.contestantName,
      ...selectedCriteriaDetails.map((criterion) => {
        const score = result.criteriaAverages[criterion.id]?.average
        return score !== undefined ? score.toFixed(2) : "N/A"
      }),
      result.totalPoints.toFixed(2),
      result.averageScore.toFixed(2),
      result.percentageScore.toFixed(2) + "%",
    ])

    // Combine headers and rows
    const tsvContent = [
      // Add award name as title
      [`${awardName}${separateRankingByGender ? ` (${resultsToExport[0]?.gender || "All"})` : ""}`],
      // Add empty row
      [""],
      // Add headers
      headers,
      // Add data rows
      ...rows,
    ]
      .map((row) => row.join("\t"))
      .join("\n")

    return tsvContent
  }

  // Copy results to clipboard as TSV
  const copyToClipboard = () => {
    try {
      let tsvContent: string

      if (separateRankingByGender) {
        // Generate separate TSV for each gender with a divider between them
        const femaleTSV = generateTSV(sortedFemaleResults)
        const maleTSV = generateTSV(sortedMaleResults)
        tsvContent = `${femaleTSV}\n\n${maleTSV}`
      } else {
        tsvContent = generateTSV(sortedResults)
      }

      // Use the Clipboard API if available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(tsvContent).then(() => {
          setCopied(true)
          toast.success("Copied to clipboard", {
            description: "Results copied in spreadsheet-compatible format.",
          })
          setTimeout(() => setCopied(false), 2000)
        })
      } else {
        // Fallback for browsers that don't support the Clipboard API
        const textArea = document.createElement("textarea")
        textArea.value = tsvContent
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand("copy")
        document.body.removeChild(textArea)

        setCopied(true)
        toast.success("Copied to clipboard", {
          description: "Results copied in spreadsheet-compatible format.",
        })
        setTimeout(() => setCopied(false), 2000)
      }
    } catch (err) {
      console.error("Failed to copy:", err)
      toast.error("Copy failed", {
        description: "Could not copy results to clipboard.",
      })
    }
  }

  // Render the results table with individual judge scores
  const renderResultsTable = (resultsToRender: MinorAwardResult[]) => {
    // Get all judges for column headers
    const allJudges = judges || []
    
    return (
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[60px] sticky left-0 bg-background z-10">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center p-0 h-auto font-medium"
                  onClick={() => handleSort("rank")}
                >
                  Rank
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
              <TableHead className="min-w-[200px] sticky left-[60px] bg-background z-10">Contestant</TableHead>

              {/* Individual Criteria with Judge Columns */}
              {selectedCriteriaDetails.map((criterion) => (
                <React.Fragment key={criterion.id}>
                  {/* Judge columns for this criterion */}
                  {allJudges.map((judge, index) => (
                    <TableHead key={`${criterion.id}-${judge.id}`} className="text-center min-w-[60px]">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="text-xs font-medium">
                              J{index + 1}
                            </div>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>{judge.name}</p>
                            <p className="text-xs text-muted-foreground">{criterion.name}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableHead>
                  ))}
                  
                </React.Fragment>
              ))}

              {/* Overall Total Column */}
              <TableHead className="text-center min-w-[80px] bg-blue-50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center p-0 h-auto font-medium"
                  onClick={() => handleSort("totalPoints")}
                >
                  Overall Total
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>

              {/* Overall Average Column */}
              <TableHead className="text-center min-w-[80px] bg-green-50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center p-0 h-auto font-medium"
                  onClick={() => handleSort("averageScore")}
                >
                  Avg
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>

              {/* Overall Percentage Column */}
              <TableHead className="text-center min-w-[80px] bg-purple-50">
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center p-0 h-auto font-medium"
                  onClick={() => handleSort("percentageScore")}
                >
                  %
                  <ArrowUpDown className="ml-1 h-3 w-3" />
                </Button>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {resultsToRender.map((result) => (
              <TableRow key={result.contestantId}>
                <TableCell className="font-medium sticky left-0 bg-background z-10">
                  {result.rank <= 3 ? (
                    <div className="flex items-center">
                      {result.rank === 1 && <Medal className="h-4 w-4 text-yellow-500 mr-1" />}
                      {result.rank === 2 && <Medal className="h-4 w-4 text-gray-400 mr-1" />}
                      {result.rank === 3 && <Medal className="h-4 w-4 text-amber-700 mr-1" />}
                      {result.rank}
                    </div>
                  ) : (
                    result.rank
                  )}
                </TableCell>
                <TableCell className="sticky left-[60px] bg-background z-10 font-medium">
                  {result.contestantName}
                </TableCell>

                {/* Individual Criteria with Judge Scores */}
                {selectedCriteriaDetails.map((criterion) => {
                  const criterionJudgeScores = result.judgeScores[criterion.id] || {}
                  const criterionScore = result.criteriaAverages[criterion.id]
                  const isTopScore = criterionScore?.rank === 1

                  return (
                    <React.Fragment key={criterion.id}>
                      {/* Individual judge scores for this criterion */}
                      {allJudges.map((judge) => {
                        const judgeScore = criterionJudgeScores[judge.id]
                        return (
                          <TableCell key={`${criterion.id}-${judge.id}`} className="text-center text-sm">
                            {judgeScore !== undefined ? (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span>
                                      {judgeScore.toFixed(2)}
                                    </span>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{judge.name}</p>
                                    <p>{criterion.name}</p>
                                    <p>Score: {judgeScore.toFixed(2)} / {criterion.maxScore}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            ) : (
                              <span className="text-gray-400">-</span>
                            )}
                          </TableCell>
                        )
                      })}
                      
                    </React.Fragment>
                  )
                })}

                {/* Overall Total */}
                <TableCell className="text-center font-medium bg-blue-50">
                  {result.totalPoints.toFixed(2)}
                </TableCell>

                {/* Overall Average */}
                <TableCell className="text-center bg-green-50">
                  {result.averageScore.toFixed(2)}
                </TableCell>

                {/* Overall Percentage */}
                <TableCell className="text-center bg-purple-50">
                  <Badge variant="outline" className="font-normal">
                    {result.percentageScore.toFixed(1)}%
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center">
          <Trophy className="mr-2 h-5 w-5" />
          Minor Awards Calculator
        </CardTitle>
        <CardDescription>Calculate special awards based on specific criteria across segments</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          {/* Award Name Input */}
          <div className="space-y-2">
            <Label htmlFor="award-name">Award Name</Label>
            <Input
              id="award-name"
              placeholder="e.g., Best in Swimsuit"
              value={awardName}
              onChange={(e) => setAwardName(e.target.value)}
            />
          </div>

          {/* Criteria Selection */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium">Select Criteria</h3>
            <ScrollArea className="h-[300px] rounded-md border p-4">
              {Object.keys(criteriaBySegment).map((segmentId) => {
                const { segmentName, criteria } = criteriaBySegment[segmentId]
                return (
                  <div key={segmentId} className="mb-6">
                    <h4 className="text-md font-medium mb-2">{segmentName}</h4>
                    <div className="space-y-2 ml-4">
                      {criteria.map((criterion) => (
                        <div key={criterion.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={criterion.id}
                            checked={selectedCriteria.includes(criterion.id)}
                            onCheckedChange={() => handleCriterionToggle(criterion.id)}
                          />
                          <Label htmlFor={criterion.id} className="cursor-pointer">
                            {criterion.name} ({criterion.maxScore} points)
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </ScrollArea>
          </div>

          {/* Calculate Button */}
          <Button onClick={calculateRankings} className="w-full">
            Calculate Rankings
          </Button>

          {/* Results */}
          {results.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-medium">Results: {awardName}</h3>
                <Button variant="outline" size="sm" onClick={copyToClipboard} className="flex items-center">
                  {copied ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Copied
                    </>
                  ) : (
                    <>
                      <FileSpreadsheet className="mr-2 h-4 w-4" />
                      Copy for Spreadsheet
                    </>
                  )}
                </Button>
              </div>

              <div ref={resultsRef}>
                {separateRankingByGender ? (
                  <Tabs defaultValue="female">
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="female">Female</TabsTrigger>
                      <TabsTrigger value="male">Male</TabsTrigger>
                    </TabsList>
                    <TabsContent value="female">{renderResultsTable(sortedFemaleResults)}</TabsContent>
                    <TabsContent value="male">{renderResultsTable(sortedMaleResults)}</TabsContent>
                  </Tabs>
                ) : (
                  renderResultsTable(sortedResults)
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default MinorAwardsCalculator
