"use client"

import { memo, useState, useEffect } from "react"
import { cn } from "@/lib/utils"

interface ScoreCellProps {
  segmentId: string
  contestantId: string
  judgeId: string
  criterionId: string
  score?: number
  className?: string
  isUpdating?: boolean
}

// Memoized score cell that only re-renders when its specific score changes
export const ScoreCell = memo(function ScoreCell({
  segmentId,
  contestantId,
  judgeId,
  criterionId,
  score,
  className,
  isUpdating = false
}: ScoreCellProps) {
  const [displayScore, setDisplayScore] = useState<number | undefined>(score)
  const [isAnimating, setIsAnimating] = useState(false)

  // Update display score when prop changes
  useEffect(() => {
    if (score !== displayScore) {
      setIsAnimating(true)
      setDisplayScore(score)
      
      // Reset animation after transition
      const timer = setTimeout(() => {
        setIsAnimating(false)
      }, 200)
      
      return () => clearTimeout(timer)
    }
  }, [score, displayScore])

  return (
    <div
      className={cn(
        "transition-all duration-200 ease-in-out",
        isAnimating && "bg-blue-50 scale-105",
        isUpdating && "opacity-90",
        className
      )}
    >
      {displayScore !== undefined ? (
        <span className="font-medium">{displayScore}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      )}
    </div>
  )
})

// Memoized table row that only re-renders when its data changes
interface ScoreRowProps {
  contestantId: string
  contestantName: string
  scores: Record<string, Record<string, number | undefined>>
  judges: Array<{ id: string; name: string }>
  criteria: Array<{ id: string; name: string }>
  isUpdating?: boolean
}

export const ScoreRow = memo(function ScoreRow({
  contestantId,
  contestantName,
  scores,
  judges,
  criteria,
  isUpdating = false
}: ScoreRowProps) {
  return (
    <tr className={cn("transition-opacity duration-150", isUpdating && "opacity-95")}>
      <td className="font-medium">{contestantName}</td>
      {judges.map(judge => (
        <td key={judge.id} className="text-center">
          {criteria.map(criterion => (
            <ScoreCell
              key={`${judge.id}-${criterion.id}`}
              segmentId="current" // This would be passed from parent
              contestantId={contestantId}
              judgeId={judge.id}
              criterionId={criterion.id}
              score={scores[judge.id]?.[criterion.id]}
              isUpdating={isUpdating}
            />
          ))}
        </td>
      ))}
    </tr>
  )
})
