"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Loader2, RefreshCw } from "lucide-react"
import { toast } from "sonner"
import useCompetitionStore from "@/utils/useCompetitionStore"

interface SyncJudgesButtonProps {
  competitionId: string | number
}

export function SyncJudgesButton({ competitionId }: SyncJudgesButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const { judges } = useCompetitionStore()

  const handleSync = async () => {
    try {
      setIsSyncing(true)
      const response = await fetch(`/api/competitions/${competitionId}/sync-judges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to sync judges")
      }

      const result = await response.json()

      // Log the results for debugging
      console.log("Sync results:", result)

      // Show details of what was updated
      const updated = result.results.filter((r) => r.status === "updated").length
      const created = result.results.filter((r) => r.status === "created").length
      const errors = result.results.filter((r) => r.status === "error").length

      let message = "Judge access codes synced to database successfully"
      if (updated > 0) message += ` (${updated} updated)`
      if (created > 0) message += ` (${created} created)`
      if (errors > 0) message += ` (${errors} failed)`

      toast.success(message)
    } catch (error) {
      console.error("Error syncing judges:", error)
      toast.error(error instanceof Error ? error.message : "Failed to sync judges")
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button onClick={handleSync} disabled={isSyncing} variant="outline" className="flex items-center gap-2">
      {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {isSyncing ? "Syncing..." : `Sync ${judges.length} Judges to Database`}
    </Button>
  )
}
