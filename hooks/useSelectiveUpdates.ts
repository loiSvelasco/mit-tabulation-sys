"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"

interface ScoreUpdate {
  segmentId: string
  contestantId: string
  judgeId: string
  criterionId: string
  score: number
  timestamp: number
}

interface SelectiveUpdateState {
  isUpdating: boolean
  lastUpdate: Date | null
  error: string | null
  pendingUpdates: Map<string, ScoreUpdate>
}

export function useSelectiveUpdates(competitionId: number | null | undefined, interval = 3000) {
  const [state, setState] = useState<SelectiveUpdateState>({
    isUpdating: false,
    lastUpdate: null,
    error: null,
    pendingUpdates: new Map()
  })
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { scores, loadCompetition, selectedCompetitionId } = useCompetitionStore()
  const mountedRef = useRef(true)
  const lastScoresHashRef = useRef<string>("")

  // Create a hash of current scores for change detection
  const createScoresHash = useCallback(() => {
    return JSON.stringify(scores)
  }, [scores])

  // Fetch only changed scores from the database
  const fetchChangedScores = useCallback(async () => {
    if (!competitionId || state.isUpdating) return

    setState(prev => ({ ...prev, isUpdating: true }))

    try {
      console.log(`Selective Update: Checking for changes in competition ${competitionId}`)
      
      // Get current scores hash
      const currentHash = createScoresHash()
      
      // Only fetch if we don't have a previous hash or if it changed
      if (lastScoresHashRef.current !== currentHash) {
        // Fetch fresh data to compare
        await loadCompetition(competitionId)
        
        // Update hash after successful fetch
        lastScoresHashRef.current = createScoresHash()
        
        setState(prev => ({
          ...prev,
          lastUpdate: new Date(),
          error: null
        }))
        
        console.log("Selective Update: Data updated successfully")
      } else {
        console.log("Selective Update: No changes detected, skipping update")
      }
    } catch (err) {
      console.error("Selective Update: Error fetching data:", err)
      setState(prev => ({
        ...prev,
        error: `Failed to fetch data: ${err instanceof Error ? err.message : String(err)}`
      }))
    } finally {
      setState(prev => ({ ...prev, isUpdating: false }))
    }
  }, [competitionId, state.isUpdating, createScoresHash, loadCompetition])

  // Start selective polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    if (!competitionId) {
      console.log("Selective Update: No competition ID provided, not starting polling")
      return
    }
    
    console.log(`Selective Update: Starting polling for competition ID: ${competitionId} every ${interval}ms`)
    fetchChangedScores() // Fetch immediately on start
    intervalRef.current = setInterval(fetchChangedScores, interval)
  }, [competitionId, interval, fetchChangedScores])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      console.log("Selective Update: Stopping polling")
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }, [])

  // Manually trigger a refresh
  const refresh = useCallback(async () => {
    console.log("Selective Update: Manual refresh requested")
    await fetchChangedScores()
    return true
  }, [fetchChangedScores])

  // Start/stop polling based on competitionId changes
  useEffect(() => {
    mountedRef.current = true

    if (competitionId) {
      startPolling()
    } else {
      stopPolling()
    }

    return () => {
      mountedRef.current = false
      stopPolling()
    }
  }, [competitionId, startPolling, stopPolling])

  // Add visibility change handler to pause polling when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Selective Update: Tab hidden, pausing polling")
        stopPolling()
      } else if (competitionId) {
        console.log("Selective Update: Tab visible, resuming polling")
        startPolling()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [competitionId, startPolling, stopPolling])

  return {
    isPolling: !!intervalRef.current,
    lastUpdate: state.lastUpdate,
    error: state.error,
    isUpdating: state.isUpdating,
    refresh,
    startPolling,
    stopPolling,
  }
}
