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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { toast } from "sonner"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { ChevronDown, Loader2, RotateCcw, ArrowLeft, Trash2, RefreshCw } from "lucide-react"

export function ResetScoresButton() {
  const [showDialog, setShowDialog] = useState(false)
  const [dialogType, setDialogType] = useState<"move" | "reset" | "resetAll" | null>(null)
  const [isConfirmStep, setIsConfirmStep] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isProcessing, setIsProcessing] = useState(false)

  const resetScores = useCompetitionStore((state) => state.resetScores)
  const contestants = useCompetitionStore((state) => state.contestants)
  const updateContestantSegment = useCompetitionStore((state) => state.updateContestantSegment)
  const competitionSettings = useCompetitionStore((state) => state.competitionSettings)
  const saveCompetition = useCompetitionStore((state) => state.saveCompetition)

  // Fix for pointer-events issue
  useEffect(() => {
    if (!showDialog) {
      // Small delay to ensure dialog is fully closed
      const timer = setTimeout(() => {
        // Reset any pointer-events that might be stuck
        document.body.style.pointerEvents = ""

        // Find and remove any lingering overlay elements
        const overlays = document.querySelectorAll('[data-state="closed"][role="dialog"]')
        overlays.forEach((overlay) => {
          if (overlay.parentNode) {
            overlay.parentNode.removeChild(overlay)
          }
        })
      }, 100)

      return () => clearTimeout(timer)
    }
  }, [showDialog])

  const openDialog = (type: "move" | "reset" | "resetAll") => {
    setDialogType(type)
    setIsConfirmStep(false)
    setConfirmText("")
    setShowDialog(true)
  }

  const closeDialog = () => {
    setShowDialog(false)
    setDialogType(null)
    setIsConfirmStep(false)
    setConfirmText("")
    setIsProcessing(false)
  }

  const proceedToConfirmStep = () => {
    setIsConfirmStep(true)
  }

  const handleMoveToFirstSegment = async () => {
    try {
      setIsProcessing(true)

      // Get the first segment ID
      const firstSegmentId = competitionSettings.segments[0]?.id

      if (!firstSegmentId) {
        throw new Error("No segments found")
      }

      // Move all contestants to the first segment
      for (const contestant of contestants) {
        updateContestantSegment(contestant.id, firstSegmentId)
      }

      // Save the competition state
      await saveCompetition()

      toast.success("Contestants Moved", {
        description: "All contestants have been moved to the first segment.",
      })
    } catch (error) {
      console.error("Failed to move contestants:", error)
      toast.error("Error", {
        description: "Failed to move contestants. Please try again.",
      })
    } finally {
      setIsProcessing(false)
      closeDialog()
    }
  }

  const handleResetScores = async () => {
    try {
      setIsProcessing(true)
      await resetScores()
      await saveCompetition()
      toast.success("Scores Reset", {
        description: "All non-prejudged scores have been reset.",
      })
    } catch (error) {
      console.error("Failed to reset scores:", error)
      toast.error("Error", {
        description: "Failed to reset scores. Please try again.",
      })
    } finally {
      setIsProcessing(false)
      closeDialog()
    }
  }

  const handleResetAllScores = async () => {
    try {
      setIsProcessing(true)

      // Create an empty scores object to replace the current one
      const emptyScores = {}

      // Set the scores to the empty object
      useCompetitionStore.setState({ scores: emptyScores })

      // Save the competition state
      await saveCompetition()

      toast.success("All Scores Reset", {
        description: "All scores including prejudged scores have been completely reset.",
      })
    } catch (error) {
      console.error("Failed to reset all scores:", error)
      toast.error("Error", {
        description: "Failed to reset all scores. Please try again.",
      })
    } finally {
      setIsProcessing(false)
      closeDialog()
    }
  }

  const handleAction = () => {
    if (dialogType === "move") {
      return handleMoveToFirstSegment()
    }

    if (!isConfirmStep) {
      return proceedToConfirmStep()
    }

    if (confirmText !== "RESET") {
      toast.error("Incorrect confirmation", {
        description: "Please type RESET to confirm this action.",
      })
      return
    }

    if (dialogType === "reset") {
      return handleResetScores()
    }

    if (dialogType === "resetAll") {
      return handleResetAllScores()
    }
  }

  const getDialogContent = () => {
    if (!dialogType) return null

    if (dialogType === "move") {
      return {
        title: "Move All Contestants",
        description: "This will move all contestants to the first segment. This action cannot be undone.",
        showInput: false,
        actionText: "Move Contestants",
        actionClass: "",
      }
    }

    if (dialogType === "reset") {
      if (isConfirmStep) {
        return {
          title: "Confirm Reset",
          description: "Type RESET to confirm deleting all non-prejudged scores. This action cannot be undone.",
          showInput: true,
          actionText: "Confirm Reset",
          actionClass: "",
        }
      }

      return {
        title: "Reset Regular Scores",
        description: "This will delete all scores except pre-judged scores. This action cannot be undone.",
        showInput: false,
        actionText: "Continue",
        actionClass: "",
      }
    }

    if (dialogType === "resetAll") {
      if (isConfirmStep) {
        return {
          title: "Confirm Reset ALL",
          description:
            "Type RESET to confirm deleting ALL scores including prejudged scores. This action cannot be undone.",
          showInput: true,
          actionText: "Confirm Reset ALL",
          actionClass: "bg-red-600 hover:bg-red-700",
        }
      }

      return {
        title: "Reset ALL Scores",
        description: "This will delete ALL scores including prejudged scores. This action cannot be undone.",
        showInput: false,
        actionText: "Continue",
        actionClass: "",
      }
    }

    return null
  }

  const content = getDialogContent()

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
          >
            <RotateCcw className="mr-2 h-4 w-4" />
            Reset
            <ChevronDown className="ml-1 h-3 w-3 opacity-70" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem onClick={() => openDialog("move")} className="flex items-center">
            <ArrowLeft className="mr-2 h-4 w-4" />
            <span>Move All to First Segment</span>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => openDialog("reset")} className="flex items-center text-amber-600">
            <RefreshCw className="mr-2 h-4 w-4" />
            <span>Reset Regular Scores</span>
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openDialog("resetAll")} className="flex items-center text-red-600">
            <Trash2 className="mr-2 h-4 w-4" />
            <span>Reset ALL Scores</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {content && (
        <Dialog
          open={showDialog}
          onOpenChange={(open) => {
            if (!open) closeDialog()
          }}
        >
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>{content.title}</DialogTitle>
              <DialogDescription>{content.description}</DialogDescription>
              {content.showInput && (
                <div className="mt-4">
                  <Input
                    placeholder="Type RESET to confirm"
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
                disabled={isProcessing || (content.showInput && confirmText !== "RESET")}
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
