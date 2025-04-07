import { NextResponse, type NextRequest } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { query } from "@/lib/db_config"
import { getCurrentUser } from "@/lib/auth"

export async function GET(
  request: NextRequest, 
  context: { params: Promise<{ id: string }> }
) {
  try {
    // Await the params object before destructuring
    const params = await context.params
    const id = params.id

    // Use getCurrentUser to authenticate the request
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json(
        { message: "Unauthorized - Authentication failed" },
        { status: 401 }
      )
    }

    const userId = user.id
    const competitionId = Number.parseInt(id)

    // Get competition details from database
    const competitions = await query("SELECT * FROM competitions WHERE id = ? AND created_by = ?", [
      competitionId,
      userId.toString(),
    ])

    if (!competitions.length) {
      return NextResponse.json({ message: "Competition not found" }, { status: 404 })
    }

    const competition = competitions[0]

    // Read the competition data file
    const filePath = path.join(process.cwd(), "data", competition.filename)
    const fileData = await fs.readFile(filePath, "utf8")

    // Parse the JSON data
    const competitionData = JSON.parse(fileData)

    return NextResponse.json(competitionData, { status: 200 })
  } catch (error) {
    console.error("Error loading competition data:", error)
    return NextResponse.json(
      { 
        message: "Internal server error",
        error: error instanceof Error ? error.message : String(error),
      }, 
      { status: 500 }
    )
  }
}