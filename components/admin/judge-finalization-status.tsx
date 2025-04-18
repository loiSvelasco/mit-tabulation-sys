"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { RefreshCw, CheckCircle, XCircle, AlertCircle } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"

interface JudgeFinalizationStatusProps {
  competitionId: string | number
  segmentId?: string
}

interface JudgeFinalization {
  id: string
  judge_id: string
  judge_name: string
  segment_id: string
  finalized: boolean
  finalized_at: string | null
}

export function JudgeFinalizationStatus({ competitionId, segmentId }: JudgeFinalizationStatusProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [judgeStatus, setJudgeStatus] = useState<JudgeFinalization[]>([])

  const fetchJudgeStatus = async () => {
    try {
      setLoading(true)
      setError(null)

      let url = `/api/judge/finalize?competitionId=${competitionId}`
      if (segmentId) {
        url += `&segmentId=${segmentId}`
      }

      const response = await fetch(url)

      if (!response.ok) {
        throw new Error(`Failed to fetch judge status: ${response.status}`)
      }

      const data = await response.json()
      setJudgeStatus(data)
    } catch (err) {
      console.error("Error fetching judge finalization status:", err)
      setError(err instanceof Error ? err.message : "Unknown error occurred")
      toast.error("Failed to load judge finalization status")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (competitionId) {
      fetchJudgeStatus()

      // Set up polling every 10 seconds
      const interval = setInterval(fetchJudgeStatus, 10000)
      return () => clearInterval(interval)
    }
  }, [competitionId, segmentId])

  // Calculate completion percentage
  const totalJudges = judgeStatus.length
  const finalizedJudges = judgeStatus.filter((judge) => judge.finalized).length
  const completionPercentage = totalJudges > 0 ? Math.round((finalizedJudges / totalJudges) * 100) : 0

  if (error) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center">
            <AlertCircle className="mr-2 h-5 w-5 text-red-500" />
            Judge Finalization Status Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={fetchJudgeStatus} variant="outline" size="sm" className="mt-2">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex justify-between items-center">
          <CardTitle className="text-lg">Judge Finalization Status</CardTitle>
          <Button onClick={fetchJudgeStatus} variant="outline" size="sm" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
        <CardDescription>
          Track which judges have finalized their scoring for this {segmentId ? "segment" : "competition"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loading && judgeStatus.length === 0 ? (
            <>
              <div className="flex items-center justify-between mb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-12" />
              </div>
              <Skeleton className="h-4 w-full mb-4" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center justify-between p-2 border rounded">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-6 w-20" />
                  </div>
                ))}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Completion Progress</span>
                <span className="text-sm font-medium">{completionPercentage}%</span>
              </div>
              <Progress value={completionPercentage} className="h-2 mb-4" />

              {judgeStatus.length === 0 && !loading ? (
                <div className="text-center py-4 text-muted-foreground">
                  No judge data available for this competition
                </div>
              ) : (
                <div className="space-y-2">
                  {judgeStatus.map((judge) => (
                    <div key={judge.id} className="flex items-center justify-between p-2 border rounded">
                      <div className="flex items-center">
                        {judge.finalized ? (
                          <CheckCircle className="h-5 w-5 text-green-500 mr-2" />
                        ) : (
                          <XCircle className="h-5 w-5 text-amber-500 mr-2" />
                        )}
                        <span>{judge.judge_name || `Judge ${judge.judge_id.substring(0, 8)}`}</span>
                      </div>
                      <Badge variant={judge.finalized ? "success" : "outline"}>
                        {judge.finalized ? "Finalized" : "Pending"}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
