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

    const userId = user.id

    // Get competition ID from request
    const { competitionId } = await request.json()
    if (!competitionId) {
      return NextResponse.json({ error: "Competition ID is required" }, { status: 400 })
    }

    // Verify the user owns this competition
    const competitions = await query("SELECT * FROM competitions WHERE id = ? AND created_by = ?", [
      competitionId,
      userId.toString(),
    ])

    if (!competitions.length) {
      return NextResponse.json({ message: "Competition not found or not owned by you" }, { status: 404 })
    }

    // Get competition data to identify pre-judged criteria
    const competitionData = JSON.parse(competitions[0].competition_data)
    const segments = competitionData.competitionSettings.segments

    // Get all pre-judged criteria IDs
    const prejudgedCriteriaIds = []
    segments.forEach(segment => {
      segment.criteria.forEach(criterion => {
        if (criterion.isPrejudged) {
          prejudgedCriteriaIds.push(criterion.id)
        }
      })
    })

    // Delete all scores except those for pre-judged criteria
    if (prejudgedCriteriaIds.length > 0) {
      // If there are pre-judged criteria, delete all scores except those
      await query(
        `DELETE FROM scores 
         WHERE competition_id = ? 
         AND criterion_id NOT IN (${prejudgedCriteriaIds.map(() => '?').join(',')})`,
        [competitionId, ...prejudgedCriteriaIds]
      )
    } else {
      // If there are no pre-judged criteria, delete all scores
      await query("DELETE FROM scores WHERE competition_id = ?", [competitionId])
    }

    // Reset judge finalization statuses
    await query("DELETE FROM judge_finalization WHERE competition_id = ?", [competitionId])

    return NextResponse.json({
      success: true,
      message: "Scores reset successfully",
      preservedCriteria: prejudgedCriteriaIds.length,
    })
  } catch (error) {
    console.error("Error resetting scores:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}