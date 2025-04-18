import { type NextRequest, NextResponse } from "next/server"
import { v4 as uuidv4 } from "uuid"
import { query } from "@/lib/db_config"

// GET handler to fetch judge finalization status
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const competitionId = searchParams.get("competitionId")
    const segmentId = searchParams.get("segmentId")

    if (!competitionId) {
      return NextResponse.json({ error: "Competition ID is required" }, { status: 400 })
    }

    console.log(`Fetching judge finalization status for competition ID: ${competitionId}`)

    let sql = `
      SELECT * FROM judge_finalization
      WHERE competition_id = ?
    `
    const params: any[] = [competitionId]

    if (segmentId) {
      sql += " AND segment_id = ?"
      params.push(segmentId)
    }

    const results = await query(sql, params)
    return NextResponse.json(results)
  } catch (error) {
    console.error("Error fetching judge finalization status:", error)
    return NextResponse.json({ error: "Failed to fetch judge finalization status" }, { status: 500 })
  }
}

// POST handler to update judge finalization status
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { competitionId, judgeId, segmentId, finalized } = body

    if (!competitionId || !judgeId || !segmentId) {
      return NextResponse.json({ error: "Competition ID, Judge ID, and Segment ID are required" }, { status: 400 })
    }

    // Check if a record already exists
    const existingRecords = await query(
      `
      SELECT * FROM judge_finalization
      WHERE competition_id = ? AND judge_id = ? AND segment_id = ?
    `,
      [competitionId, judgeId, segmentId],
    )

    if (Array.isArray(existingRecords) && existingRecords.length > 0) {
      // Update existing record
      const finalizedAt = finalized ? new Date().toISOString().slice(0, 19).replace("T", " ") : null

      await query(
        `
        UPDATE judge_finalization
        SET finalized = ?, finalized_at = ?
        WHERE competition_id = ? AND judge_id = ? AND segment_id = ?
      `,
        [finalized, finalizedAt, competitionId, judgeId, segmentId],
      )

      return NextResponse.json({ success: true, message: "Judge finalization status updated" })
    } else {
      // Create new record
      const id = uuidv4()
      const finalizedAt = finalized ? new Date().toISOString().slice(0, 19).replace("T", " ") : null

      await query(
        `
        INSERT INTO judge_finalization (id, competition_id, judge_id, segment_id, finalized, finalized_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `,
        [id, competitionId, judgeId, segmentId, finalized, finalizedAt],
      )

      return NextResponse.json({ success: true, message: "Judge finalization status created" })
    }
  } catch (error) {
    console.error("Error updating judge finalization status:", error)
    return NextResponse.json({ error: "Failed to update judge finalization status" }, { status: 500 })
  }
}
