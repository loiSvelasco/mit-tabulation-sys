import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db_config"
import { globalEventEmitter, SCORE_UPDATED } from "@/lib/event-emitter"
import { v4 as uuidv4 } from "uuid"

// Helper function to generate score in increments of 0.25
function generateScoreInIncrements(maxScore: number): number {
  const minScore = Math.ceil(maxScore * 0.70 / 0.25) * 0.25 // 70% rounded up to nearest 0.25
  const maxScoreValue = Math.floor(maxScore * 0.95 / 0.25) * 0.25 // 95% rounded down to nearest 0.25
  
  if (minScore >= maxScoreValue) {
    return maxScoreValue
  }
  
  const randomMultiplier = Math.random()
  const score = minScore + (maxScoreValue - minScore) * randomMultiplier
  const finalScore = Math.round(score * 4) / 4 // Round to nearest 0.25
  
  return Math.max(minScore, Math.min(maxScoreValue, finalScore))
}

// POST: Populate test scores for a specific segment
export async function POST(request: NextRequest) {
  try {
    const { segmentId, competitionId } = await request.json()

    if (!segmentId) {
      return NextResponse.json({ 
        success: false, 
        message: "Segment ID is required" 
      }, { status: 400 })
    }

    if (!competitionId) {
      return NextResponse.json({ 
        success: false, 
        message: "Competition ID is required" 
      }, { status: 400 })
    }

    // Get the competition data
    const competition = await query(
      `SELECT id, competition_data FROM competitions WHERE id = ? LIMIT 1`,
      [competitionId]
    )

    if (competition.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "Competition not found" 
      }, { status: 400 })
    }

    const competitionData = JSON.parse(competition[0].competition_data)

    // Get the specified segment
    const selectedSegment = competitionData.competitionSettings?.segments?.find(
      (segment: any) => segment.id === segmentId
    )

    if (!selectedSegment) {
      return NextResponse.json({ 
        success: false, 
        message: "Segment not found" 
      }, { status: 400 })
    }
    const criteria = selectedSegment.criteria || []

    if (criteria.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "No criteria found for the selected segment" 
      }, { status: 400 })
    }

    // Get all judges
    const judges = competitionData.judges || []
    if (judges.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "No judges found" 
      }, { status: 400 })
    }

    // Get contestants in the selected segment
    const contestants = (competitionData.contestants || []).filter(
      (contestant: any) => contestant.currentSegmentId === segmentId
    )

    if (contestants.length === 0) {
      return NextResponse.json({ 
        success: false, 
        message: "No contestants found in the selected segment" 
      }, { status: 400 })
    }

    console.log(`Populating test scores for competition ${competitionId}, segment ${segmentId}`)
    console.log(`Judges: ${judges.length}, Contestants: ${contestants.length}, Criteria: ${criteria.length}`)

    let scoresGenerated = 0
    const errors: string[] = []

    // Generate scores for each judge × contestant × criterion combination
    for (const judge of judges) {
      for (const contestant of contestants) {
        for (const criterion of criteria) {
          try {
            const score = generateScoreInIncrements(criterion.maxScore)
            
            // Check if score already exists
            const existingScore = await query(
              `SELECT * FROM scores 
               WHERE competition_id = ? 
               AND segment_id = ? 
               AND criterion_id = ? 
               AND contestant_id = ? 
               AND judge_id = ?`,
              [competitionId, segmentId, criterion.id, contestant.id, judge.id]
            )

            if (existingScore.length > 0) {
              // Update existing score
              await query(
                `UPDATE scores 
                 SET score = ?, updated_at = NOW() 
                 WHERE competition_id = ? 
                 AND segment_id = ? 
                 AND criterion_id = ? 
                 AND contestant_id = ? 
                 AND judge_id = ?`,
                [score, competitionId, segmentId, criterion.id, contestant.id, judge.id]
              )
            } else {
              // Insert new score
              const scoreId = uuidv4()
              await query(
                `INSERT INTO scores 
                 (id, competition_id, segment_id, criterion_id, contestant_id, judge_id, score, created_at, updated_at) 
                 VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
                [scoreId, competitionId, segmentId, criterion.id, contestant.id, judge.id, score]
              )
            }

            // Emit score update event
            globalEventEmitter.emit(SCORE_UPDATED, {
              competitionId,
              segmentId,
              contestantId: contestant.id,
              judgeId: judge.id,
              criterionId: criterion.id,
              score,
              timestamp: new Date().toISOString(),
            })

            scoresGenerated++

          } catch (error) {
            const errorMsg = `Failed to save score for judge ${judge.name}, contestant ${contestant.name}, criterion ${criterion.name}: ${(error as Error).message}`
            console.error(errorMsg)
            errors.push(errorMsg)
          }
        }
      }
    }

    console.log(`Successfully generated ${scoresGenerated} test scores`)

    return NextResponse.json({ 
      success: true, 
      message: `Successfully populated ${scoresGenerated} test scores`,
      scoresGenerated,
      errors: errors.length > 0 ? errors : undefined
    })

  } catch (error) {
    console.error("Error populating test scores:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to populate test scores",
        error: (error as Error).message
      },
      { status: 500 }
    )
  }
}
