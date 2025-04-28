import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db_config"
import { getCurrentUser } from "@/lib/auth"

export async function POST(request: NextRequest) {
  try {
    // Use getCurrentUser to authenticate the request
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ message: "Unauthorized - Authentication failed" }, { status: 401 })
    }

    // Check if user is an admin (adjust this based on how you store user roles)
    if (user.role !== "admin") {
      return NextResponse.json({ message: "Unauthorized - Admin access required" }, { status: 403 })
    }

    // Parse request body
    const body = await request.json()
    const { competitionId, segmentId } = body

    if (!competitionId || !segmentId) {
      return NextResponse.json({ message: "Competition ID and segment ID are required" }, { status: 400 })
    }

    // Update all judge finalization records for this segment to set finalized=0
    await query(
      `UPDATE judge_finalization 
       SET finalized = 0, finalized_at = NULL 
       WHERE competition_id = ? AND segment_id = ?`,
      [competitionId, segmentId],
    )

    // Return success response
    return NextResponse.json({ message: "Judge finalization status reset successfully" }, { status: 200 })
  } catch (error) {
    console.error("Error resetting judge finalization status:", error)
    return NextResponse.json({ message: "Failed to reset judge finalization status" }, { status: 500 })
  }
}
