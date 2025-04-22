"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
  User,
  LogOut,
  Loader2,
  Lock,
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
} from "@/components/ui/alert"
import { usePolling } from "@/hooks/usePolling"
import { ImageViewer } from "@/components/image-viewer"

// Define UI states to prevent flashing
type UIState = "loading" | "finalized" | "scoring" | "no-criteria" | "error"

export default function JudgeTerminal() {
  const router = useRouter()

  // Use a single state to control what UI to show
  const [uiState, setUIState] = useState<UIState>("loading")
  const [sessionError, setSessionError] = useState<string | null>(null)

  const [judgeInfo, setJudgeInfo] = useState<{ id: string; name: string } | null>(null)
  const [competitionId, setCompetitionId] = useState<number | null>(null)
  const [competitionName, setCompetitionName] = useState<string>("")
  const [selectedContestantId, setSelectedContestantId] = useState<string | null>(null)
  const [savingScores, setSavingScores] = useState<Set<string>>(new Set())
  const [isFinalized, setIsFinalized] = useState(false)
  const [showFinalizeDialog, setShowFinalizeDialog] = useState(false)
  const [finalizationStatus, setFinalizationStatus] = useState<Record<string, boolean>>({})
  const [finalizationChecked, setFinalizationChecked] = useState(false)

  // Track loading state to prevent flashing
  const [isInitializing, setIsInitializing] = useState(true)

  // Refs to prevent unnecessary re-fetches
  const dataLoadedRef = useRef(false)
  const sessionCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const finalizationCheckIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const uiStateRef = useRef<UIState>("loading") // Track UI state in a ref to avoid race conditions
  const previousFinalizedStateRef = useRef<boolean>(false) // Track previous finalized state

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

  // Update UI state based on current conditions - this is the key function that determines what to show
  const updateUIState = useCallback((newState: UIState) => {
    // Update both the state and the ref to avoid race conditions
    setUIState(newState)
    uiStateRef.current = newState
    console.log(`UI State updated to: ${newState}`)
  }, [])

  // Session check function
  const checkSession = useCallback(async () => {
    try {
      const response = await fetch("/api/judge/session")

      if (!response.ok) {
        setSessionError("Your session has expired. Please log in again.")
        updateUIState("error")
        return false
      }

      const data = await response.json()

      if (!data.user || data.user.role !== "judge") {
        setSessionError("Your session is invalid. Please log in again.")
        updateUIState("error")
        return false
      }

      return true
    } catch (error) {
      console.error("Error checking session:", error)
      setSessionError("Failed to verify your session. Please log in again.")
      updateUIState("error")
      return false
    }
  }, [updateUIState])

  // Function to determine the appropriate UI state based on current data
  const determineUIState = useCallback(() => {
    if (isFinalized) {
      return "finalized"
    } else if (activeCriteria.length === 0) {
      return "no-criteria"
    } else {
      return "scoring"
    }
  }, [isFinalized, activeCriteria.length])

  // Update the checkFinalizationStatus function to handle UI state changes when finalization status changes
  const checkFinalizationStatus = useCallback(
    async (compId: number, judgeId: string) => {
      try {
        const response = await fetch(`/api/judge/finalize?competitionId=${compId}`)
        if (response.ok) {
          const data = await response.json()

          // Create a map of segment IDs to finalization status
          const statusMap: Record<string, boolean> = {}

          data.forEach((item: any) => {
            if (item.judge_id === judgeId) {
              // Handle both boolean and numeric (0/1) values
              statusMap[item.segment_id] = item.finalized === true || item.finalized === 1
            }
          })

          setFinalizationStatus(statusMap)

          // Check if any active segments are already finalized
          const anyFinalized = competitionSettings.segments.some((segment) => statusMap[segment.id])

          // Store the previous finalized state before updating
          const wasFinalized = isFinalized
          previousFinalizedStateRef.current = wasFinalized

          // Update finalization state
          setIsFinalized(anyFinalized)
          setFinalizationChecked(true)

          // If finalization status has changed from finalized to not finalized
          if (wasFinalized && !anyFinalized && !isInitializing) {
            console.log("Finalization status changed: Now allowed to edit scores")
            toast.success("You can now edit your scores again")

            // Refresh data to get latest scores
            await refresh()

            // Update UI state to scoring
            updateUIState("scoring")
          }
          // If finalization status has changed from not finalized to finalized
          else if (!wasFinalized && anyFinalized && !isInitializing) {
            console.log("Finalization status changed: Now finalized")
            updateUIState("finalized")
          }

          return anyFinalized
        }

        return isFinalized // Return current state if request fails
      } catch (error) {
        console.error("Error checking finalization status:", error)
        return isFinalized // Return current state if request fails
      }
    },
    [isFinalized, refresh, competitionSettings.segments, updateUIState, isInitializing],
  )

  // Completely revamped initialization function to prevent flashing
  const initialize = useCallback(async () => {
    if (dataLoadedRef.current) return

    console.log("Starting initialization...")
    setIsInitializing(true)

    try {
      // Step 1: Check session and get judge info
      console.log("Step 1: Checking session...")
      const sessionResponse = await fetch("/api/judge/session")

      if (!sessionResponse.ok) {
        throw new Error(`Session check failed: ${sessionResponse.status} ${sessionResponse.statusText}`)
      }

      const sessionData = await sessionResponse.json()

      if (!sessionData.user || sessionData.user.role !== "judge") {
        toast.error("You must be logged in as a judge to access this page")
        router.replace("/judge/login")
        return
      }

      const judgeId = sessionData.user.id
      const judgeName = sessionData.user.name || `Judge ${judgeId}`

      // Step 2: Check if we have a competition ID
      console.log("Step 2: Checking competition ID...")
      if (!sessionData.competitionId) {
        toast.error("No competition assigned to this judge")
        router.replace("/judge/login")
        return
      }

      const compId = sessionData.competitionId

      // Step 3: Load competition data
      console.log("Step 3: Loading competition data...")
      await loadCompetition(compId)

      // Step 4: Check finalization status
      console.log("Step 4: Checking finalization status...")
      const isJudgeFinalized = await checkFinalizationStatus(compId, judgeId)

      // Step 5: Initialize scores
      console.log("Step 5: Initializing scores...")
      const hasActiveCriteria = activeCriteria.length > 0

      const initialScores: Record<string, Record<string, number>> = {}
      const saved = new Set<string>()

      if (hasActiveCriteria) {
        activeCriteria.forEach(({ segmentId, criterionId }) => {
          if (!initialScores[segmentId]) {
            initialScores[segmentId] = {}
          }

          contestants
            .filter((c) => c.currentSegmentId === segmentId)
            .forEach((contestant) => {
              const contestantScore = scores[segmentId]?.[contestant.id]?.[judgeId]?.[criterionId]

              if (contestantScore !== undefined) {
                if (!initialScores[segmentId][contestant.id]) {
                  initialScores[segmentId][contestant.id] = {}
                }
                initialScores[segmentId][contestant.id][criterionId] = contestantScore
                saved.add(`${contestant.id}-${criterionId}`)
              }
            })
        })
      }

      // Step 6: Set all state at once to prevent re-renders
      console.log("Step 6: Setting all state at once...")

      // Determine final UI state
      let finalState: UIState
      if (isJudgeFinalized) {
        finalState = "finalized"
      } else if (!hasActiveCriteria) {
        finalState = "no-criteria"
      } else {
        finalState = "scoring"
      }

      // Set all state variables
      setJudgeInfo({ id: judgeId, name: judgeName })
      setCompetitionId(compId)
      setCompetitionName(competitionSettings.name)
      setCurrentScores(initialScores)
      setSavedContestants(saved)
      setIsFinalized(isJudgeFinalized)

      // Set initial contestant if in scoring mode
      if (
        finalState === "scoring" &&
        contestants.filter((c) => activeSegmentIds.includes(c.currentSegmentId)).length > 0
      ) {
        setSelectedContestantId(contestants.filter((c) => activeSegmentIds.includes(c.currentSegmentId))[0].id)
      }

      // Mark data as loaded
      dataLoadedRef.current = true

      // Finally, update UI state and exit initialization mode
      console.log(`Initialization complete. Setting UI state to: ${finalState}`)
      updateUIState(finalState)
      setIsInitializing(false)
    } catch (error) {
      console.error("Error during initialization:", error)
      toast.error("Failed to initialize the judge terminal. Please try again.")
      setSessionError("Failed to initialize. Please log in again.")
      updateUIState("error")
      setIsInitializing(false)
    }
  }, [
    router,
    loadCompetition,
    checkFinalizationStatus,
    activeCriteria,
    contestants,
    scores,
    competitionSettings,
    updateUIState,
  ])

  // Setup initialization and session check
  useEffect(() => {
    // Initialize the component
    initialize()

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
      if (finalizationCheckIntervalRef.current) {
        clearInterval(finalizationCheckIntervalRef.current)
      }
    }
  }, [initialize, checkSession, router])

  // Set up finalization status check - more frequent when finalized
  useEffect(() => {
    // Clean up existing interval if any
    if (finalizationCheckIntervalRef.current) {
      clearInterval(finalizationCheckIntervalRef.current)
      finalizationCheckIntervalRef.current = null
    }

    if (competitionId && judgeInfo && !isInitializing) {
      // Check more frequently (every 3 seconds) when finalized to detect when admin allows editing
      const checkInterval = isFinalized ? 3000 : 15000

      finalizationCheckIntervalRef.current = setInterval(() => {
        checkFinalizationStatus(competitionId, judgeInfo.id)
      }, checkInterval)
    }

    return () => {
      if (finalizationCheckIntervalRef.current) {
        clearInterval(finalizationCheckIntervalRef.current)
      }
    }
  }, [competitionId, judgeInfo, isFinalized, checkFinalizationStatus, isInitializing])

  // Update savedContestants when scores change
  useEffect(() => {
    if (judgeInfo && activeCriteria.length > 0 && !isInitializing) {
      const saved = new Set<string>()

      // Mark all scores from the database as saved
      activeCriteria.forEach(({ segmentId, criterionId }) => {
        activeContestants
          .filter((c) => c.currentSegmentId === segmentId)
          .forEach((contestant) => {
            if (scores[segmentId]?.[contestant.id]?.[judgeInfo.id]?.[criterionId] !== undefined) {
              saved.add(`${contestant.id}-${criterionId}`)
            }
          })
      })

      // Only update if there's a difference to prevent infinite loops
      setSavedContestants((prev) => {
        // Check if the sets are different
        if (prev.size !== saved.size) return saved

        // Check if all items in prev are in saved
        for (const item of prev) {
          if (!saved.has(item)) return saved
        }

        // Check if all items in saved are in prev
        for (const item of saved) {
          if (!prev.has(item)) return saved
        }

        // If we get here, the sets are identical, so don't update
        return prev
      })
    }
  }, [scores, judgeInfo, activeCriteria, activeContestants, isInitializing])

  // Add a dedicated effect to watch for changes in activeCriteria
  // This should be added after the existing useEffect hooks, before the rendering logic

  // Add this new useEffect hook
  useEffect(() => {
    // Only run this effect if we're not initializing and data is loaded
    if (!isInitializing && dataLoadedRef.current) {
      console.log("Active criteria changed:", activeCriteria.length > 0 ? "Has criteria" : "No criteria")

      // Update UI state based on current conditions
      if (isFinalized) {
        updateUIState("finalized")
      } else if (activeCriteria.length === 0) {
        updateUIState("no-criteria")
        // Clear selected contestant when there are no criteria
        setSelectedContestantId(null)
      } else {
        updateUIState("scoring")

        // If we're transitioning from no criteria to having criteria,
        // and we don't have a selected contestant, select the first one
        if (uiStateRef.current === "no-criteria" && selectedContestantId === null) {
          const activeContestantsInSegments = contestants.filter((c) => activeSegmentIds.includes(c.currentSegmentId))

          if (activeContestantsInSegments.length > 0) {
            setSelectedContestantId(activeContestantsInSegments[0].id)
          }
        }
      }
    }
  }, [activeCriteria, isFinalized, isInitializing, updateUIState, contestants, selectedContestantId])

  const handleLogout = async () => {
    try {
      await fetch("/api/auth/logout", { method: "POST" })
      router.replace("/judge/login")
    } catch (error) {
      console.error("Error logging out:", error)
    }
  }

  // Check if a criterion is pre-judged
  const isPrejudgedCriterion = (segmentId: string, criterionId: string) => {
    const segment = competitionSettings.segments.find((s) => s.id === segmentId)
    const criterion = segment?.criteria.find((c) => c.id === criterionId)
    return criterion?.isPrejudged || false
  }

  const handleScoreChange = async (segmentId: string, contestantId: string, criterionId: string, score: number) => {
    // Don't allow changes if scores are finalized
    if (isFinalized) {
      toast.error("You cannot change scores after finalizing. Please contact an administrator.")
      return
    }

    // Don't allow changes to pre-judged criteria
    if (isPrejudgedCriterion(segmentId, criterionId)) {
      toast.error("This criterion is pre-judged. You cannot modify the score.")
      return
    }

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

      // Double-check finalization status before saving to prevent race conditions
      if (competitionId) {
        const stillFinalized = await checkFinalizationStatus(competitionId, judgeInfo.id)
        if (stillFinalized) {
          toast.error("Your scores are finalized. Changes were not saved.")
          setSavingScores((prev) => {
            const newSet = new Set(prev)
            newSet.delete(scoreKey)
            return newSet
          })
          return
        }
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

      // Skip pre-judged criteria when checking for unsaved
      if (isPrejudgedCriterion(segmentId, criterionId)) return false

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
        // Skip pre-judged criteria
        if (isPrejudgedCriterion(segmentId, criterionId)) return

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

    // Update UI state immediately to prevent flashing
    updateUIState("finalized")

    // Update finalization status in the database
    if (judgeInfo && competitionId) {
      try {
        // For each active segment, mark as finalized
        for (const segmentId of activeSegmentIds) {
          const response = await fetch("/api/judge/finalize", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              competitionId,
              judgeId: judgeInfo.id,
              segmentId,
              finalized: true,
            }),
          })

          if (!response.ok) {
            const errorData = await response.json()
            console.error("Error finalizing scores:", errorData)
            throw new Error(`Failed to finalize scores: ${errorData.message || response.statusText}`)
          }

          // Update local finalization status
          setFinalizationStatus((prev) => ({
            ...prev,
            [segmentId]: true,
          }))
        }

        // Show success message
        toast.success("Your scores have been finalized successfully!", {
          duration: 3000,
        })
      } catch (error) {
        console.error("Error finalizing scores:", error)
        toast.error(`Failed to finalize scores: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
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

  // Render based on UI state

  // Loading state
  if (uiState === "loading" || isInitializing) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Loading judge terminal...</p>
      </div>
    )
  }

  // Error state
  if (uiState === "error") {
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

  // No criteria state
  if (uiState === "no-criteria") {
    return (
      <div className="min-h-screen bg-muted/30">
        <main className="container mx-auto py-6">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-bold">Judge Terminal</h1>
            <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-1">
              <LogOut size={16} />
              <span>Logout</span>
            </Button>
          </div>
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

  // Finalized state
  if (uiState === "finalized") {
    return (
      <div className="min-h-screen bg-muted/30">
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
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="bg-green-100 text-green-800">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Scores Finalized
                </Badge>
                <Button variant="outline" size="sm" onClick={handleLogout} className="flex items-center gap-1">
                  <LogOut size={16} />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </div>

        <main className="container mx-auto py-6">
          {/* Layout with scores sidebar */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left panel - Contestants list with scores (read-only) */}
            <div className="lg:col-span-4">
              <Card className="h-full">
                <CardHeader>
                  <CardTitle>Your Finalized Scores</CardTitle>
                  <CardDescription>Review your submitted scores for all contestants</CardDescription>
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
                              {criterion?.isPrejudged && <span className="ml-1 text-xs">(Pre-judged)</span>}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {activeContestants.map((contestant) => (
                          <TableRow key={contestant.id}>
                            <TableCell className="font-medium">{contestant.name}</TableCell>

                            {activeCriteriaDetails.map(({ segmentId, criterionId, criterion }) => {
                              // Only show scores for criteria in the contestant's segment
                              if (contestant.currentSegmentId !== segmentId) {
                                return <TableCell key={criterionId}>-</TableCell>
                              }

                              const score = getContestantCriterionScore(contestant.id, segmentId, criterionId)
                              const isPrejudged = criterion?.isPrejudged

                              return (
                                <TableCell
                                  key={criterionId}
                                  className={`font-medium ${isPrejudged ? "text-purple-600" : "text-green-600"}`}
                                >
                                  {score}
                                  {isPrejudged && <Lock className="inline-block ml-1 h-3 w-3 text-purple-600" />}
                                </TableCell>
                              )
                            })}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right panel - Finalization message */}
            <div className="lg:col-span-8">
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
            </div>
          </div>
        </main>
      </div>
    )
  }

  // Scoring state (default)
  return (
    <div className="min-h-screen bg-muted/30">
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
                <Badge
                  key={criterionId}
                  variant="outline"
                  className={criterion?.isPrejudged ? "bg-purple-100" : "bg-secondary/20"}
                >
                  {criterion?.isPrejudged ? (
                    <Lock className="h-3 w-3 mr-1" />
                  ) : (
                    <CheckCircle className="h-3 w-3 mr-1" />
                  )}
                  {criterion?.name}
                  {criterion?.isPrejudged && <span className="ml-1 text-xs">(Pre-judged)</span>}
                </Badge>
              ))}
              <Button variant="outline" size="sm" onClick={handleLogout} className="ml-2 flex items-center gap-1">
                <LogOut size={16} />
                <span>Logout</span>
              </Button>
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
        {/* New layout with larger image */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left panel - Contestants list with scores */}
          <div className="lg:col-span-4">
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
                            {criterion?.isPrejudged && <span className="ml-1 text-xs">(Pre)</span>}
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

                            {activeCriteriaDetails.map(({ segmentId, criterionId, criterion }) => {
                              // Only show scores for criteria in the contestant's segment
                              if (contestant.currentSegmentId !== segmentId) {
                                return <TableCell key={criterionId}>-</TableCell>
                              }

                              const score = getContestantCriterionScore(contestant.id, segmentId, criterionId)
                              const isScored = savedContestants.has(`${contestant.id}-${criterionId}`)
                              const isSaving = savingScores.has(`${contestant.id}-${criterionId}`)
                              const isPrejudged = criterion?.isPrejudged

                              return (
                                <TableCell
                                  key={criterionId}
                                  className={
                                    isSaving
                                      ? "text-amber-600 font-medium"
                                      : isScored
                                        ? isPrejudged
                                          ? "text-purple-600 font-medium"
                                          : "text-green-600 font-medium"
                                        : "text-muted-foreground"
                                  }
                                >
                                  {isSaving ? `${score}...` : score}
                                  {isPrejudged && <Lock className="inline-block ml-1 h-3 w-3 text-purple-600" />}
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
          <div className="lg:col-span-8">
            {currentContestant ? (
              <div className="grid grid-cols-1 gap-6">
                {/* Contestant Image Card */}
                <Card className="overflow-hidden">
                  <CardHeader className="flex flex-row items-center justify-between pb-2">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        {currentContestant.name}
                        {currentSegment && (
                          <Badge variant="outline" className="ml-2">
                            {currentSegment.name}
                          </Badge>
                        )}
                      </CardTitle>
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
                  <CardContent className="pt-0">
                    {/* Contestant Image with Full Screen Viewer */}
                    {currentContestant.imageUrl ? (
                      <div className="w-full h-[400px] mb-4">
                        <ImageViewer
                          src={currentContestant.imageUrl || "/placeholder.svg"}
                          alt={currentContestant.name}
                          className="w-full h-full"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-[400px] rounded-md border flex items-center justify-center bg-muted mb-4">
                        <div className="text-center">
                          <User className="h-16 w-16 mx-auto text-muted-foreground opacity-30" />
                          <p className="text-muted-foreground mt-2">No image available</p>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Scoring Card */}
                <Card>
                  <CardHeader>
                    <CardTitle>Scoring</CardTitle>
                    <CardDescription>Score this contestant on all criteria</CardDescription>
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
                          const isPrejudged = criterion.isPrejudged

                          return (
                            <div
                              key={criterionId}
                              className={`border rounded p-3 ${isPrejudged ? "bg-purple-50" : "bg-card"}`}
                            >
                              <div className="flex flex-col gap-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <h4 className="font-medium flex items-center">
                                      {criterion.name}
                                      {isPrejudged && (
                                        <Badge variant="outline" className="ml-2 bg-purple-100">
                                          <Lock className="h-3 w-3 mr-1" /> Pre-judged
                                        </Badge>
                                      )}
                                    </h4>
                                    <p className="text-xs text-muted-foreground">
                                      {criterion.description || "No description"}
                                      {criterion.maxScore && (
                                        <span className="ml-1 font-medium">(Max: {criterion.maxScore})</span>
                                      )}
                                    </p>
                                  </div>
                                </div>
                                <div className="flex items-center justify-between mt-2">
                                  {isPrejudged ? (
                                    <div className="flex items-center">
                                      <span className="text-lg font-medium text-purple-700">{score}</span>
                                      <span className="ml-2 text-sm text-purple-600">
                                        ({((score / criterion.maxScore) * 100).toFixed(1)}%)
                                      </span>
                                    </div>
                                  ) : (
                                    <JudgeScoreDropdown
                                      maxScore={criterion.maxScore}
                                      increment={0.25}
                                      value={score}
                                      onChange={(value) =>
                                        handleScoreChange(segmentId, currentContestant.id, criterionId, value)
                                      }
                                    />
                                  )}
                                  <div className="ml-2 min-w-[80px] text-right">
                                    {isPrejudged ? (
                                      <span className="text-purple-600 text-sm">Pre-judged</span>
                                    ) : isSaving ? (
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
              </div>
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
