"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
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
import { useOptimizedPolling } from "@/hooks/useOptimizedPolling"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { getBestCompetitionId, saveCompetitionSelection, setActiveCompetition } from "@/lib/competition-selection"

export default function MonitorScoring() {
  const router = useRouter()
  const [forceUpdate, setForceUpdate] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [activeSegmentId, setActiveSegmentId] = useState<string>("")
  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [initError, setInitError] = useState<string | null>(null)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isInitializing, setIsInitializing] = useState(false)

  // Get store data and methods
  const store = useCompetitionStore()
  const { competitionSettings, contestants, judges, scores, activeCriteria, loadCompetition, selectedCompetitionId } =
    store

  // Debug state to help troubleshoot
  const [debug, setDebug] = useState({
    activeCriteriaCount: 0,
    activeCriteriaList: [] as string[],
    storeState: {} as any,
    initStatus: "pending" as "pending" | "loading" | "success" | "error",
    initMessage: "",
  })

  // Add a ref to track previous active criteria for comparison
  const previousActiveCriteriaRef = useRef<string>("")

  // Use optimized polling for real-time updates (3 second interval with change detection)
  const { isPolling, lastUpdate, error, hasChanges, refresh, startPolling, stopPolling } = useOptimizedPolling(competitionId, 3000)

  // Initialize the component - load the best competition
  const initialize = useCallback(async () => {
    // Skip if already initialized
    if (isInitialized) return

    setIsInitializing(true)

    try {
      setDebug((prev) => ({ ...prev, initStatus: "loading", initMessage: "Finding best competition..." }))

      // Use unified competition selection logic
      const bestCompetitionId = await getBestCompetitionId()

      if (!bestCompetitionId) {
        throw new Error("No competitions found. Please create a competition first.")
      }

      setCompetitionId(bestCompetitionId)
      setDebug((prev) => ({
        ...prev,
        initMessage: `Using competition ID: ${bestCompetitionId}`,
      }))

      // Save the selection with context
      saveCompetitionSelection(bestCompetitionId, 'monitor-scoring')

      // Set it as active in the database
      await setActiveCompetition(bestCompetitionId)

      // Load the competition
      await loadCompetition(bestCompetitionId)

      // Update debug info
      setDebug((prev) => ({
        ...prev,
        initStatus: "success",
        initMessage: `Competition loaded successfully. ID: ${competitionId || selectedCompetitionId}`,
        storeState: {
          hasCompetitionSettings: !!competitionSettings,
          segmentsCount: competitionSettings?.segments?.length || 0,
          contestantsCount: contestants?.length || 0,
          judgesCount: judges?.length || 0,
          hasScores: Object.keys(scores || {}).length > 0,
          selectedCompetitionId,
          activeCriteriaCount: activeCriteria.length,
        },
      }))

      // Mark as initialized to prevent re-initialization
      setIsInitialized(true)
      setIsLoading(false)
    } catch (error) {
      console.error("Error initializing monitor:", error)
      const errorMessage = error instanceof Error ? error.message : "Unknown error"
      setInitError(errorMessage)
      setDebug((prev) => ({
        ...prev,
        initStatus: "error",
        initMessage: `Error: ${errorMessage}`,
      }))
      setIsLoading(false)
      toast.error(`Failed to initialize: ${errorMessage}`)
    } finally {
      setIsInitializing(false)
    }
  }, [
    isInitialized,
    competitionId,
    selectedCompetitionId,
    loadCompetition,
    competitionSettings,
    contestants,
    judges,
    scores,
    activeCriteria,
  ])

  // Replace the updateActiveSegments function with this improved version
  const updateActiveSegments = useCallback(() => {
    // Skip if not initialized or no competition settings
    if (!isInitialized || !competitionSettings) return

    console.log("Running updateActiveSegments with active criteria:", activeCriteria)

    // Create a string representation of current active criteria for comparison
    const activeCriteriaString = JSON.stringify(activeCriteria.map((ac) => `${ac.segmentId}-${ac.criterionId}`).sort())

    // Check if active criteria have changed
    const hasChanged = previousActiveCriteriaRef.current !== activeCriteriaString

    // Always update active segment selection, even if criteria haven't changed
    // This ensures we're always showing the correct segment

    // Create a map of segment IDs to number of active criteria
    const criteriaBySegment = new Map<string, number>()
    activeCriteria.forEach((ac) => {
      const count = criteriaBySegment.get(ac.segmentId) || 0
      criteriaBySegment.set(ac.segmentId, count + 1)
    })

    // Sort segments by number of active criteria (descending)
    const segmentsWithActiveCriteria = Array.from(criteriaBySegment.entries())
      .sort((a, b) => b[1] - a[1])
      .map((entry) => entry[0])

    console.log("Segments with active criteria:", segmentsWithActiveCriteria)

    if (segmentsWithActiveCriteria.length > 0) {
      const newActiveSegmentId = segmentsWithActiveCriteria[0]
      if (newActiveSegmentId !== activeSegmentId) {
        console.log(`Changing active segment from ${activeSegmentId} to ${newActiveSegmentId}`)
        setActiveSegmentId(newActiveSegmentId)
      }
    } else if (competitionSettings?.segments?.length > 0) {
      // Fallback to first segment if no active criteria
      const firstSegmentId = competitionSettings.segments[0].id
      if (firstSegmentId !== activeSegmentId) {
        console.log(`No active criteria, falling back to first segment: ${firstSegmentId}`)
        setActiveSegmentId(firstSegmentId)
      }
    }

    // Create a list of active criteria for debug display
    const criteriaList = activeCriteria.map((ac) => `${ac.segmentId}-${ac.criterionId}`)

    // Update debug info
    setDebug((prev) => ({
      ...prev,
      activeCriteriaCount: activeCriteria.length,
      activeCriteriaList: criteriaList,
      storeState: {
        hasCompetitionSettings: !!competitionSettings,
        segmentsCount: competitionSettings?.segments?.length || 0,
        contestantsCount: contestants?.length || 0,
        judgesCount: judges?.length || 0,
        hasScores: Object.keys(scores || {}).length > 0,
        selectedCompetitionId,
        activeCriteriaCount: activeCriteria.length,
      },
    }))

    // Update the ref with current active criteria
    previousActiveCriteriaRef.current = activeCriteriaString

    // Force a refresh to get the latest scores if criteria have changed
    if (hasChanged && !isInitializing) {
      console.log("Active criteria changed, forcing refresh")
      refresh().catch((error) => {
        console.error("Error refreshing after criteria change:", error)
      })
    }
  }, [
    activeCriteria,
    competitionSettings,
    contestants,
    judges,
    scores,
    selectedCompetitionId,
    isInitializing,
    refresh,
    activeSegmentId,
    isInitialized,
  ])

  // Add this new function to directly fetch active criteria from the API
  const fetchActiveCriteria = useCallback(async () => {
    if (!competitionId) return

    try {
      console.log("Directly fetching active criteria from API")
      const response = await fetch(`/api/competitions/${competitionId}/data`)

      if (!response.ok) {
        console.error("Failed to fetch competition data")
        return
      }

      const data = await response.json()

      if (data.activeCriteria) {
        console.log("API returned active criteria:", data.activeCriteria)

        // Compare with current active criteria
        const apiCriteriaString = JSON.stringify(
          data.activeCriteria.map((ac: any) => `${ac.segmentId}-${ac.criterionId}`).sort(),
        )

        const currentCriteriaString = JSON.stringify(
          activeCriteria.map((ac) => `${ac.segmentId}-${ac.criterionId}`).sort(),
        )

        if (apiCriteriaString !== currentCriteriaString) {
          console.log("API has different active criteria than current state!")
          await loadCompetition(competitionId)
          setForceUpdate((prev) => prev + 1)
        }
      }
    } catch (error) {
      console.error("Error fetching active criteria:", error)
    }
  }, [competitionId, activeCriteria, loadCompetition])

  // Replace the entire useEffect that sets up polling with this more aggressive version
  useEffect(() => {
    console.log("Initial setup for monitor - with enhanced detection")

    if (!isInitialized) {
      initialize()
    }

    // Start polling only after initialization
    if (isInitialized && competitionId) {
      startPolling()
    }

    // Set up a direct API polling for active criteria
    const activeCriteriaPollingInterval = setInterval(async () => {
      if (!competitionId || !isInitialized) return

      try {
        // Directly fetch competition data from API to get latest active criteria
        const response = await fetch(`/api/competitions/${competitionId}/data`)
        if (!response.ok) {
          console.error("Failed to fetch competition data for active criteria check")
          return
        }

        const data = await response.json()

        if (data.activeCriteria) {
          // Create a string representation of fetched active criteria
          const fetchedActiveCriteriaString = JSON.stringify(
            data.activeCriteria.map((ac: any) => `${ac.segmentId}-${ac.criterionId}`).sort(),
          )

          // Create a string representation of current active criteria
          const currentActiveCriteriaString = JSON.stringify(
            activeCriteria.map((ac) => `${ac.segmentId}-${ac.criterionId}`).sort(),
          )

          // Compare with current active criteria
          if (fetchedActiveCriteriaString !== currentActiveCriteriaString) {
            console.log("API polling detected active criteria change!")
            console.log("Current:", currentActiveCriteriaString)
            console.log("Fetched:", fetchedActiveCriteriaString)

            // Force a complete reload of the competition to get the latest data
            await loadCompetition(competitionId)

            // Force update to trigger the updateActiveSegments function
            setForceUpdate((prev) => prev + 1)
          }
        }
      } catch (error) {
        console.error("Error in active criteria polling:", error)
      }
    }, 5000) // Check every 5 seconds

    // Set up a subscription to the store with more detailed logging
    const unsubscribe = useCompetitionStore.subscribe(
      (state) => state.activeCriteria,
      (newActiveCriteria, previousActiveCriteria) => {
        console.log("Store subscription detected potential change in activeCriteria")
        console.log("New active criteria count:", newActiveCriteria.length)
        console.log("Previous active criteria count:", previousActiveCriteria?.length || 0)

        // Create string representations for comparison
        const newString = JSON.stringify(newActiveCriteria.map((ac) => `${ac.segmentId}-${ac.criterionId}`).sort())
        const prevString = previousActiveCriteria
          ? JSON.stringify(previousActiveCriteria.map((ac) => `${ac.segmentId}-${ac.criterionId}`).sort())
          : ""

        if (newString !== prevString) {
          console.log("CONFIRMED: Active criteria have changed!")
          // Force update to trigger the updateActiveSegments function
          setForceUpdate((prev) => prev + 1)
        }
      },
    )

    // Set up a more frequent check for active criteria changes
    const activeCriteriaCheckInterval = setInterval(() => {
      // Create a string representation of current active criteria
      const activeCriteriaString = JSON.stringify(
        activeCriteria.map((ac) => `${ac.segmentId}-${ac.criterionId}`).sort(),
      )

      // Check if active criteria have changed
      if (previousActiveCriteriaRef.current !== activeCriteriaString) {
        console.log("Interval check detected active criteria change!")
        console.log("Previous:", previousActiveCriteriaRef.current)
        console.log("Current:", activeCriteriaString)
        setForceUpdate((prev) => prev + 1)
      }
    }, 2000) // Check every 2 seconds

    return () => {
      stopPolling()
      unsubscribe()
      clearInterval(activeCriteriaCheckInterval)
      clearInterval(activeCriteriaPollingInterval)
    }
  }, [initialize, startPolling, stopPolling, isInitialized, competitionId, activeCriteria, loadCompetition])

  // Update when store data changes
  useEffect(() => {
    if (isInitialized && !isLoading) {
      console.log("Store data changed, updating active segments")
      updateActiveSegments()
    }
  }, [forceUpdate, updateActiveSegments, isLoading, isInitialized])

  // Add a more aggressive refresh approach in the manual refresh function
  const handleManualRefresh = async () => {
    if (isRefreshing) return

    setIsRefreshing(true)
    try {
      // First, directly fetch active criteria
      await fetchActiveCriteria()

      // Then reload the competition to get fresh data
      if (competitionId) {
        await loadCompetition(competitionId)
      }

      // Then do the regular refresh
      await refresh()

      // Force update after refresh
      setForceUpdate((prev) => prev + 1)

      // Update active segments
      updateActiveSegments()

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

  // Memoize these calculations to prevent unnecessary re-renders
  const segmentActiveCriteria = useMemo(
    () => activeCriteria.filter((ac) => ac.segmentId === activeSegmentId),
    [activeCriteria, activeSegmentId],
  )

  // Get all contestants in the segment
  const segmentContestants = useMemo(
    () => contestants.filter((c) => c.currentSegmentId === activeSegmentId),
    [contestants, activeSegmentId],
  )

  // Get male and female contestants separately for gender-specific views
  const maleContestants = useMemo(
    () => contestants.filter((c) => c.currentSegmentId === activeSegmentId && c.gender?.toLowerCase() === "male"),
    [contestants, activeSegmentId],
  )

  const femaleContestants = useMemo(
    () => contestants.filter((c) => c.currentSegmentId === activeSegmentId && c.gender?.toLowerCase() === "female"),
    [contestants, activeSegmentId],
  )

  // Get criteria details for active criteria
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

  // Check if a score exists for a contestant, judge, and criterion
  const hasScore = useCallback(
    (contestantId: string, judgeId: string, criterionId: string) => {
      return !!scores[activeSegmentId]?.[contestantId]?.[judgeId]?.[criterionId]
    },
    [scores, activeSegmentId],
  )

  // Calculate completion percentage for a judge
  const calculateJudgeCompletion = useCallback(
    (judgeId: string, contestantsList = segmentContestants) => {
      if (contestantsList.length === 0 || segmentActiveCriteria.length === 0) return 0

      let scoredCount = 0
      let totalPossible = 0

      contestantsList.forEach((contestant) => {
        segmentActiveCriteria.forEach((ac) => {
          // Skip prejudged or carry-forward criteria when calculating judge completion
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

  // Calculate completion percentage for a contestant
  const calculateContestantCompletion = useCallback(
    (contestantId: string) => {
      if (judges.length === 0 || segmentActiveCriteria.length === 0) return 0

      let scoredCount = 0
      let totalPossible = 0

      judges.forEach((judge) => {
        segmentActiveCriteria.forEach((ac) => {
          // Skip prejudged or carry-forward criteria when calculating contestant completion
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

  // Calculate overall completion percentage
  const calculateOverallCompletion = useCallback(
    (contestantsList = segmentContestants) => {
      if (judges.length === 0 || contestantsList.length === 0 || segmentActiveCriteria.length === 0) return 0

      let scoredCount = 0
      let totalPossible = 0

      contestantsList.forEach((contestant) => {
        judges.forEach((judge) => {
          segmentActiveCriteria.forEach((ac) => {
            // Skip prejudged or carry-forward criteria when calculating overall completion
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

  // Calculate male contestants completion
  const calculateMaleCompletion = useCallback(() => {
    return calculateOverallCompletion(maleContestants)
  }, [calculateOverallCompletion, maleContestants])

  // Calculate female contestants completion
  const calculateFemaleCompletion = useCallback(() => {
    return calculateOverallCompletion(femaleContestants)
  }, [calculateOverallCompletion, femaleContestants])

  // Get status for a specific contestant, judge, and criterion
  const getScoreStatus = useCallback(
    (contestantId: string, judgeId: string, criterionId: string) => {
      const criterion = activeSegment?.criteria.find((c) => c.id === criterionId)

      // Handle prejudged criteria
      if (criterion?.isPrejudged) {
        return { status: "prejudged", label: "Prejudged" }
      }

      // Handle carry-forward criteria
      if (criterion?.isCarryForward) {
        return { status: "carry-forward", label: "Carry Forward" }
      }

      // Check if score exists
      if (hasScore(contestantId, judgeId, criterionId)) {
        return { status: "scored", label: "Scored" }
      }

      return { status: "pending", label: "Pending" }
    },
    [activeSegment, hasScore],
  )

  // Sort contestants by completion percentage (descending)
  const sortedContestants = useMemo(
    () =>
      [...segmentContestants].sort((a, b) => {
        return calculateContestantCompletion(b.id) - calculateContestantCompletion(a.id)
      }),
    [segmentContestants, calculateContestantCompletion],
  )

  // Sort male contestants by completion percentage
  const sortedMaleContestants = useMemo(
    () =>
      [...maleContestants].sort((a, b) => {
        return calculateContestantCompletion(b.id) - calculateContestantCompletion(a.id)
      }),
    [maleContestants, calculateContestantCompletion],
  )

  // Sort female contestants by completion percentage
  const sortedFemaleContestants = useMemo(
    () =>
      [...femaleContestants].sort((a, b) => {
        return calculateContestantCompletion(b.id) - calculateContestantCompletion(a.id)
      }),
    [femaleContestants, calculateContestantCompletion],
  )

  // Sort judges by completion percentage (descending)
  const sortedJudges = useMemo(
    () =>
      [...judges].sort((a, b) => {
        return calculateJudgeCompletion(b.id) - calculateJudgeCompletion(a.id)
      }),
    [judges, calculateJudgeCompletion],
  )

  // Create a reusable function to render the scoring table for a group of contestants
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
                        // Count scores for this contestant/judge combination
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

  // Create a reusable function to render the criteria-specific table
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
              <Button variant="outline" onClick={() => router.push("/admin/competition")}>
                Go to Competitions
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Render the scoring monitor with gender separation if enabled
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
          {/* <Button size="sm" variant="outline" onClick={isPolling ? stopPolling : startPolling}>
            {isPolling ? "Pause Updates" : "Resume Updates"}
          </Button>
          <Button size="sm" variant="outline" onClick={handleManualRefresh} disabled={isRefreshing}>
            <RefreshCw className={`h-4 w-4 mr-1 ${isRefreshing ? "animate-spin" : ""}`} />
            Refresh Now
          </Button> */}
        </div>
      </div>

      {/* Top row: Active Criteria and Scoring Progress side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Active Criteria Summary */}
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

        {/* Completion Summary */}
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

            {/* Show gender-specific progress if separate ranking by gender is enabled */}
            {competitionSettings?.separateRankingByGender && (
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Male className="h-4 w-4 mr-1" /> Male ({maleContestants.length})
                  </h3>
                  <div className="w-full bg-muted rounded-full h-3 mb-1">
                    <div
                      className="bg-blue-500 h-3 rounded-full"
                      style={{ width: `${calculateMaleCompletion()}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">{calculateMaleCompletion()}% complete</span>
                </div>
                <div>
                  <h3 className="text-sm font-medium mb-2 flex items-center">
                    <Female className="h-4 w-4 mr-1" /> Female ({femaleContestants.length})
                  </h3>
                  <div className="w-full bg-muted rounded-full h-3 mb-1">
                    <div
                      className="bg-pink-500 h-3 rounded-full"
                      style={{ width: `${calculateFemaleCompletion()}%` }}
                    ></div>
                  </div>
                  <span className="text-xs text-muted-foreground">{calculateFemaleCompletion()}% complete</span>
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

      {/* Bottom row: Full-width Scoring Status */}
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

            {/* Overview Tab - Shows all criteria status */}
            <TabsContent value="overview">
              {competitionSettings?.separateRankingByGender ? (
                <div className="space-y-6">
                  {/* Male contestants table */}
                  {maleContestants.length > 0 && renderScoringTable(sortedMaleContestants, "Male Division")}

                  {/* Female contestants table */}
                  {femaleContestants.length > 0 && renderScoringTable(sortedFemaleContestants, "Female Division")}

                  {/* No contestants message */}
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

            {/* Criteria Tab - Shows status by criteria */}
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
                          {/* Male contestants criteria table */}
                          {maleContestants.length > 0 && (
                            <div>
                              <div className="bg-primary/10 px-4 py-2 rounded-t-md mb-2">
                                <h3 className="text-lg font-semibold">Male Division</h3>
                              </div>
                              {renderCriteriaTable(criterion, sortedMaleContestants)}
                            </div>
                          )}

                          {/* Female contestants criteria table */}
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

                      {/* Legend */}
                      <div className="flex items-center gap-4 mt-4 text-xs text-muted-foreground">
                        <div className="flex items-center">
                          <CheckCircle className="h-4 w-4 text-green-500 mr-1" />
                          <span>Scored</span>
                        </div>
                        <div className="flex items-center">
                          <XCircle className="h-4 w-4 text-red-500 mr-1" />
                          <span>Not Scored</span>
                        </div>
                        {criterion.isPrejudged && (
                          <div className="flex items-center">
                            <Badge variant="secondary" className="text-xs mr-1">
                              Prejudged
                            </Badge>
                            <span>Prejudged</span>
                          </div>
                        )}
                        {criterion.isCarryForward && (
                          <div className="flex items-center">
                            <Badge variant="outline" className="text-xs mr-1 border-amber-500 text-amber-600">
                              Carry Forward
                            </Badge>
                            <span>Carry Forward</span>
                          </div>
                        )}
                      </div>
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

      {/* Debug Info - Collapsible */}
      <details className="mt-8">
        <summary className="cursor-pointer text-sm text-muted-foreground">Debug Information</summary>
        <Card className="mt-2">
          <CardContent className="pt-4">
            <div className="text-sm">
              <p>Active Criteria Count: {debug.activeCriteriaCount}</p>
              <p>Competition ID: {competitionId || selectedCompetitionId || "None"}</p>
              <p>
                Initialization: {debug.initStatus} - {debug.initMessage}
              </p>
              <div className="mt-2">
                <p>Active Criteria List:</p>
                <ul className="list-disc pl-5">
                  {debug.activeCriteriaList.length > 0 ? (
                    debug.activeCriteriaList.map((criteria, index) => <li key={index}>{criteria}</li>)
                  ) : (
                    <li>No active criteria</li>
                  )}
                </ul>
              </div>
              <div className="mt-2 p-2 bg-gray-100 rounded text-xs">
                <p>Store State:</p>
                <pre>{JSON.stringify(debug.storeState, null, 2)}</pre>
              </div>
              <div className="mt-4">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    console.log("Current store state:", store)
                    console.log("Active criteria:", activeCriteria)
                    setForceUpdate((prev) => prev + 1)
                  }}
                >
                  Log Store State & Force Update
                </Button>
                <Button size="sm" variant="outline" className="ml-2" onClick={handleRetry}>
                  Reinitialize
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </details>

      {/* No Active Criteria Message */}
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
