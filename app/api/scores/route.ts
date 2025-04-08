import { NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db_config"
import { getCurrentUser } from "@/lib/auth"
import { v4 as uuidv4 } from "uuid"

// GET: Retrieve scores for a competition
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const competitionId = url.searchParams.get("competitionId")

  if (!competitionId) {
    return NextResponse.json({ message: "Competition ID is required" }, { status: 400 })
  }

  try {
    const scores = await query(
      `SELECT segment_id, criterion_id, contestant_id, judge_id, score 
       FROM scores 
       WHERE competition_id = ?`,
      [competitionId],
    )

    return NextResponse.json(scores, { status: 200 })
  } catch (error) {
    console.error("Error fetching scores:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

// POST: Save a score
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Parse request body
    const { competitionId, segmentId, criterionId, contestantId, judgeId, score } = await request.json()

    // Validate input
    if (!competitionId || !segmentId || !criterionId || !contestantId || !judgeId || score === undefined) {
      return NextResponse.json({ message: "Missing required fields" }, { status: 400 })
    }

    // Save score to database
    await query(
      `INSERT INTO scores (id, competition_id, segment_id, criterion_id, contestant_id, judge_id, score) 
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE score = ?`,
      [uuidv4(), competitionId, segmentId, criterionId, contestantId, judgeId, score, score],
    )

    return NextResponse.json({ message: "Score saved successfully" }, { status: 200 })
  } catch (error) {
    console.error("Error saving score:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}

// DELETE: Delete scores for a competition
export async function DELETE(request: NextRequest) {
  const url = new URL(request.url)
  const competitionId = url.searchParams.get("competitionId")

  if (!competitionId) {
    return NextResponse.json({ message: "Competition ID is required" }, { status: 400 })
  }

  try {
    // Verify authentication
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    await query("DELETE FROM scores WHERE competition_id = ?", [competitionId])
    return NextResponse.json({ message: "Scores deleted successfully" }, { status: 200 })
  } catch (error) {
    console.error("Error deleting scores:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
