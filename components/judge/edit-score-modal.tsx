"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import { Input } from "@/components/ui/input"

interface Criterion {
  id: string
  name: string
  description: string
  maxScore: number
}

interface EditScoreModalProps {
  criterion: Criterion
  currentScore: number
  onSave: (score: number) => void
  onCancel: () => void
}

export function EditScoreModal({ criterion, currentScore, onSave, onCancel }: EditScoreModalProps) {
  const [score, setScore] = useState(currentScore)
  const [inputValue, setInputValue] = useState(currentScore.toString())

  const handleSliderChange = (newValue: number[]) => {
    const score = newValue[0]
    setScore(score)
    setInputValue(score.toString())
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setInputValue(newValue)

    const numValue = Number(newValue)
    if (!isNaN(numValue) && numValue >= 0 && numValue <= criterion.maxScore) {
      setScore(numValue)
    }
  }

  const handleInputBlur = () => {
    const numValue = Number(inputValue)
    if (isNaN(numValue) || numValue < 0) {
      setInputValue("0")
      setScore(0)
    } else if (numValue > criterion.maxScore) {
      setInputValue(criterion.maxScore.toString())
      setScore(criterion.maxScore)
    }
  }

  return (
    <Dialog open={true} onOpenChange={() => onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Score - {criterion.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <p className="text-sm text-muted-foreground">{criterion.description}</p>

          <div className="flex items-center space-x-4">
            <div className="flex-1">
              <Slider value={[score]} min={0} max={criterion.maxScore} step={0.5} onValueChange={handleSliderChange} />
            </div>
            <div className="w-16">
              <Input
                type="number"
                min={0}
                max={criterion.maxScore}
                step={0.5}
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                className="text-center"
              />
            </div>
            <div className="w-16 text-sm text-muted-foreground text-center">/ {criterion.maxScore}</div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={() => onSave(score)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
