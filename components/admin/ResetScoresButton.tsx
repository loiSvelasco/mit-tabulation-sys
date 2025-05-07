"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Loader2, RotateCcw } from "lucide-react"

export function ResetScoresButton() {
  const [showDialog, setShowDialog] = useState(false)
  const [isConfirmStep, setIsConfirmStep] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)
  const [preservePrejudged, setPreservePrejudged] = useState(true)

  const resetScores = useCompetitionStore((state) => state.resetScores)
  const contestants = useCompetitionStore((state) => state.contestants)
  const updateContestantSegment = useCompetitionStore((state) => state.updateContestantSegment)
  const updateContestantDisplayOrder = useCompetitionStore((state) => state.updateContestantDisplayOrder)
  const competitionSettings = useCompetitionStore((state) => state.competitionSettings)
  const saveCompetition = useCompetitionStore((state) => state.saveCompetition)
  const selectedCompetitionId = useCompetitionStore((state) => state.selectedCompetitionId)
  const loadScores = useCompetitionStore((state) => state.loadScores)

  // Replace the entire useEffect hook with this improved version
  useEffect(() => {
    // Only run cleanup when dialog is closed
    if (!showDialog) {
      // Use a more reliable approach to clean up the DOM
      // This will run after the dialog has fully closed
      const timer = setTimeout(() => {
        // Find any lingering dialog elements and remove them properly
        document.querySelectorAll('[role="dialog"][data-state="closed"]').forEach((element) => {
          // Only attempt to remove if the element is still in the DOM
          if (element.parentNode && document.body.contains(element)) {
            element.parentNode.removeChild(element)
          }
        })

        // Reset any stuck backdrop or pointer-events
        document.body.style.pointerEvents = ""

        // Remove any lingering backdrop elements
        document.querySelectorAll("[data-radix-portal-root]").forEach((element) => {
          if (element.childElementCount === 0 && element.parentNode) {
            element.parentNode.removeChild(element)
          }
        })
      }, 300) // Increased timeout to ensure dialog animation completes

      return () => clearTimeout(timer)
    }
  }, [showDialog])

  const openDialog = () => {
    setIsConfirmStep(false)
    setConfirmText("")
    setPreservePrejudged(true)
    setShowDialog(true)
  }

  // Replace the closeDialog function with this improved version
  const closeDialog = () => {
    // First set processing to false to disable any buttons
    setIsProcessing(false)

    // Then close the dialog
    setShowDialog(false)

    // Reset state after a short delay to ensure dialog is closed first
    setTimeout(() => {
      setIsConfirmStep(false)
      setConfirmText("")
    }, 100)
  }

  const proceedToConfirmStep = () => {
    setIsConfirmStep(true)
  }

  // Function to reset display order for contestants in a segment
  const resetDisplayOrderForSegment = async (segmentId) => {
    try {
      // Get contestants in the segment
      const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

      // Sort them by ID to have a consistent order
      const sortedContestants = [...segmentContestants].sort((a, b) => Number.parseInt(a.id) - Number.parseInt(b.id))

      // Assign sequential display orders (1, 2, 3...)
      sortedContestants.forEach((contestant, index) => {
        updateContestantDisplayOrder(contestant.id, index + 1)
      })

      // Get segment name for the toast message
      const segmentName = competitionSettings.segments.find((s) => s.id === segmentId)?.name || "segment"

      toast.success(`Reset display order for ${sortedContestants.length} contestants in ${segmentName}`)
    } catch (error) {
      console.error("Error resetting display order:", error)
      toast.error("Failed to reset display order. Please try again.")
    }
  }

  // Function to reset scores in the database
  const resetScoresInDatabase = async (preservePrejudged = true) => {
    if (!selectedCompetitionId) {
      throw new Error("No competition selected")
    }

    // Call the API to reset scores
    const response = await fetch("/api/scores/reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        competitionId: selectedCompetitionId,
        preservePrejudged, // If true, preserve prejudged scores; if false, delete all scores
      }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.error || "Failed to reset scores in database")
    }

    return await response.json().catch(() => ({}))
  }

  const handleInitialize = async () => {
    try {
      setIsProcessing(true)

      // Get the first segment ID
      const firstSegmentId = competitionSettings.segments[0]?.id

      if (!firstSegmentId) {
        throw new Error("No segments found")
      }

      // 1. Move all contestants to the first segment
      for (const contestant of contestants) {
        updateContestantSegment(contestant.id, firstSegmentId)
      }

      // 2. Reset display order for contestants in the first segment
      await resetDisplayOrderForSegment(firstSegmentId)

      // 3. Reset scores based on the preservePrejudged setting
      if (preservePrejudged) {
        // Reset scores in the Zustand store (preserving prejudged)
        await resetScores()
        // Reset scores in the database (preserving prejudged)
        await resetScoresInDatabase(true)
      } else {
        // Reset ALL scores in the database (not preserving prejudged)
        await resetScoresInDatabase(false)
        // Create an empty scores object to replace the current one in the store
        useCompetitionStore.setState({ scores: {} })
      }

      // 4. Save the competition state
      await saveCompetition()

      // 5. Reload scores from the database to ensure UI is in sync
      if (selectedCompetitionId) {
        await loadScores(selectedCompetitionId)
      }

      toast.success("Initialization Complete", {
        description: `All contestants moved to first segment, display order reset, and scores ${
          preservePrejudged ? "(except prejudged) " : ""
        }have been reset.`,
      })
    } catch (error) {
      console.error("Failed to initialize:", error)
      toast.error("Error", {
        description: "Failed to initialize. Please try again.",
      })
    } finally {
      setIsProcessing(false)
      closeDialog()
    }
  }

  const handleAction = () => {
    if (!isConfirmStep) {
      return proceedToConfirmStep()
    }

    if (confirmText !== "INITIALIZE") {
      toast.error("Incorrect confirmation", {
        description: "Please type INITIALIZE to confirm this action.",
      })
      return
    }

    return handleInitialize()
  }

  const getDialogContent = () => {
    if (isConfirmStep) {
      return {
        title: "Confirm Initialization",
        description: "Type INITIALIZE to confirm. This action cannot be undone.",
        showInput: true,
        actionText: "Confirm Initialization",
        actionClass: "",
      }
    }

    return {
      title: "Initialize Competition",
      description:
        "This will move all contestants to the first segment, reset their display order, and reset scores. This action cannot be undone.",
      showInput: false,
      showPrejudgedOption: true,
      actionText: "Continue",
      actionClass: "",
    }
  }

  const content = getDialogContent()

  // Replace the Dialog component with this updated version
  return (
    <>
      <Button
        variant="outline"
        className="bg-blue-50 border-blue-200 text-blue-600 hover:bg-blue-100 hover:text-blue-700"
        onClick={openDialog}
      >
        <RotateCcw className="mr-2 h-4 w-4" />
        Initialize
      </Button>

      {content && (
        <Dialog
          open={showDialog}
          onOpenChange={(open) => {
            if (!open) {
              // Use our improved closeDialog function
              closeDialog()
            }
          }}
        >
          <DialogContent
            className="sm:max-w-[425px]"
            // Add this onEscapeKeyDown handler
            onEscapeKeyDown={() => closeDialog()}
            // Add this onInteractOutside handler
            onInteractOutside={() => closeDialog()}
          >
            <DialogHeader>
              <DialogTitle>{content.title}</DialogTitle>
              <DialogDescription>{content.description}</DialogDescription>

              {content.showPrejudgedOption && (
                <div className="flex items-center space-x-2 mt-4 pt-2 border-t">
                  <Checkbox
                    id="preservePrejudged"
                    checked={preservePrejudged}
                    onCheckedChange={(checked) => setPreservePrejudged(checked as boolean)}
                  />
                  <Label htmlFor="preservePrejudged" className="text-sm font-medium">
                    Preserve prejudged scores during initialization
                  </Label>
                </div>
              )}

              {content.showInput && (
                <div className="mt-4">
                  <Input
                    placeholder="Type INITIALIZE to confirm"
                    value={confirmText}
                    onChange={(e) => setConfirmText(e.target.value)}
                    className="mt-2"
                    autoFocus
                  />
                </div>
              )}
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={closeDialog} disabled={isProcessing}>
                Cancel
              </Button>
              <Button
                onClick={handleAction}
                disabled={isProcessing || (content.showInput && confirmText !== "INITIALIZE")}
                className={content.actionClass}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  content.actionText
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  )
}
