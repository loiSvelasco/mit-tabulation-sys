import { NextResponse, type NextRequest } from "next/server"
import { promises as fs } from "fs"
import path from "path"
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

    // Check if we're updating an existing competition
    if (competitionId) {
      // Get the existing competition to check ownership and get the filename
      const existingCompetitions = await query("SELECT * FROM competitions WHERE id = ? AND created_by = ?", [
        competitionId,
        userId.toString(),
      ])

      if (!existingCompetitions.length) {
        return NextResponse.json({ message: "Competition not found or not owned by you" }, { status: 404 })
      }

      const existingCompetition = existingCompetitions[0]
      const filename = existingCompetition.filename

      // Update the file with new data
      const dataDir = path.join(process.cwd(), "data")
      await fs.writeFile(path.join(dataDir, filename), JSON.stringify(competitionData, null, 2))

      // Update the competition in the database
      await query("UPDATE competitions SET name = ?, is_active = ? WHERE id = ?", [
        competitionName,
        activeStatus,
        competitionId,
      ])

      return NextResponse.json(
        {
          id: competitionId,
          name: competitionName,
          filename,
          message: "Competition updated successfully",
        },
        { status: 200 },
      )
    } else {
      // Create a new competition (existing code)
      // Generate filename
      const timestamp = Date.now()
      const filename = `competition_${competitionName.trim()}_${timestamp}.json`

      // Ensure data directory exists
      const dataDir = path.join(process.cwd(), "data")
      await fs.mkdir(dataDir, { recursive: true })

      // Save competition data to file
      await fs.writeFile(path.join(dataDir, filename), JSON.stringify(competitionData, null, 2))

      // Save competition to database
      const result = await query(
        "INSERT INTO competitions (name, filename, created_by, is_active) VALUES (?, ?, ?, ?)",
        [competitionName, filename, userId.toString(), activeStatus],
      )

      return NextResponse.json(
        {
          id: result.insertId,
          name: competitionName,
          filename,
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

// Add or fix the GET method
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
      `SELECT id, name, filename, created_at, is_active 
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

