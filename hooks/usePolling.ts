"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"

export function usePolling(competitionId: number | null | undefined, interval = 2000) {
  const [isPolling, setIsPolling] = useState(true) // Start polling by default
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null)
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const { loadCompetition } = useCompetitionStore()
  const mountedRef = useRef(true) // Track if component is mounted
  const isRefreshingRef = useRef(false) // Track if a refresh is in progress

  // Function to fetch data
  const fetchData = useCallback(async () => {
    if (!competitionId || isRefreshingRef.current) {
      if (!competitionId) {
        setError("No competition ID provided")
      }
      return
    }

    // Set refreshing flag to prevent overlapping requests
    isRefreshingRef.current = true

    try {
      console.log(`Polling: Fetching data for competition ID: ${competitionId}`)
      await loadCompetition(competitionId)

      // Only update state if component is still mounted
      if (mountedRef.current) {
        setLastUpdate(new Date())
        setError(null)
      }
    } catch (err) {
      console.error("Polling: Error fetching data:", err)

      // Only update state if component is still mounted
      if (mountedRef.current) {
        setError(`Failed to fetch data: ${err instanceof Error ? err.message : String(err)}`)
      }
    } finally {
      // Clear refreshing flag when done
      isRefreshingRef.current = false
    }
  }, [competitionId, loadCompetition])

  // Start polling
  const startPolling = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current)
    }

    if (!competitionId) {
      console.log("Polling: No competition ID provided, not starting polling")
      return
    }

    console.log(`Polling: Starting polling for competition ID: ${competitionId} every ${interval}ms`)

    // Fetch immediately on start
    fetchData()

    // Then set up interval
    intervalRef.current = setInterval(fetchData, interval)
    setIsPolling(true)
  }, [competitionId, fetchData, interval])

  // Stop polling
  const stopPolling = useCallback(() => {
    if (intervalRef.current) {
      console.log("Polling: Stopping polling")
      clearInterval(intervalRef.current)
      intervalRef.current = null
      setIsPolling(false)
    }
  }, [])

  // Manually trigger a refresh
  const refresh = useCallback(async () => {
    console.log("Polling: Manual refresh requested")
    await fetchData()
    return true // Return a value to indicate completion
  }, [fetchData])

  // Start/stop polling based on competitionId changes
  useEffect(() => {
    mountedRef.current = true // Set mounted flag to true

    if (competitionId) {
      startPolling()
    } else {
      stopPolling()
    }

    // Clean up on unmount
    return () => {
      mountedRef.current = false // Set mounted flag to false
      stopPolling()
    }
  }, [competitionId, startPolling, stopPolling])

  // Add visibility change handler to pause polling when tab is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        console.log("Polling: Tab is visible, resuming polling")
        startPolling()
      } else {
        console.log("Polling: Tab is hidden, pausing polling")
        stopPolling()
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [startPolling, stopPolling])

  return {
    isPolling,
    lastUpdate,
    error,
    refresh,
    startPolling,
    stopPolling,
  }
}