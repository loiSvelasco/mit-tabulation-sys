import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db_config"
import { adminMiddleware } from "@/lib/auth"

export async function GET(request: NextRequest) {
  // Check if user is admin
  const authCheck = await adminMiddleware(request)
  if (authCheck) {
    return authCheck // Return the unauthorized response if not admin
  }

  try {
    const url = new URL(request.url)
    const competitionId = url.searchParams.get("competitionId")

    let sql = `
      SELECT jca.id, jca.judge_id, jca.competition_id, jca.access_code, jca.is_active, jca.created_at
      FROM judge_competition_access jca
    `

    const params = []

    if (competitionId) {
      sql += ` WHERE jca.competition_id = ?`
      params.push(competitionId)
    }

    sql += ` ORDER BY jca.competition_id, jca.judge_id`

    const results = await query(sql, params)

    return NextResponse.json({
      message: "Judge access codes retrieved successfully",
      count: results.length,
      results,
    })
  } catch (error) {
    console.error("Error retrieving judge access codes:", error)
    return NextResponse.json({ error: "Failed to retrieve judge access codes" }, { status: 500 })
  }
}
