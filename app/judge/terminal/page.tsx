"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
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
  User,
  LogOut,
  Loader2,
  ArrowRight,
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
import { ImageViewer } from "@/components/image-viewer"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

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
  const [activeTab, setActiveTab] = useState<string>("scoring")
  // Track loading state to prevent flashing
  const [isInitializing, setIsInitializing] = useState(true)
  // Track dropdown state
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const dropdownButtonRef = useRef<HTMLDivElement>(null)

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
  } = usePolling(competitionId, 2000) // Poll every 2 seconds

  // Add a ref to track previous active criteria for comparison
  const previousActiveCriteriaRef = useRef<string>("")

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

  // Get contestants in the active segments and sort by displayOrder
  const activeContestants = contestants
    .filter((c) => activeSegmentIds.includes(c.currentSegmentId))
    .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))

  // Track scores for the current criteria
  const [currentScores, setCurrentScores] = useState<Record<string, Record<string, number>>>({})
  const [savedContestants, setSavedContestants] = useState<Set<string>>(new Set())

  // Handle clicks outside the dropdown
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        dropdownButtonRef.current &&
        !dropdownButtonRef.current.contains(event.target as Node)
      ) {
        setDropdownOpen(false)
      }
    }

    // Add event listener when dropdown is open
    if (dropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside)
    }

    // Clean up
    return () => {
      document.removeEventListener("mousedown", handleClickOutside)
    }
  }, [dropdownOpen])

  // Check if current contestant is the last one
  const isLastContestant = selectedContestantId
    ? (() => {
        const currentContestant = activeContestants.find((c) => c.id === selectedContestantId)
        if (!currentContestant) return false

        const currentDisplayOrder =
          currentContestant.displayOrder || activeContestants.findIndex((c) => c.id === selectedContestantId) + 1

        // Check if there are any contestants with a higher display order in the same segment
        return !activeContestants.some((c) => {
          const displayOrder = c.displayOrder || activeContestants.findIndex((contestant) => contestant.id === c.id) + 1
          return displayOrder > currentDisplayOrder && c.currentSegmentId === currentContestant.currentSegmentId
        })
      })()
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

          // Check if ALL ACTIVE segments are finalized (not just any segment)
          // This is the key fix - only consider active segments
          const allActiveSegmentsFinalized =
            activeSegmentIds.length > 0 && activeSegmentIds.every((segmentId) => statusMap[segmentId] === true)

          // Store the previous finalized state before updating
          const wasFinalized = isFinalized
          previousFinalizedStateRef.current = wasFinalized

          // Update finalization state based on active segments only
          setIsFinalized(allActiveSegmentsFinalized)
          setFinalizationChecked(true)

          // If finalization status has changed from finalized to not finalized
          if (wasFinalized && !allActiveSegmentsFinalized && !isInitializing) {
            // console.log("Finalization status changed: Now allowed to edit scores")
            // toast.success("You can now edit your scores again")

            // Refresh data to get latest scores
            await refresh()

            // Update UI state to scoring
            updateUIState("scoring")
          }
          // If finalization status has changed from not finalized to finalized
          else if (!wasFinalized && allActiveSegmentsFinalized && !isInitializing) {
            console.log("Finalization status changed: Now finalized")
            updateUIState("finalized")
          }

          return allActiveSegmentsFinalized
        }

        return isFinalized // Return current state if request fails
      } catch (error) {
        console.error("Error checking finalization status:", error)
        return isFinalized // Return current state if request fails
      }
    },
    [isFinalized, refresh, updateUIState, isInitializing],
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
        // Get active contestants and sort by display order
        const sortedContestants = contestants
          .filter((c) => activeSegmentIds.includes(c.currentSegmentId))
          .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))

        // Select the contestant with the lowest display order
        if (sortedContestants.length > 0) {
          setSelectedContestantId(sortedContestants[0].id)
          console.log(
            "Initially selected contestant:",
            sortedContestants[0].name,
            "with display order:",
            sortedContestants[0].displayOrder || 1,
          )
        }
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

  // Reset finalization state when active criteria change
  useEffect(() => {
    if (!isInitializing && judgeInfo && competitionId) {
      // When active criteria change, we need to re-check finalization status
      checkFinalizationStatus(competitionId, judgeInfo.id)
    }
  }, [activeCriteria, judgeInfo, competitionId, checkFinalizationStatus, isInitializing])

  // Add this effect to handle segment changes and contestant selection
  useEffect(() => {
    if (!isInitializing) {
      // Get the current selected contestant
      const currentContestant = contestants.find((c) => c.id === selectedContestantId)

      // Check if the current contestant is in an active segment
      if (currentContestant && !activeCriteria.some((ac) => ac.segmentId === currentContestant.currentSegmentId)) {
        setSelectedContestantId(null)
      }

      // If no contestant is selected or the selected contestant is not in an active segment
      if (
        !selectedContestantId ||
        (currentContestant && !activeCriteria.some((ac) => ac.segmentId === currentContestant.currentSegmentId))
      ) {
        // Get active contestants and sort by display order
        const sortedContestants = contestants
          .filter((c) => activeCriteria.some((ac) => ac.segmentId === c.currentSegmentId))
          .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))

        // Select the contestant with the lowest display order
        if (sortedContestants.length > 0) {
          console.log(
            "Automatically selecting contestant with lowest display order:",
            sortedContestants[0].name,
            "with display order:",
            sortedContestants[0].displayOrder || 1,
          )
          setSelectedContestantId(sortedContestants[0].id)
        }
      }
    }
  }, [contestants, selectedContestantId, isInitializing, activeCriteria])

  // Add this effect to detect changes in active criteria and reset contestant selection when segments change
  useEffect(() => {
    if (!isInitializing && judgeInfo) {
      // Create a string representation of current active criteria for comparison
      const activeCriteriaString = JSON.stringify(
        activeCriteria.map((ac) => `${ac.segmentId}-${ac.criterionId}`).sort(),
      )

      // Get the current active segments
      const currentActiveSegmentIds = [...new Set(activeCriteria.map((ac) => ac.segmentId))]

      // Get the previous active segments from the stored criteria string
      let previousActiveSegmentIds: string[] = []
      if (previousActiveCriteriaRef.current) {
        try {
          const previousCriteria = JSON.parse(previousActiveCriteriaRef.current)
          // Extract segment IDs from the criteria strings (format: "segmentId-criterionId")
          previousActiveSegmentIds = [...new Set(previousCriteria.map((ac: string) => ac.split("-")[0]))]
        } catch (e) {
          console.error("Error parsing previous active criteria:", e)
        }
      }

      // Check if segments have changed
      const segmentsChanged =
        currentActiveSegmentIds.length !== previousActiveSegmentIds.length ||
        currentActiveSegmentIds.some((id) => !previousActiveSegmentIds.includes(id))

      // Compare with previous active criteria
      if (previousActiveCriteriaRef.current && previousActiveCriteriaRef.current !== activeCriteriaString) {
        console.log("Active criteria changed, refreshing UI...")

        // Reset selected contestant if segments changed
        if (segmentsChanged) {
          console.log("Segments changed, resetting selected contestant")
          setSelectedContestantId(null)
        }

        // Reset UI state based on finalization status
        if (competitionId) {
          checkFinalizationStatus(competitionId, judgeInfo.id).then((isFinalized) => {
            if (!isFinalized) {
              // If not finalized, update UI to scoring mode
              updateUIState("scoring")
            }
          })
        }
      }

      // Update the ref with current active criteria
      previousActiveCriteriaRef.current = activeCriteriaString
    }
  }, [activeCriteria, isInitializing, judgeInfo, competitionId, checkFinalizationStatus, updateUIState])

  // Modify the refresh function to also update active criteria
  const handleRefresh = async () => {
    // First do the regular refresh
    await refresh()

    // Then check if we need to update the UI state
    if (judgeInfo && competitionId) {
      const isFinalized = await checkFinalizationStatus(competitionId, judgeInfo.id)

      // If not finalized and we have active criteria, make sure we're in scoring mode
      if (!isFinalized && activeCriteria.length > 0 && uiState !== "scoring") {
        updateUIState("scoring")

        // Set initial contestant if none selected - choose the one with lowest display order
        if (!selectedContestantId && activeContestants.length > 0) {
          const sortedContestants = [...activeContestants].sort(
            (a, b) => (a.displayOrder || 999) - (b.displayOrder || 999),
          )
          setSelectedContestantId(sortedContestants[0].id)
          console.log(
            "Selected contestant after refresh:",
            sortedContestants[0].name,
            "with display order:",
            sortedContestants[0].displayOrder || 1,
          )
        }
      }
    }
  }

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
    if (isFinalized) {
      toast.error("You cannot change scores after finalizing. Please contact an administrator.")
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

      // Check both current scores and scores from the database
      const hasCurrentScore = currentScores[segmentId]?.[selectedContestantId]?.[criterionId] !== undefined
      const hasDatabaseScore =
        judgeInfo && scores[segmentId]?.[selectedContestantId]?.[judgeInfo.id]?.[criterionId] !== undefined

      return !hasCurrentScore && !hasDatabaseScore
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
          return

          const contestantScore = currentScores[segmentId]?.[contestant.id]?.[criterionId]
          if (contestantScore !== undefined) {
            setScores(segmentId, contestant.id, judgeInfo.id, criterionId, contestantScore)
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
        toast.error(`Failed to save scores: ${error instanceof Error ? error.message : "Unknown error"}`)
      }
    }
  }

  // Replace the existing navigateToPreviousContestant function with this version
  const navigateToPreviousContestant = () => {
    if (!selectedContestantId || isFinalized) return

    // Find the current contestant's display order
    const currentContestant = activeContestants.find((c) => c.id === selectedContestantId)
    if (!currentContestant) return

    const currentDisplayOrder =
      currentContestant.displayOrder || activeContestants.findIndex((c) => c.id === selectedContestantId) + 1

    // Find the contestant with the next lower display order
    const previousContestant = activeContestants
      .filter((c) => {
        const displayOrder = c.displayOrder || activeContestants.findIndex((contestant) => contestant.id === c.id) + 1
        return displayOrder < currentDisplayOrder && c.currentSegmentId === currentContestant.currentSegmentId
      })
      .sort((a, b) => {
        const displayOrderA = a.displayOrder || activeContestants.findIndex((contestant) => contestant.id === a.id) + 1
        const displayOrderB = b.displayOrder || activeContestants.findIndex((contestant) => contestant.id === b.id) + 1
        return displayOrderB - displayOrderA // Sort in descending order to get the closest previous
      })[0]

    if (previousContestant) {
      setSelectedContestantId(previousContestant.id)
    }
  }

  // Replace the existing navigateToNextContestant function with this version
  const navigateToNextContestant = () => {
    if (!selectedContestantId || isFinalized) return

    // Find the current contestant's display order
    const currentContestant = activeContestants.find((c) => c.id === selectedContestantId)
    if (!currentContestant) return

    const currentDisplayOrder =
      currentContestant.displayOrder || activeContestants.findIndex((c) => c.id === selectedContestantId) + 1

    // Find the contestant with the next higher display order
    const nextContestant = activeContestants
      .filter((c) => {
        const displayOrder = c.displayOrder || activeContestants.findIndex((contestant) => contestant.id === c.id) + 1
        return displayOrder > currentDisplayOrder && c.currentSegmentId === currentContestant.currentSegmentId
      })
      .sort((a, b) => {
        const displayOrderA = a.displayOrder || activeContestants.findIndex((contestant) => contestant.id === a.id) + 1
        const displayOrderB = b.displayOrder || activeContestants.findIndex((contestant) => contestant.id === b.id) + 1
        return displayOrderA - displayOrderB // Sort in ascending order to get the closest next
      })[0]

    if (nextContestant) {
      setSelectedContestantId(nextContestant.id)
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

  // Calculate scoring progress for current contestant
  const calculateScoringProgress = () => {
    if (!currentContestant || !judgeInfo) return 0

    const relevantCriteria = activeCriteria.filter(({ segmentId }) => segmentId === currentContestant.currentSegmentId)

    if (relevantCriteria.length === 0) return 100

    let scoredCount = 0
    relevantCriteria.forEach(({ segmentId, criterionId }) => {
      if (
        currentScores[segmentId]?.[currentContestant.id]?.[criterionId] !== undefined ||
        scores[segmentId]?.[currentContestant.id]?.[judgeInfo.id]?.[criterionId] !== undefined ||
        scores[segmentId]?.[currentContestant.id]?.[judgeInfo.id]?.[criterionId] !== undefined
      ) {
        scoredCount++
      }
    })

    return Math.round((scoredCount / relevantCriteria.length) * 100)
  }

  // Calculate overall scoring progress
  const calculateOverallProgress = () => {
    if (!judgeInfo) return 0

    let totalCriteria = 0
    let scoredCriteria = 0

    activeContestants.forEach((contestant) => {
      activeCriteria
        .filter(({ segmentId }) => segmentId === contestant.currentSegmentId)
        .forEach(({ segmentId, criterionId }) => {
          totalCriteria++

          if (
            currentScores[segmentId]?.[contestant.id]?.[criterionId] !== undefined ||
            scores[segmentId]?.[contestant.id]?.[judgeInfo.id]?.[criterionId] !== undefined
          ) {
            scoredCriteria++
          }
        })
    })

    return totalCriteria === 0 ? 0 : Math.round((scoredCriteria / totalCriteria) * 100)
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
        <header className="bg-primary text-primary-foreground py-4 px-4">
          <div className="container mx-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <h1 className="text-xl font-bold">{competitionName}</h1>
              </div>
              <div className="flex items-center gap-2">
                {judgeInfo && (
                  <Badge variant="secondary" className="bg-primary-foreground text-primary mr-2">
                    <User className="h-3 w-3 mr-1" /> Welcome, {judgeInfo.name}
                  </Badge>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto py-12">
          <Card className="max-w-md mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Waiting for Active Criteria</CardTitle>
              <CardDescription>
                The competition administrator has not yet activated any criteria for judging.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
              <p className="text-center text-muted-foreground">
                Please wait for the administrator to set the active criteria. This page will automatically update when
                criteria become available.
              </p>
            </CardContent>
            <CardFooter className="flex justify-center border-t pt-4">
              <Button variant="outline" onClick={handleRefresh} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Refresh Now
              </Button>
            </CardFooter>
          </Card>
        </main>
      </div>
    )
  }

  // Finalized state
  if (uiState === "finalized") {
    return (
      <div className="min-h-screen bg-muted/30">
        {/* Header with Competition Info */}
        <header className="bg-primary text-primary-foreground py-4 px-4">
          <div className="container mx-auto">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <Trophy className="h-5 w-5" />
                <h1 className="text-xl font-bold">{competitionName}</h1>
              </div>
              <div className="flex items-center gap-2">
                {judgeInfo && (
                  <Badge variant="secondary" className="bg-primary-foreground text-primary">
                    <User className="h-3 w-3 mr-1" /> Welcome, {judgeInfo.name}
                  </Badge>
                )}
                <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                  <CheckCircle2 className="h-3 w-3 mr-1" /> Scores Finalized
                </Badge>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLogout}
                  className="flex items-center gap-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
                >
                  <LogOut size={16} />
                  <span>Logout</span>
                </Button>
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto py-8">
          <Card className="max-w-3xl mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto bg-green-100 text-green-800 rounded-full w-16 h-16 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <CardTitle className="text-2xl">Scores Successfully Finalized</CardTitle>
              <CardDescription>
                Thank you for completing your judging for {activeSegments.map((s) => s.name).join(" & ")}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Tabs defaultValue="summary" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="summary">Summary</TabsTrigger>
                  <TabsTrigger value="details">Detailed Scores</TabsTrigger>
                </TabsList>

                <TabsContent value="summary" className="pt-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center mb-6">
                    <h3 className="text-xl font-semibold text-green-700 mb-2">Judging Complete</h3>
                    <p className="text-green-600 mb-4">Your scores have been finalized and submitted successfully.</p>
                    <p className="text-muted-foreground">
                      Please wait for the next criteria to be activated for judging, or check with the competition
                      administrator for further instructions.
                    </p>
                  </div>

                  <div className="grid gap-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Judge:</span>
                      <span>{judgeInfo?.name}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Competition:</span>
                      <span>{competitionName}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Segment(s):</span>
                      <span>{activeSegments.map((s) => s.name).join(", ")}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Contestants Scored:</span>
                      <span>{activeContestants.length}</span>
                    </div>
                    <Separator />
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Criteria Scored:</span>
                      <span>{activeCriteriaDetails.length}</span>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="details" className="pt-4">
                  <ScrollArea className="h-[400px] rounded-md border p-4">
                    <div className="space-y-6">
                      {activeContestants.map((contestant) => (
                        <div key={contestant.id} className="border rounded-lg p-4">
                          <h3 className="font-medium text-lg mb-2">{contestant.name}</h3>
                          <div className="grid gap-2">
                            {activeCriteriaDetails
                              .filter(({ segmentId }) => segmentId === contestant.currentSegmentId)
                              .map(({ segmentId, criterionId, criterion }) => {
                                const score = getContestantCriterionScore(contestant.id, segmentId, criterionId)
                                return (
                                  <div key={criterionId} className="flex justify-between items-center">
                                    <span className="text-sm text-muted-foreground">{criterion?.name}:</span>
                                    <span className="font-medium text-green-600">{score}</span>
                                  </div>
                                )
                              })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>

            <CardFooter className="flex justify-center border-t pt-4">
              <Button variant="outline" onClick={handleRefresh} className="flex items-center gap-2">
                <RefreshCw className="h-4 w-4" />
                Check for Updates
              </Button>
            </CardFooter>
          </Card>
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

      {/* Header with Competition Info */}
      <header className="bg-primary text-primary-foreground py-4 px-4 sticky top-0 z-10">
        <div className="container mx-auto">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              <h1 className="text-xl font-bold">{competitionName}</h1>
            </div>
            <div className="flex items-center gap-2">
              {judgeInfo && (
                <Badge variant="secondary" className="bg-primary-foreground text-primary">
                  <User className="h-3 w-3 mr-1" /> Welcome, {judgeInfo.name}
                </Badge>
              )}
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="sm" onClick={handleRefresh} className="h-8 w-8 p-0">
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Refresh Data</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>

              <Button
                variant="outline"
                size="sm"
                onClick={handleLogout}
                className="flex items-center gap-1 bg-primary-foreground text-primary hover:bg-primary-foreground/90"
              >
                <LogOut size={16} />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Status Bar */}
      <div className="bg-background border-b sticky top-[57px] z-10">
        <div className="container mx-auto py-2 px-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Overall: {calculateOverallProgress()}% complete</span>
            <Badge variant="outline" className="text-xs">
              {activeContestants.length} contestants • {activeCriteriaDetails.length} criteria
            </Badge>
          </div>
        </div>
      </div>

      <main className="container mx-auto py-6 px-4">
        {/* Contestant Navigation */}
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="outline"
            size="sm"
            onClick={navigateToPreviousContestant}
            disabled={!selectedContestantId || activeContestants.findIndex((c) => c.id === selectedContestantId) === 0}
            className="flex items-center gap-1"
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>

          <div className="text-center">
            <h2 className="text-lg font-medium">
              Contestant{" "}
              {currentContestant
                ? currentContestant.displayOrder ||
                  activeContestants.findIndex((c) => c.id === currentContestant.id) + 1
                : 0}{" "}
              of{" "}
              {
                activeContestants.filter((c) =>
                  currentContestant ? c.currentSegmentId === currentContestant.currentSegmentId : true,
                ).length
              }
            </h2>
            <p className="text-sm text-muted-foreground">{currentSegment?.name || ""}</p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={navigateToNextContestant}
            disabled={!selectedContestantId || isLastContestant}
            className="flex items-center gap-1"
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {currentContestant ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left panel - Contestant Info and Image */}
            <div className="lg:col-span-5">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="flex items-center justify-between">
                    <span className="uppercase">{currentContestant.name}</span>
                    {currentSegment && (
                      <div className="flex items-center gap-1 relative group" ref={dropdownButtonRef}>
                        <Badge
                          variant="outline"
                          className="flex items-center gap-1 cursor-pointer"
                          onClick={(e) => {
                            e.stopPropagation()
                            setDropdownOpen(!dropdownOpen)
                          }}
                        >
                          SELECT
                          <ChevronRight className="h-3 w-3 rotate-90 ml-1" />
                        </Badge>
                        {dropdownOpen && (
                          <div
                            ref={dropdownRef}
                            className="absolute right-0 top-full mt-1 z-50 bg-white rounded-md shadow-md border border-gray-200 max-h-48 overflow-y-auto w-48"
                          >
                            {currentContestant &&
                              activeContestants
                                .filter((c) => c.currentSegmentId === currentContestant.currentSegmentId)
                                .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))
                                .map((contestant) => (
                                  <button
                                    key={contestant.id}
                                    className={`w-full text-left px-3 py-2 text-sm hover:bg-gray-100 ${
                                      contestant.id === selectedContestantId ? "bg-gray-50 font-medium" : ""
                                    }`}
                                    onClick={() => {
                                      setSelectedContestantId(contestant.id)
                                      setDropdownOpen(false)
                                    }}
                                  >
                                    {contestant.name}
                                  </button>
                                ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardTitle>
                  <CardDescription>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm">Scored {calculateScoringProgress()}% of criteria</span>
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-2">
                  {/* Contestant Image */}
                  {currentContestant.imageUrl ? (
                    <div className="flex justify-center mb-2">
                      <div className="max-h-[250px] max-w-[80%] overflow-hidden rounded-md">
                        <ImageViewer
                          src={currentContestant.imageUrl || "/placeholder.svg"}
                          alt={currentContestant.name}
                          className="max-h-[250px] w-auto object-contain"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-[250px] rounded-md border flex items-center justify-center bg-muted mb-2">
                      <div className="text-center">
                        <User className="h-16 w-16 mx-auto text-muted-foreground opacity-30" />
                        <p className="text-muted-foreground mt-2">No image available</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right panel - Scoring interface */}
            <div className="lg:col-span-7">
              <Card>
                <CardHeader>
                  <CardTitle>Score Criteria</CardTitle>
                  <CardDescription>Score this contestant on all criteria below</CardDescription>
                </CardHeader>
                <CardContent>
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

                        return (
                          <div key={criterionId} className="border rounded-lg p-4 bg-card">
                            <div className="flex flex-col gap-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <h4 className="font-medium text-lg">{criterion.name}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {criterion.description || "No description"}
                                  </p>
                                </div>
                                <Badge
                                  variant={isScored ? "outline" : "secondary"}
                                  className={isScored ? "bg-green-100 text-green-800 border-green-200" : ""}
                                >
                                  {isScored ? "Saved" : "Not Scored"}
                                </Badge>
                              </div>

                              <div className="flex items-center justify-between mt-3">
                                <div className="flex items-center gap-1">
                                  <span className="text-2xl font-bold">{score}</span>
                                  <span className="text-sm text-muted-foreground">/ {criterion.maxScore}</span>
                                </div>

                                <div className="flex items-center gap-2">
                                  {isSaving && (
                                    <div className="text-amber-600 text-sm flex items-center gap-1">
                                      <Loader2 className="h-3 w-3 animate-spin" />
                                      Saving...
                                    </div>
                                  )}

                                  <JudgeScoreDropdown
                                    maxScore={criterion.maxScore}
                                    increment={0.25}
                                    value={score}
                                    onChange={(value) =>
                                      handleScoreChange(segmentId, currentContestant.id, criterionId, value)
                                    }
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        )
                      })}
                  </div>
                </CardContent>
                <CardFooter className="flex justify-between border-t pt-4">
                  <Button
                    variant="outline"
                    onClick={navigateToPreviousContestant}
                    disabled={activeContestants.findIndex((c) => c.id === selectedContestantId) === 0}
                    className="w-[120px]"
                  >
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>

                  <Button
                    onClick={handleContinueOrFinalize}
                    className={`w-[120px] ${isLastContestant ? "bg-green-600 hover:bg-green-700" : ""}`}
                  >
                    {isLastContestant ? (
                      <>
                        Finalize
                        <CheckCircle className="h-4 w-4 ml-2" />
                      </>
                    ) : (
                      <>
                        Next
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </CardFooter>
              </Card>
            </div>
          </div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>No Contestant Selected</CardTitle>
              <CardDescription>Please select a contestant from the list to begin scoring</CardDescription>
            </CardHeader>
          </Card>
        )}
      </main>
    </div>
  )
}
