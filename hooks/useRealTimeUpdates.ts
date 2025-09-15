"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"

interface ScoreChange {
  segmentId: string
  contestantId: string
  judgeId: string
  criterionId: string
  oldScore?: number
  newScore: number
  timestamp: number
}

interface RealTimeState {
  isConnected: boolean
  lastUpdate: Date | null
  error: string | null
  changes: ScoreChange[]
  isUpdating: boolean
}

export function useRealTimeUpdates(competitionId: number | null | undefined, interval = 2000) {
  const [state, setState] = useState<RealTimeState>({
    isConnected: false,
    lastUpdate: null,
    error: null,
    changes: [],
    isUpdating: false
  })
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { scores, setScores, selectedCompetitionId } = useCompetitionStore()
  const mountedRef = useRef(true)
  const lastScoresRef = useRef<typeof scores>({})

  // Check for individual score changes
  const detectScoreChanges = useCallback((oldScores: typeof scores, newScores: typeof scores): ScoreChange[] => {
    const changes: ScoreChange[] = []
    
    // Compare each segment
    Object.keys(newScores).forEach(segmentId => {
      const oldSegment = oldScores[segmentId] || {}
      const newSegment = newScores[segmentId] || {}
      
      // Compare each contestant
      Object.keys(newSegment).forEach(contestantId => {
        const oldContestant = oldSegment[contestantId] || {}
        const newContestant = newSegment[contestantId] || {}
        
        // Compare each judge
        Object.keys(newContestant).forEach(judgeId => {
          const oldJudge = oldContestant[judgeId] || {}
          const newJudge = newContestant[judgeId] || {}
          
          // Compare each criterion
          Object.keys(newJudge).forEach(criterionId => {
            const oldScore = oldJudge[criterionId]
            const newScore = newJudge[criterionId]
            
            if (oldScore !== newScore) {
              changes.push({
                segmentId,
                contestantId,
                judgeId,
                criterionId,
                oldScore,
                newScore,
                timestamp: Date.now()
              })
            }
          })
        })
      })
    })
    
    return changes
  }, [])

  // Apply individual score changes
  const applyScoreChanges = useCallback((changes: ScoreChange[]) => {
    if (changes.length === 0) return

    console.log(`Real-time Update: Applying ${changes.length} score changes`)
    
    changes.forEach(change => {
      setScores(
        change.segmentId,
        change.contestantId,
        change.judgeId,
        change.criterionId,
        change.newScore
      )
    })
  }, [setScores])

  // Fetch only the latest scores and compare
  const fetchAndCompareScores = useCallback(async () => {
    if (!competitionId || state.isUpdating) return

    setState(prev => ({ ...prev, isUpdating: true }))

    try {
      console.log(`Real-time Update: Checking for changes in competition ${competitionId}`)
      
      // Fetch fresh data
      const response = await fetch(`/api/competitions/${competitionId}/data`)
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      const newScores = data.scores || {}
      
      // Detect changes
      const changes = detectScoreChanges(lastScoresRef.current, newScores)
      
      if (changes.length > 0) {
        console.log(`Real-time Update: Found ${changes.length} changes`)
        
        // Apply only the changes
        applyScoreChanges(changes)
        
        setState(prev => ({
          ...prev,
          lastUpdate: new Date(),
          error: null,
          changes: [...prev.changes, ...changes].slice(-50) // Keep last 50 changes
        }))
      } else {
        console.log("Real-time Update: No changes detected")
      }
      
      // Update reference for next comparison
      lastScoresRef.current = newScores
      
    } catch (err) {
      console.error("Real-time Update: Error fetching data:", err)
      setState(prev => ({
        ...prev,
        error: `Failed to fetch data: ${err instanceof Error ? err.message : String(err)}`
      }))
    } finally {
      setState(prev => ({ ...prev, isUpdating: false }))
    }
  }, [competitionId, state.isUpdating, detectScoreChanges, applyScoreChanges])

  // Start real-time updates
  const startUpdates = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }
    if (!competitionId) {
      console.log("Real-time Update: No competition ID provided, not starting updates")
      return
    }
    
    console.log(`Real-time Update: Starting updates for competition ID: ${competitionId} every ${interval}ms`)
    fetchAndCompareScores() // Fetch immediately on start
    intervalRef.current = setInterval(fetchAndCompareScores, interval)
    
    setState(prev => ({ ...prev, isConnected: true }))
  }, [competitionId, interval, fetchAndCompareScores])

  // Stop updates
  const stopUpdates = useCallback(() => {
    if (intervalRef.current) {
      console.log("Real-time Update: Stopping updates")
      clearInterval(intervalRef.current)
      intervalRef.current = null
    }
    setState(prev => ({ ...prev, isConnected: false }))
  }, [])

  // Manually trigger a refresh
  const refresh = useCallback(async () => {
    console.log("Real-time Update: Manual refresh requested")
    await fetchAndCompareScores()
    return true
  }, [fetchAndCompareScores])

  // Start/stop updates based on competitionId changes
  useEffect(() => {
    mountedRef.current = true

    if (competitionId) {
      startUpdates()
    } else {
      stopUpdates()
    }

    return () => {
      mountedRef.current = false
      stopUpdates()
    }
  }, [competitionId, startUpdates, stopUpdates])

  // Add visibility change handler
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Real-time Update: Tab hidden, pausing updates")
        stopUpdates()
      } else if (competitionId) {
        console.log("Real-time Update: Tab visible, resuming updates")
        startUpdates()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [competitionId, startUpdates, stopUpdates])

  return {
    isPolling: state.isConnected,
    lastUpdate: state.lastUpdate,
    error: state.error,
    isUpdating: state.isUpdating,
    changes: state.changes,
    refresh,
    startPolling: startUpdates,
    stopPolling: stopUpdates,
  }
}
