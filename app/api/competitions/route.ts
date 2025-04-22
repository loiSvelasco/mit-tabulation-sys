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
    console.log("User ID:", userId, "Type:", typeof userId)

    const body = await request.json()
    const { competitionData, name, isActive, competitionId } = body

    // Use provided name or extract from competition settings
    const competitionName = name || competitionData.competitionSettings.name || "Untitled Competition"
    const activeStatus = isActive !== undefined ? isActive : false

    console.log("API: Request to save competition. Competition ID:", competitionId, "Name:", competitionName)

    // Convert competition data to JSON string for storage
    const competitionDataJson = JSON.stringify(competitionData)

    // Check if we're updating an existing competition
    if (competitionId) {
      console.log("API: Updating existing competition with ID:", competitionId)

      // Get the existing competition to check ownership
      const existingCompetitions = await query("SELECT * FROM competitions WHERE id = ? AND created_by = ?", [
        competitionId,
        userId.toString(),
      ])

      if (!existingCompetitions.length) {
        return NextResponse.json({ message: "Competition not found or not owned by you" }, { status: 404 })
      }

      // Update the competition in the database with the full data
      await query("UPDATE competitions SET name = ?, is_active = ?, competition_data = ? WHERE id = ?", [
        competitionName,
        activeStatus,
        competitionDataJson,
        competitionId,
      ])

      return NextResponse.json(
        {
          id: competitionId,
          name: competitionName,
          message: "Competition updated successfully",
        },
        { status: 200 },
      )
    } else {
      // Create a new competition
      console.log("API: Creating a new competition with name:", competitionName)

      // Save competition directly to database
      const result = await query(
        "INSERT INTO competitions (name, created_by, is_active, competition_data) VALUES (?, ?, ?, ?)",
        [competitionName, userId.toString(), activeStatus, competitionDataJson],
      )

      console.log("API: New competition created with ID:", result.insertId)

      return NextResponse.json(
        {
          id: result.insertId,
          name: competitionName,
          message: "Competition saved successfully",
        },
        { status: 201 },
      )
    }
  } catch (error) {
    console.error("Error saving competition:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

// GET method to list competitions
export async function GET(request: NextRequest) {
  try {
    // Use getCurrentUser to authenticate the request
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ message: "Unauthorized - Authentication failed" }, { status: 401 })
    }

    const userId = user.id
    console.log("User ID:", userId)

    // Get all competitions for the current user
    const competitions = await query(
      `SELECT id, name, created_at, is_active 
       FROM competitions 
       WHERE created_by = ? 
       ORDER BY created_at DESC`,
      [userId.toString()],
    )

    return NextResponse.json(competitions, { status: 200 })
  } catch (error) {
    console.error("Error fetching competitions:", error)
    return NextResponse.json(
      {
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}
