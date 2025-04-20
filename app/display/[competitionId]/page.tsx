"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Clock, Wifi, WifiOff } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import Image from "next/image"

export default function PublicDisplay() {
  const params = useParams()
  const competitionId = Number.parseInt(params.competitionId as string, 10)
  const [initialLoading, setInitialLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentTime, setCurrentTime] = useState(new Date())
  const [connected, setConnected] = useState(true)

  const { competitionSettings, contestants, judges, scores, activeCriteria, loadCompetition } = useCompetitionStore()

  // Update time every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)

    return () => clearInterval(timer)
  }, [])

  // Initial data fetch and polling
  useEffect(() => {
    const fetchData = async (isInitialFetch = false) => {
      if (!competitionId || isNaN(competitionId)) {
        setError("Invalid competition ID")
        if (isInitialFetch) setInitialLoading(false)
        return
      }

      try {
        await loadCompetition(competitionId)
        setConnected(true)
        setError(null)
      } catch (error) {
        console.error("Error fetching competition data:", error)
        setConnected(false)
        setError("Failed to load competition data")
      } finally {
        if (isInitialFetch) setInitialLoading(false)
      }
    }

    // Initial fetch - only this one will show loading state
    fetchData(true)

    // Set up polling - these fetches won't show loading state
    const interval = setInterval(() => {
      fetchData(false)
    }, 5000)

    return () => clearInterval(interval)
  }, [competitionId, loadCompetition])

  // Get active segment and contestant
  const activeSegmentIds = [...new Set(activeCriteria.map((ac) => ac.segmentId))]
  const activeSegmentId = activeSegmentIds.length > 0 ? activeSegmentIds[0] : ""
  const activeSegment = competitionSettings.segments.find((s) => s.id === activeSegmentId)

  // Find the contestant being judged (the one with active criteria)
  const activeContestantIds = new Set()

  // Check scores to find contestants who have been scored recently
  if (scores[activeSegmentId]) {
    Object.keys(scores[activeSegmentId]).forEach((contestantId) => {
      const contestantScores = scores[activeSegmentId][contestantId]
      const hasRecentScores = Object.values(contestantScores).some((judgeScores) =>
        Object.keys(judgeScores).some((criterionId) => activeCriteria.some((ac) => ac.criterionId === criterionId)),
      )

      if (hasRecentScores) {
        activeContestantIds.add(contestantId)
      }
    })
  }

  // If no active contestants found through scores, use all contestants in the segment
  const activeContestants =
    activeContestantIds.size > 0
      ? contestants.filter((c) => activeContestantIds.has(c.id))
      : contestants.filter((c) => c.currentSegmentId === activeSegmentId)

  // Get the most recently active contestant
  const currentContestant = activeContestants.length > 0 ? activeContestants[0] : null

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-black text-white p-8">
        <div className="max-w-6xl mx-auto">
          <div className="flex justify-between items-center mb-8">
            <Skeleton className="h-10 w-64 bg-gray-800" />
            <Skeleton className="h-6 w-32 bg-gray-800" />
          </div>

          <div className="grid grid-cols-1 gap-8">
            <Skeleton className="h-[60vh] w-full bg-gray-800 rounded-xl" />

            <div className="flex justify-between items-center">
              <Skeleton className="h-8 w-48 bg-gray-800" />
              <Skeleton className="h-8 w-32 bg-gray-800" />
            </div>

            <div className="flex justify-center gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-12 w-24 bg-gray-800 rounded-full" />
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <Card className="w-full max-w-md bg-gray-900 border-red-800">
          <CardContent className="p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Error</h2>
            <p className="text-gray-300">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="mt-4 px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
            >
              Try Again
            </button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-black text-white p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-2xl md:text-4xl font-bold">{competitionSettings.name}</h1>
            {activeSegment && <div className="mt-1 text-lg text-gray-300">{activeSegment.name}</div>}
          </div>

          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xl font-mono">{currentTime.toLocaleTimeString()}</div>
              <div className="text-sm text-gray-400">{currentTime.toLocaleDateString()}</div>
            </div>
            <div className="ml-2">
              {connected ? (
                <Badge
                  variant="outline"
                  className="bg-green-900 text-green-300 border-green-700 flex items-center gap-1"
                >
                  <Wifi className="h-3 w-3" /> Live
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-red-900 text-red-300 border-red-700 flex items-center gap-1">
                  <WifiOff className="h-3 w-3" /> Offline
                </Badge>
              )}
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="grid grid-cols-1 gap-6">
          {/* Current contestant */}
          <div className="bg-gray-900 rounded-xl p-6 shadow-lg">
            {currentContestant ? (
              <div className="flex flex-col items-center">
                <div className="text-center mb-4">
                  <h2 className="text-2xl font-bold">{currentContestant.name}</h2>
                  {currentContestant.gender && <div className="text-xl text-gray-400">{currentContestant.gender}</div>}
                </div>

                <div className="relative w-full max-w-2xl mx-auto aspect-video bg-gray-800 rounded-lg overflow-hidden">
                  {currentContestant.imageUrl ? (
                    <div className="w-full h-full">
                      <Image
                        src={currentContestant.imageUrl || "/placeholder.svg"}
                        alt={`Photo of contestant ${currentContestant.name}`}
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                      No image available
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <Clock className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <p className="text-xl">Waiting for contestant selection...</p>
              </div>
            )}
          </div>

          {/* Judges */}
          <div className="mt-4">
            <h3 className="text-lg font-medium text-gray-400 mb-3">Judges</h3>
            <div className="flex flex-wrap gap-2">
              {judges.map((judge) => (
                <Badge key={judge.id} variant="secondary" className="text-sm py-1 px-3">
                  {judge.name || `Judge ${judge.id}`}
                </Badge>
              ))}
              {judges.length === 0 && <div className="text-gray-500">No judges assigned</div>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
