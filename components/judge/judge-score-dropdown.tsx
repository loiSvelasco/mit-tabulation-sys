"use client"

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface JudgeScoreDropdownProps {
  maxScore: number
  increment: number
  value: number
  onChange: (value: number) => void
}

export function JudgeScoreDropdown({ maxScore, increment = 0.25, value, onChange }: JudgeScoreDropdownProps) {
  // Generate score options from 0 to maxScore with the specified increment
  const scoreOptions: number[] = []
  for (let score = 0; score <= maxScore; score += increment) {
    scoreOptions.push(Number(score.toFixed(2))) // Fix floating point precision issues
  }

  // Reverse the array to display scores from greatest to least
  const descendingScoreOptions = [...scoreOptions].reverse()

  return (
    <Select value={value.toString()} onValueChange={(val) => onChange(Number(val))}>
      <SelectTrigger className="w-[120px]">
        <SelectValue placeholder="Select score" />
      </SelectTrigger>
      <SelectContent>
        {descendingScoreOptions.map((score) => (
          <SelectItem key={score} value={score.toString()}>
            {score.toFixed(2)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
