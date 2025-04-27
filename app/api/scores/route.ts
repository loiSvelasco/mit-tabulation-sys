import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db_config"
import { globalEventEmitter, SCORE_UPDATED } from "@/lib/event-emitter"
import crypto from "crypto"
import { v4 as uuidv4 } from "uuid"

// Helper function to generate ETag
function generateETag(data: any): string {
  const jsonString = JSON.stringify(data)
  return crypto.createHash("md5").update(jsonString).digest("hex")
}

// GET: Retrieve scores for a competition with ETag support
export async function GET(request: Request) {
  const url = new URL(request.url)
  const competitionId = url.searchParams.get("competitionId")

  if (!competitionId) {
    return NextResponse.json({ message: "Competition ID is required" }, { status: 400 })
  }

  try {
    // console.log(`Fetching scores for competition ID: ${competitionId}`)

    const scores = await query(
      `SELECT segment_id, criterion_id, contestant_id, judge_id, score, updated_at
       FROM scores 
       WHERE competition_id = ?`,
      [competitionId],
    )

    // Generate ETag for the scores
    const etag = generateETag(scores)

    // Check if client has the latest version
    const ifNoneMatch = request.headers.get("If-None-Match")
    if (ifNoneMatch === etag) {
      // console.log(`Client already has latest scores for competition ${competitionId}`)
      return new Response(null, { status: 304 }) // Not Modified
    }

    console.log(`Retrieved ${scores.length} scores for competition ID: ${competitionId}`)

    return new Response(JSON.stringify(scores), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        ETag: etag,
        "Cache-Control": "no-cache",
      },
    })
  } catch (error) {
    console.error("Error fetching scores:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

// POST: Save a score
export async function POST(request: NextRequest) {
  try {
    const { competitionId, segmentId, criteriaId, contestantId, judgeId, score } = await request.json()

    // Validate required fields
    if (!competitionId || !segmentId || !criteriaId || !contestantId || !judgeId || score === undefined) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    console.log(
      `Saving score: competition=${competitionId}, segment=${segmentId}, contestant=${contestantId}, judge=${judgeId}, criteria=${criteriaId}, score=${score}`,
    )

    // Check if the score already exists
    const existingScore = await query(
      `SELECT * FROM scores 
       WHERE competition_id = ? 
       AND segment_id = ? 
       AND criterion_id = ? 
       AND contestant_id = ? 
       AND judge_id = ?`,
      [competitionId, segmentId, criteriaId, contestantId, judgeId],
    )

    let result

    if (existingScore.length > 0) {
      // Update existing score
      result = await query(
        `UPDATE scores 
         SET score = ?, updated_at = NOW() 
         WHERE competition_id = ? 
         AND segment_id = ? 
         AND criterion_id = ? 
         AND contestant_id = ? 
         AND judge_id = ?`,
        [score, competitionId, segmentId, criteriaId, contestantId, judgeId],
      )
    } else {
      // Generate a UUID for the new score
      const scoreId = uuidv4()

      // Insert new score with the generated ID
      result = await query(
        `INSERT INTO scores 
         (id, competition_id, segment_id, criterion_id, contestant_id, judge_id, score, created_at, updated_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        [scoreId, competitionId, segmentId, criteriaId, contestantId, judgeId, score],
      )
    }

    // Emit event for server-side notifications (still useful for internal events)
    // console.log(`Emitting score update event for competition ${competitionId}`)
    globalEventEmitter.emit(SCORE_UPDATED, {
      competitionId,
      segmentId,
      contestantId,
      judgeId,
      criterionId: criteriaId, // Make sure we use the same field name consistently
      score,
      timestamp: new Date().toISOString(),
    })

    return NextResponse.json({ success: true, message: "Score saved successfully" })
  } catch (error) {
    console.error("Error saving score:", error)
    return NextResponse.json(
      {
        error: "Failed to save score",
        details: (error as Error).message,
        stack: (error as Error).stack,
      },
      { status: 500 },
    )
  }
}

// DELETE: Delete scores for a competition
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const competitionId = searchParams.get("competitionId")
    const segmentId = searchParams.get("segmentId")
    const criterionId = searchParams.get("criterionId") // Changed from criteriaId
    const contestantId = searchParams.get("contestantId")
    const judgeId = searchParams.get("judgeId")

    // Validate required fields
    if (!competitionId || !segmentId || !criterionId || !contestantId || !judgeId) {
      return NextResponse.json({ success: false, message: "Missing required fields" }, { status: 400 })
    }

    // Delete the score
    await query(
      `DELETE FROM scores 
       WHERE competition_id = ? 
       AND segment_id = ? 
       AND criterion_id = ? 
       AND contestant_id = ? 
       AND judge_id = ?`,
      [competitionId, segmentId, criterionId, contestantId, judgeId],
    )

    // Emit event for server-side notifications
    const scoreData = {
      competitionId: Number(competitionId), // Ensure it's a number
      segmentId,
      criterionId, // Use criterionId in the event data
      contestantId,
      judgeId,
      deleted: true,
      timestamp: new Date().toISOString(),
    }

    // console.log("Emitting score delete event:", scoreData)
    globalEventEmitter.emit(SCORE_UPDATED, scoreData)

    return NextResponse.json({
      success: true,
      message: "Score deleted successfully",
    })
  } catch (error) {
    console.error("Error deleting score:", error)
    return NextResponse.json(
      { success: false, message: "Failed to delete score", error: (error as Error).message },
      { status: 500 },
    )
  }
}
