"use client"

import { useState, useEffect, useLayoutEffect, useCallback, useRef } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"

export function useOptimizedPolling(competitionId: number | null | undefined, interval = 15000) {
  const [isPolling, setIsPolling] = useState(true)
  const [isPaused, setIsPaused] = useState(false)
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hasChanges, setHasChanges] = useState(false)
  const [isUserScrolling, setIsUserScrolling] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { loadCompetition, scores, contestants, judges } = useCompetitionStore()
  const mountedRef = useRef(true)
  const isRefreshingRef = useRef(false)
  const lastDataHashRef = useRef<string>("")
  const scrollPositionRef = useRef<number>(0)
  const scrollTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const dataUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Create a hash of current data to detect changes
  const createDataHash = useCallback(() => {
    const scoresStr = JSON.stringify(scores)
    const contestantsStr = JSON.stringify(contestants)
    const judgesStr = JSON.stringify(judges)
    return `${scoresStr}-${contestantsStr}-${judgesStr}`
  }, [scores, contestants, judges])

  // Function to preserve scroll position
  const preserveScrollPosition = useCallback(() => {
    scrollPositionRef.current = window.scrollY
    // Also save to localStorage as backup
    if (competitionId) {
      localStorage.setItem(`scroll-${competitionId}`, window.scrollY.toString())
    }
  }, [competitionId])

  // Function to restore scroll position
  const restoreScrollPosition = useCallback(() => {
    if (scrollPositionRef.current > 0) {
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositionRef.current)
      })
    }
  }, [])

  // Function to restore scroll position from localStorage
  const restoreScrollFromStorage = useCallback(() => {
    if (competitionId) {
      const saved = localStorage.getItem(`scroll-${competitionId}`)
      if (saved) {
        const position = parseInt(saved, 10)
        if (!isNaN(position) && position > 0) {
          scrollPositionRef.current = position
          window.scrollTo(0, position)
        }
      }
    }
  }, [competitionId])

  // Debounced scroll detection
  const handleScroll = useCallback(() => {
    setIsUserScrolling(true)
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
    }
    scrollTimeoutRef.current = setTimeout(() => {
      setIsUserScrolling(false)
    }, 1500) // 1.5 second delay after scrolling stops
  }, [])

  // Function to fetch data with change detection
  const fetchData = useCallback(async () => {
    if (!competitionId || isRefreshingRef.current) {
      if (!competitionId) {
        setError("No competition ID provided")
      }
      return
    }

    // Don't update if user is actively scrolling
    if (isUserScrolling) {
      console.log("Optimized Polling: User is scrolling, skipping update")
      return
    }

    // Preserve scroll position before update
    preserveScrollPosition()

    // Set refreshing flag to prevent overlapping requests
    isRefreshingRef.current = true
    setIsUpdating(true)

    try {
      console.log(`Optimized Polling: Fetching data for competition ID: ${competitionId}`)
      
      // Get current data hash before update
      const currentHash = createDataHash()
      
      await loadCompetition(competitionId)

      // Only update state if component is still mounted
      if (mountedRef.current) {
        // Check if data actually changed
        const newHash = createDataHash()
        const dataChanged = currentHash !== newHash
        
        if (dataChanged) {
          console.log("Optimized Polling: Data changed, updating UI")
          setHasChanges(true)
          setLastUpdate(new Date())
          setError(null)
          
          // Restore scroll position after data change
          restoreScrollPosition()
        } else {
          console.log("Optimized Polling: No data changes detected")
        }
      }
    } catch (err) {
      console.error("Optimized Polling: Error fetching data:", err)

      // Only update state if component is still mounted
      if (mountedRef.current) {
        setError(`Failed to fetch data: ${err instanceof Error ? err.message : String(err)}`)
      }
    } finally {
      // Clear refreshing flag when done
      isRefreshingRef.current = false
      // Add minimal delay before clearing updating state for seamless transition
      setTimeout(() => {
        if (mountedRef.current) {
          setIsUpdating(false)
        }
      }, 50)
    }
  }, [competitionId, loadCompetition, createDataHash, preserveScrollPosition, restoreScrollPosition, isUserScrolling])

  // Debounced data update to prevent too frequent updates
  const debouncedDataUpdate = useCallback(() => {
    if (dataUpdateTimeoutRef.current) {
      clearTimeout(dataUpdateTimeoutRef.current)
    }
    dataUpdateTimeoutRef.current = setTimeout(() => {
      if (!isUserScrolling && !isPaused) {
        fetchData()
      }
    }, 1000) // 1 second delay for data updates
  }, [fetchData, isUserScrolling, isPaused])

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    if (!competitionId) {
      console.log("Optimized Polling: No competition ID provided, not starting polling")
      return
    }

    console.log(`Optimized Polling: Starting polling for competition ID: ${competitionId} every ${interval}ms`)

    // Fetch immediately on start
    fetchData()

    // Then set up interval with debounced updates
    intervalRef.current = setInterval(debouncedDataUpdate, interval)
    setIsPolling(true)
  }, [competitionId, interval, fetchData, debouncedDataUpdate])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      console.log("Optimized Polling: Stopping polling")
      clearInterval(intervalRef.current)
      intervalRef.current = null
      setIsPolling(false)
    }
    // Clear any pending timeouts
    if (scrollTimeoutRef.current) {
      clearTimeout(scrollTimeoutRef.current)
      scrollTimeoutRef.current = null
    }
    if (dataUpdateTimeoutRef.current) {
      clearTimeout(dataUpdateTimeoutRef.current)
      dataUpdateTimeoutRef.current = null
    }
  }, [])

  // Manually trigger a refresh
  const refresh = useCallback(async () => {
    console.log("Optimized Polling: Manual refresh requested")
    await fetchData()
    return true
  }, [fetchData])

  // Start/stop polling based on competitionId changes
  useEffect(() => {
    mountedRef.current = true

    if (competitionId) {
      startPolling()
      // Restore scroll position from localStorage on mount
      restoreScrollFromStorage()
    } else {
      stopPolling()
    }

    // Clean up on unmount
    return () => {
      mountedRef.current = false
      stopPolling()
    }
  }, [competitionId, startPolling, stopPolling, restoreScrollFromStorage])

  // Add scroll event listener
  useEffect(() => {
    if (competitionId) {
      window.addEventListener('scroll', handleScroll, { passive: true })
      return () => {
        window.removeEventListener('scroll', handleScroll)
        // Clear any pending scroll timeout
        if (scrollTimeoutRef.current) {
          clearTimeout(scrollTimeoutRef.current)
        }
      }
    }
  }, [competitionId, handleScroll])

  // Use useLayoutEffect for immediate scroll restoration after data changes
  useLayoutEffect(() => {
    if (hasChanges && scrollPositionRef.current > 0) {
      // Small delay to ensure DOM is updated
      requestAnimationFrame(() => {
        window.scrollTo(0, scrollPositionRef.current)
      })
    }
  }, [hasChanges])

  // Add visibility change handler to pause polling when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log("Optimized Polling: Tab hidden, pausing polling")
        stopPolling()
      } else if (competitionId) {
        console.log("Optimized Polling: Tab visible, resuming polling")
        startPolling()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [competitionId, startPolling, stopPolling])

  // Reset hasChanges flag after a delay
  useEffect(() => {
    if (hasChanges) {
      const timer = setTimeout(() => {
        setHasChanges(false)
      }, 2000) // Reset after 2 seconds

      return () => clearTimeout(timer)
    }
  }, [hasChanges])

  // Pause polling
  const pausePolling = useCallback(() => {
    setIsPaused(true)
    console.log("Polling paused")
  }, [])

  // Resume polling
  const resumePolling = useCallback(() => {
    setIsPaused(false)
    console.log("Polling resumed")
    // Immediately fetch data when resuming
    if (competitionId) {
      fetchData()
    }
  }, [competitionId, fetchData])

  return {
    isPolling,
    isPaused,
    lastUpdate,
    error,
    hasChanges,
    isUpdating,
    refresh,
    startPolling,
    stopPolling,
    pausePolling,
    resumePolling,
  }
}
