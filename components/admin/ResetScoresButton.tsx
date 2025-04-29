"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { toast } from "sonner"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Input } from "@/components/ui/input"

export function ResetScoresButton() {
  const [open, setOpen] = useState(false)
  const [isResetting, setIsResetting] = useState(false)
  const [confirmStep, setConfirmStep] = useState(1) // Track confirmation step
  const [confirmText, setConfirmText] = useState("")
  const { selectedCompetitionId, resetScores } = useCompetitionStore()

  const handleInitialConfirm = (e) => {
    e.preventDefault() // Prevent form submission
    setConfirmStep(2) // Move to second step
  }

  const handleResetScores = async (e) => {
    e.preventDefault() // Prevent form submission
    
    if (!selectedCompetitionId) {
      toast.error("No competition selected")
      return
    }

    try {
      setIsResetting(true)

      // Call the API to reset scores
      const response = await fetch("/api/scores/reset", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ competitionId: selectedCompetitionId }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to reset scores")
      }

      // Update local state
      await resetScores()

      toast.success("All non-pre-judged scores have been reset successfully.", {
        description: "Scores Reset",
      })

      // Reset and close dialog
      resetDialog()
    } catch (error) {
      console.error("Error resetting scores:", error)
      toast.error(error instanceof Error ? error.message : "Failed to reset scores", {
        description: "Error",
      })
    } finally {
      setIsResetting(false)
    }
  }

  const resetDialog = () => {
    setOpen(false)
    setConfirmStep(1)
    setConfirmText("")
  }

  const isConfirmButtonDisabled = confirmStep === 2 && confirmText !== "RESET"

  return (
    <>
      <Button variant="destructive" onClick={() => setOpen(true)} className="ml-auto">
        Reset Scores
      </Button>

      <AlertDialog open={open} onOpenChange={resetDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reset Competition Scores</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete all scores for this competition except pre-judged scores. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          
          {confirmStep === 2 ? (
            <>
              <div className="py-3">
                <p className="mb-2 text-sm font-medium">
                  Type <span className="font-bold">RESET</span> to confirm:
                </p>
                <Input
                  value={confirmText}
                  onChange={(e) => setConfirmText(e.target.value)}
                  placeholder="RESET"
                  className="border-destructive/50 focus-visible:ring-destructive/30"
                />
              </div>
              <AlertDialogFooter>
                <Button 
                  variant="outline" 
                  onClick={() => setConfirmStep(1)} 
                  disabled={isResetting}
                >
                  Back
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleResetScores}
                  disabled={isResetting || isConfirmButtonDisabled}
                >
                  {isResetting ? "Resetting..." : "Confirm Reset"}
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <AlertDialogFooter>
              <Button 
                variant="outline" 
                onClick={resetDialog}
                disabled={isResetting}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleInitialConfirm}
              >
                Continue
              </Button>
            </AlertDialogFooter>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}