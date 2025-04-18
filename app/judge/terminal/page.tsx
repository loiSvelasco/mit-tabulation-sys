"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DashboardHeader } from "@/components/judge/dashboard-header"
import { JudgeScoreDropdown } from "@/components/judge/judge-score-dropdown"
import useCompetitionStore from "@/utils/useCompetitionStore"
import {
  ChevronLeft,
  ChevronRight,
  Trophy,
  CheckCircle,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Pause,
  Play,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { usePolling } from "@/hooks/usePolling"

export default function JudgeTerminal() {
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [judgeInfo, setJudgeInfo] = useState<{ id: string; name: string } | null>(null)
  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [competitionName, setCompetitionName] = useState<string>("")
  const [selectedContestantId, setSelectedContestantId] = useState<string | null>(null)
  const [sessionError, setSessionError] = useState<string | null>(null)
  const [savingScores, setSavingScores] = useState<Set<string>>(new Set())
  const [isFinalized, setIsFinalized] = useState(false)
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false)

  // Refs to prevent unnecessary re-fetches
  const dataLoadedRef = useRef(false)
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Use polling for real-time updates
  const {
    isPolling,
    lastUpdate,
    error: pollingError,
    refresh,
    startPolling,
    stopPolling,
  } = usePolling(competitionId, 10000) // Poll every 10 seconds

  const { loadCompetition, competitionSettings, contestants, judges, scores, setScores, activeCriteria } =
    useCompetitionStore()

  // Get active segments and criteria
  const activeSegmentIds = [...new Set(activeCriteria.map((ac) => ac.segmentId))]
  const activeSegments = competitionSettings.segments.filter((s) => activeSegmentIds.includes(s.id))

  // Get all active criteria objects with segment and criterion details
  const activeCriteriaDetails = activeCriteria
    .map(({ segmentId, criterionId }) => {
      const segment = competitionSettings.segments.find((s) => s.id === segmentId)
      const criterion = segment?.criteria.find((c) => c.id === criterionId)
      return { segmentId, criterionId, segment, criterion }
    })
    .filter((item) => item.segment && item.criterion)

  // Get contestants in the active segments
  const activeContestants = contestants.filter((c) => activeSegmentIds.includes(c.currentSegmentId))

  // Track scores for the current criteria
  const [currentScores, setCurrentScores] = useState<Record<string, Record<string, number>>>({})
  const [savedContestants, setSavedContestants] = useState<Set<string>>(new Set())

  // Check if current contestant is the last one
  const isLastContestant = selectedContestantId
    ? activeContestants.findIndex((c) => c.id === selectedContestantId) === activeContestants.length - 1
    : false

  // Session check function
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/judge/session")

      if (!response.ok) {
        setSessionError("Your session has expired. Please log in again.")
        return false
      }

      const data = await response.json()

      if (!data.user || data.user.role !== "judge") {
        setSessionError("Your session is invalid. Please log in again.")
        return false
      }

      return true
    } catch (error) {
      console.error("Error checking session:", error)
      setSessionError("Failed to verify your session. Please log in again.")
      return false
    }
  }, [])

  // Initial data loading
  const loadInitialData = useCallback(async () => {
    if (dataLoadedRef.current) return

    try {
      setIsLoading(true)

      // Check session and get judge info
      const response = await fetch("/api/judge/session")
      const data = await response.json()
      console.log("Session data received:", data)

      if (!response.ok) {
        throw new Error(`Session check failed: ${response.status} ${response.statusText}`)
      }

      if (!data.user || data.user.role !== "judge") {
        toast.error("You must be logged in as a judge to access this page")
        router.replace("/judge/login")
        return
      }

      setJudgeInfo({
        id: data.user.id,
        name: data.user.name || `Judge ${data.user.id}`, // Fallback if name is not available
      })
      console.log("Judge info set:", { id: data.user.id, name: data.user.name || `Judge ${data.user.id}` })

      // Make sure we have a competition ID
      if (!data.competitionId) {
        toast.error("No competition assigned to this judge")
        router.replace("/judge/login")
        return
      }

      setCompetitionId(data.competitionId)

      // Load the competition data
      try {
        await loadCompetition(data.competitionId)

        // Set competition name
        setCompetitionName(competitionSettings.name)

        // Initialize current scores from existing scores
        if (data.user.id && activeCriteria.length > 0) {
          const saved = new Set<string>()
          const initialScores: Record<string, Record<string, number>> = {}

          activeCriteria.forEach(({ segmentId, criterionId }) => {
            if (!initialScores[segmentId]) {
              initialScores[segmentId] = {}
            }

            activeContestants
              .filter((c) => c.currentSegmentId === segmentId)
              .forEach((contestant) => {
                const contestantScore = scores[segmentId]?.[contestant.id]?.[data.user.id]?.[criterionId]

                if (contestantScore !== undefined) {
                  if (!initialScores[segmentId][contestant.id]) {
                    initialScores[segmentId][contestant.id] = {}
                  }
                  initialScores[segmentId][contestant.id][criterionId] = contestantScore
                  saved.add(`${contestant.id}-${criterionId}`)
                }
              })
          })

          setCurrentScores(initialScores)
          setSavedContestants(saved)

          // Set the first contestant as selected
          if (activeContestants.length > 0 && !selectedContestantId) {
            setSelectedContestantId(activeContestants[0].id)
          }
        }

        dataLoadedRef.current = true
        setIsLoading(false)
      } catch (error) {
        console.error("Error loading competition:", error)
        toast.error("Failed to load competition data")
        router.replace("/judge/login")
      }
    } catch (error) {
      console.error("Error checking authentication:", error)
      toast.error("Failed to authenticate. Please log in again.")
      router.replace("/judge/login")
    }
  }, [
    router,
    loadCompetition,
    activeCriteria,
    activeContestants,
    scores,
    selectedContestantId,
    competitionSettings.name,
  ])

  // Setup session check and data loading
  useEffect(() => {
    // Load initial data
    loadInitialData()

    // Set up periodic session check (every 5 minutes)
    sessionCheckIntervalRef.current = setInterval(
      async () => {
        const isSessionValid = await checkSession()

        if (!isSessionValid) {
          // Redirect to login after showing error for a moment
          setTimeout(() => {
            router.replace("/judge/login")
          }, 3000)
        }
      },
      5 * 60 * 1000,
    ) // 5 minutes

    return () => {
      // Clean up interval on unmount
      if (sessionCheckIntervalRef.current) {
        clearInterval(sessionCheckIntervalRef.current)
      }
    }
  }, [loadInitialData, checkSession, router])

  // Set selected contestant when contestants change and none is selected
  useEffect(() => {
    if (activeContestants.length > 0 && !selectedContestantId && !isLoading) {
      setSelectedContestantId(activeContestants[0].id)
    }
  }, [activeContestants, selectedContestantId, isLoading])

  // Refresh data periodically to get updates from other judges
  useEffect(() => {
    if (lastUpdate) {
      console.log(`Last data update: ${lastUpdate.toLocaleTimeString()}`)
    }
  }, [lastUpdate])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.replace("/judge/login")
    } catch (error) {
      console.error("Error logging out:", error)
    }
  }

  const handleScoreChange = async (segmentId: string, contestantId: string, criterionId: string, score: number) => {
    // Don't allow changes if scores are finalized
    if (isFinalized) return

    // Update local state first
    setCurrentScores((prev) => {
      const newScores = { ...prev }
      if (!newScores[segmentId]) {
        newScores[segmentId] = {}
      }
      if (!newScores[segmentId][contestantId]) {
        newScores[segmentId][contestantId] = {}
      }
      newScores[segmentId][contestantId][criterionId] = score
      return newScores
    })

    // Auto-save to database
    if (!judgeInfo) return

    // Mark this score as currently saving
    const scoreKey = `${contestantId}-${criterionId}`
    setSavingScores((prev) => new Set(prev).add(scoreKey))

    try {
      // Check session before saving
      const isSessionValid = await checkSession()
      if (!isSessionValid) {
        setSessionError("Your session has expired. Please log in again.")
        setTimeout(() => router.replace("/judge/login"), 3000)
        return
      }

      // Save to database
      const response = await fetch("/api/scores", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competitionId,
          segmentId,
          criteriaId: criterionId, // This will be mapped to criterionId in the API
          contestantId,
          judgeId: judgeInfo.id,
          score,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error("Error response from server:", errorData)
        throw new Error(`Failed to save score: ${errorData.message || response.statusText}`)
      }

      // Update local state
      setScores(segmentId, contestantId, judgeInfo.id, criterionId, score)

      // Mark as saved
      setSavedContestants((prev) => new Set(prev).add(scoreKey))

      // Show a subtle toast notification
      const contestantName = contestants.find((c) => c.id === contestantId)?.name || "contestant"
      const criterionName =
        activeCriteriaDetails.find((c) => c.criterionId === criterionId)?.criterion?.name || "criterion"
      toast.success(`Score saved for ${contestantName}'s ${criterionName}`, {
        duration: 1500,
        position: "bottom-right",
      })

      // Trigger a refresh to make sure we have latest data
      refresh()
    } catch (error) {
      console.error("Error saving score:", error)
      toast.error(`Failed to save score: ${error instanceof Error ? error.message : "Unknown error"}`)
    } finally {
      // Remove from saving state
      setSavingScores((prev) => {
        const newSet = new Set(prev)
        newSet.delete(scoreKey)
        return newSet
      })
    }
  }

  const handleContinueOrFinalize = async () => {
    if (!judgeInfo || !selectedContestantId) return

    // Check if all criteria are scored for the current contestant
    const unsavedCriteria = activeCriteria.filter(({ segmentId, criterionId }) => {
      const contestant = activeContestants.find((c) => c.id === selectedContestantId)
      if (!contestant || contestant.currentSegmentId !== segmentId) return false

      return currentScores[segmentId]?.[selectedContestantId]?.[criterionId] === undefined
    })

    if (unsavedCriteria.length > 0) {
      toast.error(`Please score all criteria first (${unsavedCriteria.length} remaining)`)
      return
    }

    // If this is the last contestant, show finalize dialog
    if (isLastContestant) {
      setShowFinalizeDialog(true)
    } else {
      // Otherwise, save scores and move to next contestant
      navigateToNextContestant()
    }
  }

  const handleFinalizeScores = async () => {
    // Check session before finalizing
    const isSessionValid = await checkSession()
    if (!isSessionValid) {
      setSessionError("Your session has expired. Please log in again.")
      setTimeout(() => router.replace("/judge/login"), 3000)
      return
    }

    // Make sure all scores are saved
    if (judgeInfo) {
      activeCriteria.forEach(({ segmentId, criterionId }) => {
        activeContestants.forEach((contestant) => {
          if (contestant.currentSegmentId !== segmentId) return

          const score = currentScores[segmentId]?.[contestant.id]?.[criterionId]
          if (score !== undefined) {
            setScores(segmentId, contestant.id, judgeInfo.id, criterionId, score)
            setSavedContestants((prev) => new Set(prev).add(`${contestant.id}-${criterionId}`))
          }
        })
      })
    }

    // Mark scores as finalized
    setIsFinalized(true)
    setShowFinalizeDialog(false)

    // Show success message
    toast.success("Your scores have been finalized successfully!", {
      duration: 3000,
    })
  }

  const navigateToPreviousContestant = () => {
    if (!selectedContestantId || isFinalized) return

    const currentIndex = activeContestants.findIndex((c) => c.id === selectedContestantId)
    if (currentIndex > 0) {
      setSelectedContestantId(activeContestants[currentIndex - 1].id)
    }
  }

  const navigateToNextContestant = () => {
    if (!selectedContestantId || isFinalized) return

    const currentIndex = activeContestants.findIndex((c) => c.id === selectedContestantId)
    if (currentIndex < activeContestants.length - 1) {
      setSelectedContestantId(activeContestants[currentIndex + 1].id)
    }
  }

  // Get the current contestant
  const currentContestant = activeContestants.find((c) => c.id === selectedContestantId)

  // Get current segment for the selected contestant
  const currentSegment = currentContestant
    ? competitionSettings.segments.find((s) => s.id === currentContestant.currentSegmentId)
    : null

  // Helper function to get score for a contestant and criterion
  const getContestantCriterionScore = (contestantId: string, segmentId: string, criterionId: string) => {
    // First check current scores (which might not be saved yet)
    const currentScore = currentScores[segmentId]?.[contestantId]?.[criterionId]
    if (currentScore !== undefined) return currentScore

    // Then check saved scores
    if (!judgeInfo) return 0
    return scores[segmentId]?.[contestantId]?.[judgeInfo.id]?.[criterionId] || 0
  }

  // Show session error if present
  if (sessionError) {
    return (
      <div className="min-h-screen bg-muted/30 flex items-center justify-center">
        <Card className="w-[400px]">
          <CardHeader>
            <CardTitle className="text-red-500">Session Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{sessionError}</p>
            <Button className="w-full mt-4" onClick={() => router.replace("/judge/login")}>
              Return to Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p>Loading competition data...</p>
      </div>
    )
  }

  if (activeCriteria.length === 0) {
    return (
      <div className="min-h-screen bg-muted/30">
        <DashboardHeader judgeName={judgeInfo?.name || "Judge"} onLogout={handleLogout} />
        <main className="container mx-auto py-6">
          <Card>
            <CardHeader>
              <CardTitle>Waiting for Active Criteria</CardTitle>
              <CardDescription>The administrator has not yet set any active criteria for judging.</CardDescription>
            </CardHeader>
            <CardContent>
              <p>Please wait for the administrator to set the active criteria.</p>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      <DashboardHeader judgeName={judgeInfo?.name || "Judge"} onLogout={handleLogout} />

      {/* Finalize Confirmation Dialog */}
      <AlertDialog open={showFinalizeDialog} onOpenChange={setShowFinalizeDialog}>
        <AlertDialogContent className="bg-white border shadow-lg">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Finalize Your Scores
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to finalize your scores? Once finalized, you will not be able to edit any of your
              scores for this competition.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleFinalizeScores} className="bg-primary">
              Yes, Finalize My Scores
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Welcome Banner with Competition Info */}
      <div className="bg-primary/10 py-4 px-4 mb-6">
        <div className="container mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                {competitionName}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                Welcome, <span className="font-medium">{judgeInfo?.name || "Judge"}</span>! You are judging the{" "}
                {activeSegments.map((s) => s.name).join(" & ")} segment(s).
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center mr-2">
                <Badge
                  variant="outline"
                  className={isPolling ? "bg-green-100 text-green-800" : "bg-amber-100 text-amber-800"}
                >
                  {isPolling ? "Auto-refresh On" : "Auto-refresh Off"}
                </Badge>
                <Button
                  variant="ghost"
                  size="icon"
                  className="ml-1 h-6 w-6"
                  onClick={isPolling ? stopPolling : startPolling}
                  title={isPolling ? "Pause auto-refresh" : "Resume auto-refresh"}
                >
                  {isPolling ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                </Button>
                <Button variant="ghost" size="icon" className="ml-1 h-6 w-6" onClick={refresh} title="Refresh now">
                  <RefreshCw className="h-3 w-3" />
                </Button>
              </div>
              {activeCriteriaDetails.map(({ criterionId, criterion }) => (
                <Badge key={criterionId} variant="outline" className="bg-secondary/20">
                  <CheckCircle className="h-3 w-3 mr-1" /> {criterion?.name}
                </Badge>
              ))}
            </div>
          </div>
          {pollingError && (
            <div className="mt-2 text-sm text-red-500">
              {pollingError}{" "}
              <Button variant="link" size="sm" className="p-0 h-auto" onClick={refresh}>
                Retry
              </Button>
            </div>
          )}
          {lastUpdate && (
            <div className="mt-1 text-xs text-muted-foreground">Last updated: {lastUpdate.toLocaleTimeString()}</div>
          )}
        </div>
      </div>

      <main className="container mx-auto py-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Left panel - Contestants list with scores */}
          <div className="md:col-span-1">
            <Card className="h-full">
              <CardHeader>
                <CardTitle>Contestants</CardTitle>
                <CardDescription>
                  {currentSegment ? `${currentSegment.name} Segment` : "Select a contestant to score"}
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Contestant</TableHead>
                        {activeCriteriaDetails.map(({ criterionId, criterion }) => (
                          <TableHead key={criterionId} className="whitespace-nowrap">
                            {criterion?.name}
                          </TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeContestants.map((contestant) => {
                        const isSelected = contestant.id === selectedContestantId

                        return (
                          <TableRow
                            key={contestant.id}
                            className={`cursor-pointer ${isSelected ? "bg-primary/10" : ""}`}
                            onClick={() => !isFinalized && setSelectedContestantId(contestant.id)}
                          >
                            <TableCell className="font-medium">{contestant.name}</TableCell>

                            {activeCriteriaDetails.map(({ segmentId, criterionId }) => {
                              // Only show scores for criteria in the contestant's segment
                              if (contestant.currentSegmentId !== segmentId) {
                                return <TableCell key={criterionId}>-</TableCell>
                              }

                              const score = getContestantCriterionScore(contestant.id, segmentId, criterionId)
                              const isScored = savedContestants.has(`${contestant.id}-${criterionId}`)
                              const isSaving = savingScores.has(`${contestant.id}-${criterionId}`)

                              return (
                                <TableCell
                                  key={criterionId}
                                  className={
                                    isSaving
                                      ? "text-amber-600 font-medium"
                                      : isScored
                                        ? "text-green-600 font-medium"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {isSaving ? `${score}...` : score}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right panel - Scoring interface for selected contestant */}
          <div className="md:col-span-2">
            {isFinalized ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-green-600">
                    <CheckCircle2 className="h-5 w-5" />
                    Scores Finalized
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <h3 className="text-xl font-semibold text-green-700 mb-2">Thank You!</h3>
                    <p className="text-green-600 mb-4">Your scores have been finalized and submitted successfully.</p>
                    <p className="text-muted-foreground">
                      Please wait for the next criteria to be activated for judging, or check with the competition
                      administrator for further instructions.
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : currentContestant ? (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {currentContestant.name}
                      {currentSegment && (
                        <Badge variant="outline" className="ml-2">
                          {currentSegment.name}
                        </Badge>
                      )}
                    </CardTitle>
                    <CardDescription>Score this contestant on all criteria</CardDescription>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={navigateToPreviousContestant}
                      disabled={activeContestants.findIndex((c) => c.id === selectedContestantId) === 0}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={navigateToNextContestant}
                      disabled={
                        activeContestants.findIndex((c) => c.id === selectedContestantId) ===
                        activeContestants.length - 1
                      }
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {/* Grid layout for criteria */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {activeCriteriaDetails
                      .filter(({ segmentId }) => segmentId === currentContestant.currentSegmentId)
                      .map(({ segmentId, criterionId, criterion }) => {
                        if (!criterion) return null

                        const score =
                          currentScores[segmentId]?.[currentContestant.id]?.[criterionId] ??
                          (judgeInfo
                            ? (scores[segmentId]?.[currentContestant.id]?.[judgeInfo.id]?.[criterionId] ?? 0)
                            : 0)

                        const isScored = savedContestants.has(`${currentContestant.id}-${criterionId}`)
                        const isSaving = savingScores.has(`${currentContestant.id}-${criterionId}`)
                        const scoreKey = `${currentContestant.id}-${criterionId}`

                        return (
                          <div key={criterionId} className="border rounded p-3 bg-card">
                            <div className="flex flex-col gap-2">
                              <div>
                                <h4 className="font-medium">{criterion.name}</h4>
                                <p className="text-xs text-muted-foreground">
                                  {criterion.description || "No description"}
                                  {criterion.maxScore && (
                                    <span className="ml-1 font-medium">(Max: {criterion.maxScore})</span>
                                  )}
                                </p>
                              </div>
                              <div className="flex items-center justify-between mt-2">
                                <JudgeScoreDropdown
                                  maxScore={criterion.maxScore}
                                  increment={0.25}
                                  value={score}
                                  onChange={(value) =>
                                    handleScoreChange(segmentId, currentContestant.id, criterionId, value)
                                  }
                                />
                                <div className="ml-2 min-w-[80px] text-right">
                                  {isSaving ? (
                                    <span className="text-amber-600 text-sm">Saving...</span>
                                  ) : isScored ? (
                                    <span className="text-green-600 text-sm">Saved</span>
                                  ) : (
                                    <span className="text-muted-foreground text-sm">Not saved</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>

                  <div className="mt-6 flex justify-between">
                    <Button
                      variant="outline"
                      onClick={navigateToPreviousContestant}
                      disabled={activeContestants.findIndex((c) => c.id === selectedContestantId) === 0}
                    >
                      Previous Contestant
                    </Button>
                    <Button onClick={handleContinueOrFinalize} className={isLastContestant ? "bg-green-600" : ""}>
                      {isLastContestant ? "Finalize Scores" : "Continue to Next"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>No Contestant Selected</CardTitle>
                  <CardDescription>Please select a contestant from the list to begin scoring</CardDescription>
                </CardHeader>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
