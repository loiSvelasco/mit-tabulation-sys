"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import {
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Loader2,
  UserIcon as Male,
  UserIcon as Female,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { usePolling } from "@/hooks/usePolling"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

export default function MonitorScoring() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeSegmentId, setActiveSegmentId] = useState<string>("")
  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)

  // Get store data and methods
  const { competitionSettings, contestants, judges, scores, activeCriteria, loadCompetition, selectedCompetitionId } =
    useCompetitionStore()

  // Use polling for real-time updates
  const { isPolling, lastUpdate, error, refresh, startPolling, stopPolling } = usePolling(competitionId, 5000)

  // Initialize the component
  const initialize = useCallback(async () => {
    if (isInitialized) return

    try {
      setIsLoading(true)

      // Find the active competition
      const competitionsResponse = await fetch("/api/competitions")
      if (!competitionsResponse.ok) {
        throw new Error("Failed to fetch competitions")
      }

      const competitions = await competitionsResponse.json()
      const activeCompetition = competitions.find((comp: any) => comp.is_active)

      if (!activeCompetition) {
        if (competitions.length > 0) {
          const firstCompId = competitions[0].id
          setCompetitionId(firstCompId)

          // Set it as active
          await fetch(`/api/competitions/${firstCompId}/set-active`, {
            method: "POST",
          })

          await loadCompetition(firstCompId)
        } else {
          throw new Error("No competitions found. Please create a competition first.")
        }
      } else {
        setCompetitionId(activeCompetition.id)
        await loadCompetition(activeCompetition.id)
      }

      setIsInitialized(true)
      setIsLoading(false)
    } catch (error) {
      console.error("Error initializing monitor:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setInitError(errorMessage)
      setIsLoading(false)
      toast.error(`Failed to initialize: ${errorMessage}`)
    }
  }, [isInitialized, loadCompetition])

  // Update active segment when active criteria change
  useEffect(() => {
    if (!isInitialized || !competitionSettings) return

    // Find segment with most active criteria
    const criteriaBySegment = new Map<string, number>()
    activeCriteria.forEach((ac) => {
      const count = criteriaBySegment.get(ac.segmentId) || 0
      criteriaBySegment.set(ac.segmentId, count + 1)
    })

    const segmentsWithActiveCriteria = Array.from(criteriaBySegment.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0])

    if (segmentsWithActiveCriteria.length > 0) {
      const newActiveSegmentId = segmentsWithActiveCriteria[0]
      if (newActiveSegmentId !== activeSegmentId) {
        setActiveSegmentId(newActiveSegmentId)
      }
    } else if (competitionSettings?.segments?.length > 0) {
      const firstSegmentId = competitionSettings.segments[0].id
      if (firstSegmentId !== activeSegmentId) {
        setActiveSegmentId(firstSegmentId)
      }
    }
  }, [activeCriteria, competitionSettings, activeSegmentId, isInitialized])

  // Initialize and start polling
  useEffect(() => {
    if (!isInitialized) {
      initialize()
    }

    if (isInitialized && competitionId) {
      startPolling()
    }

    return () => {
      stopPolling()
    }
  }, [initialize, startPolling, stopPolling, isInitialized, competitionId])

  // Manual refresh
  const handleManualRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      if (competitionId) {
        await loadCompetition(competitionId)
      }
      await refresh()
      toast.success("Data refreshed successfully")
    } catch (error) {
      console.error("Error refreshing:", error)
      toast.error("Failed to refresh data")
    } finally {
      setTimeout(() => setIsRefreshing(false), 500)
    }
  }

  // Retry initialization
  const handleRetry = () => {
    setIsLoading(true)
    setInitError(null)
    setIsInitialized(false)
    initialize()
  }

  // Get the active segment
  const activeSegment = useMemo(
    () => competitionSettings?.segments?.find((s) => s.id === activeSegmentId),
    [competitionSettings?.segments, activeSegmentId],
  )

  // Get active criteria for the segment
  const segmentActiveCriteria = useMemo(
    () => activeCriteria.filter((ac) => ac.segmentId === activeSegmentId),
    [activeCriteria, activeSegmentId],
  )

  // Get contestants in the segment
  const segmentContestants = useMemo(
    () => contestants.filter((c) => c.currentSegmentId === activeSegmentId),
    [contestants, activeSegmentId],
  )

  // Get male and female contestants
  const maleContestants = useMemo(
    () => contestants.filter((c) => c.currentSegmentId === activeSegmentId && c.gender?.toLowerCase() === "male"),
    [contestants, activeSegmentId],
  )

  const femaleContestants = useMemo(
    () => contestants.filter((c) => c.currentSegmentId === activeSegmentId && c.gender?.toLowerCase() === "female"),
    [contestants, activeSegmentId],
  )

  // Get criteria details
  const activeCriteriaDetails = useMemo(
    () =>
      segmentActiveCriteria.map((ac) => {
        const segment = competitionSettings.segments.find((s) => s.id === ac.segmentId)
        const criterion = segment?.criteria.find((c) => c.id === ac.criterionId)
        return {
          ...ac,
          name: criterion?.name || "Unknown Criterion",
          maxScore: criterion?.maxScore || 0,
          isPrejudged: criterion?.isPrejudged || false,
          isCarryForward: criterion?.isCarryForward || false,
        }
      }),
    [segmentActiveCriteria, competitionSettings?.segments],
  )

  // Check if a score exists
  const hasScore = useCallback(
    (contestantId: string, judgeId: string, criterionId: string) => {
      return !!scores[activeSegmentId]?.[contestantId]?.[judgeId]?.[criterionId]
    },
    [scores, activeSegmentId],
  )

  // Calculate judge completion
  const calculateJudgeCompletion = useCallback(
    (judgeId: string, contestantsList = segmentContestants) => {
      if (contestantsList.length === 0 || segmentActiveCriteria.length === 0) return 0

      let scoredCount = 0
      let totalPossible = 0

      contestantsList.forEach((contestant) => {
        segmentActiveCriteria.forEach((ac) => {
          const criterion = activeSegment?.criteria.find((c) => c.id === ac.criterionId)
          if (criterion?.isPrejudged || criterion?.isCarryForward) return

          totalPossible++
          if (hasScore(contestant.id, judgeId, ac.criterionId)) {
            scoredCount++
          }
        })
      })

      return totalPossible > 0 ? Math.round((scoredCount / totalPossible) * 100) : 0
    },
    [segmentContestants, segmentActiveCriteria, activeSegment, hasScore],
  )

  // Calculate contestant completion
  const calculateContestantCompletion = useCallback(
    (contestantId: string) => {
      if (judges.length === 0 || segmentActiveCriteria.length === 0) return 0

      let scoredCount = 0
      let totalPossible = 0

      judges.forEach((judge) => {
        segmentActiveCriteria.forEach((ac) => {
          const criterion = activeSegment?.criteria.find((c) => c.id === ac.criterionId)
          if (criterion?.isPrejudged || criterion?.isCarryForward) return

          totalPossible++
          if (hasScore(contestantId, judge.id, ac.criterionId)) {
            scoredCount++
          }
        })
      })

      return totalPossible > 0 ? Math.round((scoredCount / totalPossible) * 100) : 0
    },
    [judges, segmentActiveCriteria, activeSegment, hasScore],
  )

  // Calculate overall completion
  const calculateOverallCompletion = useCallback(
    (contestantsList = segmentContestants) => {
      if (judges.length === 0 || contestantsList.length === 0 || segmentActiveCriteria.length === 0) return 0

      let scoredCount = 0
      let totalPossible = 0

      contestantsList.forEach((contestant) => {
        judges.forEach((judge) => {
          segmentActiveCriteria.forEach((ac) => {
            const criterion = activeSegment?.criteria.find((c) => c.id === ac.criterionId)
            if (criterion?.isPrejudged || criterion?.isCarryForward) return

            totalPossible++
            if (hasScore(contestant.id, judge.id, ac.criterionId)) {
              scoredCount++
            }
          })
        })
      })

      return totalPossible > 0 ? Math.round((scoredCount / totalPossible) * 100) : 0
    },
    [judges, segmentContestants, segmentActiveCriteria, activeSegment, hasScore],
  )

  // Get score status
  const getScoreStatus = useCallback(
    (contestantId: string, judgeId: string, criterionId: string) => {
      const criterion = activeSegment?.criteria.find((c) => c.id === criterionId)

      if (criterion?.isPrejudged) {
        return { status: "prejudged", label: "Prejudged" }
      }

      if (criterion?.isCarryForward) {
        return { status: "carry-forward", label: "Carry Forward" }
      }

      if (hasScore(contestantId, judgeId, criterionId)) {
        return { status: "scored", label: "Scored" }
      }

      return { status: "pending", label: "Pending" }
    },
    [activeSegment, hasScore],
  )

  // Sort contestants and judges
  const sortedContestants = useMemo(
    () =>
      [...segmentContestants].sort((a, b) => {
        return calculateContestantCompletion(b.id) - calculateContestantCompletion(a.id)
      }),
    [segmentContestants, calculateContestantCompletion],
  )

  const sortedMaleContestants = useMemo(
    () =>
      [...maleContestants].sort((a, b) => {
        return calculateContestantCompletion(b.id) - calculateContestantCompletion(a.id)
      }),
    [maleContestants, calculateContestantCompletion],
  )

  const sortedFemaleContestants = useMemo(
    () =>
      [...femaleContestants].sort((a, b) => {
        return calculateContestantCompletion(b.id) - calculateContestantCompletion(a.id)
      }),
    [femaleContestants, calculateContestantCompletion],
  )

  const sortedJudges = useMemo(
    () =>
      [...judges].sort((a, b) => {
        return calculateJudgeCompletion(b.id) - calculateJudgeCompletion(a.id)
      }),
    [judges, calculateJudgeCompletion],
  )

  // Render scoring table
  const renderScoringTable = useCallback(
    (contestants: typeof segmentContestants, title?: string) => {
      return (
        <div className={title ? "mt-6" : ""}>
          {title && (
            <div className="bg-primary/10 px-4 py-2 rounded-t-md mb-2">
              <h3 className="text-lg font-semibold">{title}</h3>
            </div>
          )}
          <div className="overflow-x-auto max-h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px] sticky left-0 bg-white z-10">Contestant</TableHead>
                  {sortedJudges.map((judge) => (
                    <TableHead key={judge.id} className="text-center">
                      {judge.name}
                      <div className="text-xs text-muted-foreground mt-1">
                        {calculateJudgeCompletion(judge.id, contestants)}%
                      </div>
                    </TableHead>
                  ))}
                  <TableHead className="text-center w-[80px] sticky right-0 bg-white z-10">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contestants.length > 0 ? (
                  contestants.map((contestant) => (
                    <TableRow key={contestant.id}>
                      <TableCell className="font-medium sticky left-0 bg-white z-10">{contestant.name}</TableCell>

                      {sortedJudges.map((judge) => {
                        let scoredCount = 0
                        let totalCount = 0
                        let hasPrejudged = false
                        let hasCarryForward = false

                        segmentActiveCriteria.forEach((ac) => {
                          const criterion = activeSegment?.criteria.find((c) => c.id === ac.criterionId)

                          if (criterion?.isPrejudged) {
                            hasPrejudged = true
                            return
                          }

                          if (criterion?.isCarryForward) {
                            hasCarryForward = true
                            return
                          }

                          totalCount++
                          if (hasScore(contestant.id, judge.id, ac.criterionId)) {
                            scoredCount++
                          }
                        })

                        const completion = totalCount > 0 ? Math.round((scoredCount / totalCount) * 100) : 0

                        return (
                          <TableCell key={judge.id} className="text-center">
                            <div className="flex flex-col items-center">
                              {completion === 100 ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : completion > 0 ? (
                                <Clock className="h-5 w-5 text-amber-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="text-xs mt-1">
                                {scoredCount}/{totalCount}
                                {hasPrejudged && " +P"}
                                {hasCarryForward && " +CF"}
                              </span>
                            </div>
                          </TableCell>
                        )
                      })}

                      <TableCell className="text-center sticky right-0 bg-white z-10">
                        <div className="flex items-center justify-center">
                          <div className="w-12 bg-muted rounded-full h-2 mr-2">
                            <div
                              className={`h-2 rounded-full ${
                                calculateContestantCompletion(contestant.id) === 100
                                  ? "bg-green-500"
                                  : calculateContestantCompletion(contestant.id) > 50
                                    ? "bg-amber-500"
                                    : "bg-red-500"
                              }`}
                              style={{ width: `${calculateContestantCompletion(contestant.id)}%` }}
                            ></div>
                          </div>
                          <span className="text-xs font-medium">{calculateContestantCompletion(contestant.id)}%</span>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
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
    },
    [
      sortedJudges,
      segmentActiveCriteria,
      activeSegment,
      hasScore,
      calculateJudgeCompletion,
      calculateContestantCompletion,
    ],
  )

  // Render criteria table
  const renderCriteriaTable = useCallback(
    (criterion: any, contestants: typeof segmentContestants) => {
      return (
        <div className="overflow-x-auto max-h-[400px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px] sticky left-0 bg-white z-10">Contestant</TableHead>
                {sortedJudges.map((judge) => (
                  <TableHead key={judge.id} className="text-center">
                    {judge.name}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {contestants.length > 0 ? (
                contestants.map((contestant) => (
                  <TableRow key={contestant.id}>
                    <TableCell className="font-medium sticky left-0 bg-white z-10">{contestant.name}</TableCell>

                    {sortedJudges.map((judge) => {
                      const status = getScoreStatus(contestant.id, judge.id, criterion.criterionId)
                      const score = scores[activeSegmentId]?.[contestant.id]?.[judge.id]?.[criterion.criterionId]

                      return (
                        <TableCell key={judge.id} className="text-center">
                          {status.status === "scored" ? (
                            <div className="flex flex-col items-center">
                              <CheckCircle className="h-5 w-5 text-green-500" />
                              <span className="text-xs mt-1 font-medium">{score?.toFixed(2)}</span>
                            </div>
                          ) : status.status === "prejudged" ? (
                            <div className="flex flex-col items-center">
                              <Badge variant="secondary" className="text-xs">
                                Prejudged
                              </Badge>
                              {score !== undefined && (
                                <span className="text-xs mt-1 font-medium">{score.toFixed(2)}</span>
                              )}
                            </div>
                          ) : status.status === "carry-forward" ? (
                            <div className="flex flex-col items-center">
                              <Badge variant="outline" className="text-xs border-amber-500 text-amber-600">
                                Carry Forward
                              </Badge>
                              {score !== undefined && (
                                <span className="text-xs mt-1 font-medium">{score.toFixed(2)}</span>
                              )}
                            </div>
                          ) : (
                            <XCircle className="h-5 w-5 text-red-500 mx-auto" />
                          )}
                        </TableCell>
                      )
                    })}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={judges.length + 1} className="text-center py-4 text-muted-foreground">
                    No contestants in this category
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )
    },
    [sortedJudges, activeSegmentId, scores, getScoreStatus],
  )

  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Loading scoring monitor...</p>
      </div>
    )
  }

  // Error state
  if (initError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle className="text-red-500">Error Loading Monitor</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-4">{initError}</p>
            <div className="flex gap-2">
              <Button onClick={handleRetry}>Retry</Button>
              <Button variant="outline" onClick={() => router.push("/dashboard")}>
                Go to Dashboard
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold">{competitionSettings?.name || "Competition"}</h1>
          {activeSegment && (
            <p className="text-muted-foreground">
              Segment: <span className="font-medium">{activeSegment.name}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${isPolling ? "bg-green-500" : "bg-red-500"}`}></div>
          <span className="text-sm text-muted-foreground">
            {isPolling ? "Auto-refresh active" : "Auto-refresh inactive"}
          </span>
          {lastUpdate && (
            <Badge variant="outline" className="ml-2">
              Last update: {lastUpdate.toLocaleTimeString()}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={handleManualRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh Now
          </Button>
        </div>
      </div>

      {/* Active Criteria and Progress */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Active Criteria</CardTitle>
            <CardDescription>Currently active criteria for {activeSegment?.name || "this segment"}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {activeCriteriaDetails.length > 0 ? (
                activeCriteriaDetails.map((criterion) => (
                  <Badge
                    key={criterion.criterionId}
                    variant={criterion.isPrejudged ? "secondary" : criterion.isCarryForward ? "outline" : "default"}
                    className={criterion.isCarryForward ? "border-amber-500 text-amber-600" : ""}
                  >
                    {criterion.name} ({criterion.maxScore} pts)
                    {criterion.isPrejudged && " - Prejudged"}
                    {criterion.isCarryForward && " - Carry Forward"}
                  </Badge>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No active criteria for this segment</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Scoring Progress</CardTitle>
            <CardDescription>Overall completion: {calculateOverallCompletion()}%</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="w-full bg-muted rounded-full h-4 mb-4">
              <div
                className="bg-green-500 h-4 rounded-full"
                style={{ width: `${calculateOverallCompletion()}%` }}
              ></div>
            </div>

            {competitionSettings?.separateRankingByGender && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Male className="h-4 w-4 mr-1" /> Male ({maleContestants.length})
                  </h3>
                  <div className="w-full bg-muted rounded-full h-3 mb-1">
                    <div
                      className="bg-blue-500 h-3 rounded-full"
                      style={{ width: `${calculateOverallCompletion(maleContestants)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {calculateOverallCompletion(maleContestants)}% complete
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Female className="h-4 w-4 mr-1" /> Female ({femaleContestants.length})
                  </h3>
                  <div className="w-full bg-muted rounded-full h-3 mb-1">
                    <div
                      className="bg-pink-500 h-3 rounded-full"
                      style={{ width: `${calculateOverallCompletion(femaleContestants)}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {calculateOverallCompletion(femaleContestants)}% complete
                  </span>
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-medium mb-2">Judges Completion</h3>
              <div className="space-y-2">
                {sortedJudges.map((judge) => {
                  const completion = calculateJudgeCompletion(judge.id)
                  return (
                    <div key={judge.id} className="flex items-center">
                      <span className="text-sm w-32 truncate">{judge.name}</span>
                      <div className="flex-1 mx-2">
                        <div className="w-full bg-muted rounded-full h-2">
                          <div
                            className={`h-2 rounded-full ${
                              completion === 100 ? "bg-green-500" : completion > 50 ? "bg-amber-500" : "bg-red-500"
                            }`}
                            style={{ width: `${completion}%` }}
                          ></div>
                        </div>
                      </div>
                      <span className="text-xs font-medium">{completion}%</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Scoring Status */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Scoring Status</CardTitle>
          <CardDescription>Detailed view of scoring status</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="overview">
            <TabsList className="mb-4 w-full">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              {activeCriteriaDetails.length > 0 && <TabsTrigger value="criteria">By Criteria</TabsTrigger>}
            </TabsList>

            <TabsContent value="overview">
              {competitionSettings?.separateRankingByGender ? (
                <div className="space-y-6">
                  {maleContestants.length > 0 && renderScoringTable(sortedMaleContestants, "Male Division")}
                  {femaleContestants.length > 0 && renderScoringTable(sortedFemaleContestants, "Female Division")}
                  {segmentContestants.length === 0 && (
                    <div className="text-center py-8 text-muted-foreground">
                      <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                      <p>No contestants in this segment</p>
                    </div>
                  )}
                </div>
              ) : (
                renderScoringTable(sortedContestants)
              )}
            </TabsContent>

            <TabsContent value="criteria">
              {activeCriteriaDetails.length > 0 ? (
                <Tabs defaultValue={activeCriteriaDetails[0].criterionId}>
                  <TabsList className="mb-4">
                    {activeCriteriaDetails.map((criterion) => (
                      <TabsTrigger key={criterion.criterionId} value={criterion.criterionId}>
                        {criterion.name}
                      </TabsTrigger>
                    ))}
                  </TabsList>

                  {activeCriteriaDetails.map((criterion) => (
                    <TabsContent key={criterion.criterionId} value={criterion.criterionId}>
                      {competitionSettings?.separateRankingByGender ? (
                        <div className="space-y-6">
                          {maleContestants.length > 0 && (
                            <div>
                              <div className="bg-primary/10 px-4 py-2 rounded-t-md mb-2">
                                <h3 className="text-lg font-semibold">Male Division</h3>
                              </div>
                              {renderCriteriaTable(criterion, sortedMaleContestants)}
                            </div>
                          )}
                          {femaleContestants.length > 0 && (
                            <div className="mt-6">
                              <div className="bg-primary/10 px-4 py-2 rounded-t-md mb-2">
                                <h3 className="text-lg font-semibold">Female Division</h3>
                              </div>
                              {renderCriteriaTable(criterion, sortedFemaleContestants)}
                            </div>
                          )}
                        </div>
                      ) : (
                        renderCriteriaTable(criterion, sortedContestants)
                      )}
                    </TabsContent>
                  ))}
                </Tabs>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No active criteria to display</p>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {activeCriteriaDetails.length === 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-center">
                <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">No Active Criteria</h3>
                <p className="text-sm text-muted-foreground max-w-md">
                  There are currently no active criteria to monitor. Please activate criteria in the competition
                  settings to see the scoring status.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
