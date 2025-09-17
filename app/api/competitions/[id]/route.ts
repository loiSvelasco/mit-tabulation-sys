import { NextResponse, type NextRequest } from "next/server"
import { query, executeTransaction } from "@/lib/db_config"
import { getCurrentUser } from "@/lib/auth"

// DELETE /api/competitions/[id] - Delete a competition and all related data
export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate the user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized - Authentication failed" }, { status: 401 })
    }

    const userId = user.id
    const { id } = await params
    const competitionId = parseInt(id, 10)

    if (isNaN(competitionId)) {
      return NextResponse.json({ message: "Invalid competition ID" }, { status: 400 })
    }

    // Verify the competition exists and belongs to the user
    const existingCompetitions = await query(
      "SELECT id, name FROM competitions WHERE id = ? AND created_by = ?",
      [competitionId, userId.toString()]
    ) as any[]

    if (!existingCompetitions.length) {
      return NextResponse.json({ message: "Competition not found or not owned by you" }, { status: 404 })
    }

    const competition = existingCompetitions[0]

    // Use the transaction helper to ensure all deletions succeed or none do
    await executeTransaction(async (connection) => {
      // Delete all related data in the correct order (respecting foreign key constraints)
      
      // 1. Delete scores for this competition
      await connection.query("DELETE FROM scores WHERE competition_id = ?", [competitionId])
      console.log(`Deleted scores for competition ${competitionId}`)

      // 2. Delete judge access codes for this competition
      await connection.query("DELETE FROM judge_competition_access WHERE competition_id = ?", [competitionId])
      console.log(`Deleted judge access codes for competition ${competitionId}`)

      // 3. Delete the competition itself
      await connection.query("DELETE FROM competitions WHERE id = ? AND created_by = ?", [competitionId, userId.toString()])
      console.log(`Deleted competition ${competitionId}: ${competition.name}`)
    })

    return NextResponse.json(
      {
        success: true,
        message: `Competition "${competition.name}" deleted successfully`,
        deletedCompetition: {
          id: competitionId,
          name: competition.name
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error deleting competition:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to delete competition",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// PATCH /api/competitions/[id] - Update competition name and basic details
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate the user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized - Authentication failed" }, { status: 401 })
    }

    const userId = user.id
    const { id } = await params
    const competitionId = parseInt(id, 10)

    if (isNaN(competitionId)) {
      return NextResponse.json({ message: "Invalid competition ID" }, { status: 400 })
    }

    // Parse the request body
    const body = await request.json()
    const { name, isActive } = body

    // Validate input
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ message: "Competition name is required" }, { status: 400 })
    }

    const trimmedName = name.trim()

    // Verify the competition exists and belongs to the user
    const existingCompetitions = await query(
      "SELECT id, name, is_active FROM competitions WHERE id = ? AND created_by = ?",
      [competitionId, userId.toString()]
    ) as any[]

    if (!existingCompetitions.length) {
      return NextResponse.json({ message: "Competition not found or not owned by you" }, { status: 404 })
    }

    const existingCompetition = existingCompetitions[0]

    // If setting as active, first deactivate all other competitions
    if (isActive === true) {
      await query("UPDATE competitions SET is_active = 0 WHERE created_by = ? AND id != ?", [
        userId.toString(),
        competitionId
      ])
      console.log(`Deactivated all other competitions for user ${userId}`)
    }

    // Update the competition
    const updateResult = await query(
      "UPDATE competitions SET name = ?, is_active = ? WHERE id = ? AND created_by = ?",
      [
        trimmedName,
        isActive !== undefined ? (isActive ? 1 : 0) : existingCompetition.is_active,
        competitionId,
        userId.toString()
      ]
    )

    if (updateResult.affectedRows === 0) {
      return NextResponse.json({ message: "No changes made to competition" }, { status: 400 })
    }

    // Fetch the updated competition
    const updatedCompetitions = await query(
      "SELECT id, name, is_active, created_at FROM competitions WHERE id = ? AND created_by = ?",
      [competitionId, userId.toString()]
    ) as any[]

    const updatedCompetition = updatedCompetitions[0]

    return NextResponse.json(
      {
        success: true,
        message: "Competition updated successfully",
        competition: {
          id: updatedCompetition.id,
          name: updatedCompetition.name,
          is_active: updatedCompetition.is_active === 1,
          created_at: updatedCompetition.created_at
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error updating competition:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to update competition",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

// GET /api/competitions/[id] - Get single competition details
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    // Authenticate the user
    const user = await getCurrentUser(request)
    if (!user) {
      return NextResponse.json({ message: "Unauthorized - Authentication failed" }, { status: 401 })
    }

    const userId = user.id
    const { id } = await params
    const competitionId = parseInt(id, 10)

    if (isNaN(competitionId)) {
      return NextResponse.json({ message: "Invalid competition ID" }, { status: 400 })
    }

    // Get competition details
    const competitions = await query(
      `SELECT id, name, is_active, created_at, 
              (SELECT COUNT(*) FROM scores WHERE competition_id = ?) as score_count,
              (SELECT COUNT(*) FROM judge_competition_access WHERE competition_id = ?) as judge_count
       FROM competitions 
       WHERE id = ? AND created_by = ?`,
      [competitionId, competitionId, competitionId, userId.toString()]
    ) as any[]

    if (!competitions.length) {
      return NextResponse.json({ message: "Competition not found or not owned by you" }, { status: 404 })
    }

    const competition = competitions[0]

    return NextResponse.json(
      {
        success: true,
        competition: {
          id: competition.id,
          name: competition.name,
          is_active: competition.is_active === 1,
          created_at: competition.created_at,
          score_count: competition.score_count,
          judge_count: competition.judge_count
        }
      },
      { status: 200 }
    )

  } catch (error) {
    console.error("Error fetching competition:", error)
    return NextResponse.json(
      {
        success: false,
        message: "Failed to fetch competition",
        error: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}
