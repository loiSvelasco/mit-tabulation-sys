"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { DatabaseIcon } from "lucide-react"
import useCompetitionStore from "@/utils/useCompetitionStore"

interface SyncJudgesButtonProps {
  competitionId: number
  onSuccess?: () => void
}

export function SyncJudgesButton({ competitionId, onSuccess }: SyncJudgesButtonProps) {
  const [isSyncing, setIsSyncing] = useState(false)
  const { judges } = useCompetitionStore()

  const handleSync = async () => {
    if (!competitionId) {
      toast.error("No competition selected")
      return
    }

    setIsSyncing(true)

    try {
      // Log the current judges in the store before syncing
      console.log("Judges in store before sync:", judges)

      // Send the judges data in the request body
      const response = await fetch(`/api/competitions/${competitionId}/sync-judges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ judges }),
      })

      if (!response.ok) {
        throw new Error("Failed to sync judges")
      }

      const result = await response.json()
      console.log("Sync result:", result)

      // Count the different status types
      const created = result.results.filter((r: any) => r.status === "created").length
      const updated = result.results.filter((r: any) => r.status === "updated").length
      const unchanged = result.results.filter((r: any) => r.status === "unchanged").length
      const errors = result.results.filter((r: any) => r.status === "error").length

      // Create a detailed message
      let message = `Judges synced: ${result.results.length} total`
      if (created > 0) message += `, ${created} created`
      if (updated > 0) message += `, ${updated} updated`
      if (unchanged > 0) message += `, ${unchanged} unchanged`
      if (errors > 0) message += `, ${errors} failed`

      // Show success message
      toast.success(message)

      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess()
      }
    } catch (error) {
      console.error("Error syncing judges:", error)
      toast.error(`Failed to sync judges: ${error instanceof Error ? error.message : String(error)}`)
    } finally {
      setIsSyncing(false)
    }
  }

  return (
    <Button variant="outline" size="sm" onClick={handleSync} disabled={isSyncing} className="flex items-center gap-1">
      <DatabaseIcon size={16} className={isSyncing ? "animate-pulse" : ""} />
      <span>{isSyncing ? "Syncing..." : "Sync Judges"}</span>
    </Button>
  )
}
