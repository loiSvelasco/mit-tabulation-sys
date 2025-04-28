import type React from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface ContestantSequenceProps {
  segmentId: string
}

const ContestantSequence: React.FC<ContestantSequenceProps> = ({ segmentId }) => {
  const { contestants } = useCompetitionStore()

  // Get contestants in this segment, sorted by display order
  const segmentContestants = contestants
    .filter((c) => c.currentSegmentId === segmentId)
    .sort((a, b) => (a.displayOrder || 999) - (b.displayOrder || 999))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contestant Sequence</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {segmentContestants.length === 0 ? (
            <p className="text-center text-muted-foreground">No contestants in this segment</p>
          ) : (
            segmentContestants.map((contestant, index) => (
              <div key={contestant.id} className="flex items-center p-2 border rounded-md">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mr-3">
                  <span className="font-bold">{index + 1}</span>
                </div>
                <div>
                  <p className="font-medium">{contestant.name}</p>
                  <p className="text-xs text-muted-foreground">Display Order: {contestant.displayOrder || "Not set"}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export default ContestantSequence
