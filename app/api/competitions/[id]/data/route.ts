import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db_config"
import { getCurrentUser, verifyToken } from "@/lib/auth"

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    // Await the params object before destructuring
    const params = await context.params
    const id = params.id
    const competitionId = Number.parseInt(id)

    // First, check for judge authentication via auth-token
    const authHeader = request.headers.get("authorization")
    const cookieStore = request.cookies
    const authTokenCookie = cookieStore.get("auth-token")

    // Try to get token from either Authorization header or cookie
    const token = authHeader?.startsWith("Bearer ") ? authHeader.substring(7) : authTokenCookie?.value

    if (token) {
      try {
        // Verify the judge token
        const judgeUser = await verifyToken(token)

        if (judgeUser && judgeUser.role === "judge") {
          // console.log("Judge authenticated:", judgeUser)

          // Check if this judge has access to this competition
          if (judgeUser.competitionId === competitionId) {
            // For judges, get competition without checking created_by
            const competitions = await query("SELECT competition_data FROM competitions WHERE id = ?", [competitionId])

            if (!competitions.length) {
              return NextResponse.json({ message: "Competition not found" }, { status: 404 })
            }

            const competition = competitions[0]

            // Parse the JSON data from the database
            const competitionData = JSON.parse(competition.competition_data || "{}")

            // Fetch access codes for judges from judge_competition_access table
            const accessCodes = await query(
              `SELECT judge_id, access_code, judge_name FROM judge_competition_access 
               WHERE competition_id = ? AND is_active = TRUE`,
              [competitionId]
            ) as any[]

            // Update judges with their actual access codes and names from database
            if (competitionData.judges && Array.isArray(competitionData.judges)) {
              competitionData.judges = competitionData.judges.map((judge: any) => {
                const accessRecord = accessCodes.find(ac => ac.judge_id === judge.id)
                return {
                  ...judge,
                  accessCode: accessRecord?.access_code || judge.accessCode,
                  name: accessRecord?.judge_name || judge.name
                }
              })
            }

            return NextResponse.json(competitionData, { status: 200 })
          } else {
            console.log("Judge does not have access to this competition:", judgeUser.competitionId, "vs", competitionId)
          }
        }
      } catch (error) {
        console.error("Error verifying judge token:", error)
        // Fall through to try admin authentication
      }
    }

    // If judge authentication failed or wasn't attempted, try admin authentication
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ message: "Unauthorized - Authentication failed" }, { status: 401 })
    }

    const userId = user.id

    // Get competition details from database for admin users
    const competitions = await query("SELECT competition_data FROM competitions WHERE id = ? AND created_by = ?", [
      competitionId,
      userId.toString(),
    ])

    if (!competitions.length) {
      return NextResponse.json({ message: "Competition not found" }, { status: 404 })
    }

    const competition = competitions[0]

    // Parse the JSON data from the database
    const competitionData = JSON.parse(competition.competition_data || "{}")

    // Fetch access codes for judges from judge_competition_access table
    const accessCodes = await query(
      `SELECT judge_id, access_code, judge_name FROM judge_competition_access 
       WHERE competition_id = ? AND is_active = TRUE`,
      [competitionId]
    ) as any[]

    // Update judges with their actual access codes and names from database
    if (competitionData.judges && Array.isArray(competitionData.judges)) {
      competitionData.judges = competitionData.judges.map((judge: any) => {
        const accessRecord = accessCodes.find(ac => ac.judge_id === judge.id)
        return {
          ...judge,
          accessCode: accessRecord?.access_code || judge.accessCode,
          name: accessRecord?.judge_name || judge.name
        }
      })
    }

    return NextResponse.json(competitionData, { status: 200 })
  } catch (error) {
    console.error("Error loading competition data:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
