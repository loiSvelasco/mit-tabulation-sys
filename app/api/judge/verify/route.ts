import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db_config"
import { sign } from "jsonwebtoken"

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { accessCode } = body

    if (!accessCode) {
      return NextResponse.json({ success: false, message: "Access code is required" }, { status: 400 })
    }

    // Find the judge access record - make sure we're selecting judge_name
    // Support both old format (ABC123) and new format (21-ABC123)
    const judgeAccess = (await query(
      `SELECT * FROM judge_competition_access 
       WHERE access_code = ? AND is_active = TRUE`,
      [accessCode],
    )) as any[]

    // If not found with exact match, try to find by extracting competition ID from new format
    let foundRecord = judgeAccess[0]
    
    if (!foundRecord && accessCode.includes('-')) {
      const [competitionIdPart, codePart] = accessCode.split('-', 2)
      const competitionId = parseInt(competitionIdPart, 10)
      
      if (!isNaN(competitionId) && codePart) {
        // Try to find by competition ID and code part
        const fallbackAccess = (await query(
          `SELECT * FROM judge_competition_access 
           WHERE competition_id = ? AND access_code LIKE ? AND is_active = TRUE`,
          [competitionId, `%${codePart}`],
        )) as any[]
        
        if (fallbackAccess.length > 0) {
          foundRecord = fallbackAccess[0]
          console.log(`Found judge using fallback search for competition ${competitionId}`)
        }
      }
    }

    if (!foundRecord) {
      return NextResponse.json({ success: false, message: "Invalid access code" }, { status: 401 })
    }

    const judgeRecord = foundRecord

    // Add console log to debug
    console.log("Judge record from database:", judgeRecord)

    // Create a token with judge info and competition ID
    const token = sign(
      {
        id: judgeRecord.judge_id,
        name: judgeRecord.judge_name || `Judge ${judgeRecord.judge_id}`, // Use name if available, otherwise use ID
        role: "judge",
        competitionId: judgeRecord.competition_id,
      },
      process.env.JWT_SECRET as string,
      { expiresIn: "8h" },
    )

    // Create the response
    const response = NextResponse.json({
      success: true,
      message: "Authentication successful",
      judgeId: judgeRecord.judge_id,
      judgeName: judgeRecord.judge_name || `Judge ${judgeRecord.judge_id}`,
      competitionId: judgeRecord.competition_id,
    })

    // Set the cookie on the response object directly
    response.cookies.set({
      name: "auth-token",
      value: token,
      httpOnly: true,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 8, // 8 hours
    })

    return response
  } catch (error) {
    console.error("Error verifying judge:", error)
    return NextResponse.json(
      { success: false, message: "Authentication failed", error: (error as Error).message },
      { status: 500 },
    )
  }
}
