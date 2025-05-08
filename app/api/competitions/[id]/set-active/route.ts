import { NextResponse, type NextRequest } from "next/server"
import { query } from "@/lib/db_config"
import { getCurrentUser } from "@/lib/auth"

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    // Use getCurrentUser to authenticate the request
    const user = await getCurrentUser(request)

    if (!user) {
      return NextResponse.json({ message: "Unauthorized - Authentication failed" }, { status: 401 })
    }

    const userId = user.id

    // Get the ID directly from the URL instead of using params
    const pathParts = request.nextUrl.pathname.split("/")
    const idFromPath = pathParts[pathParts.length - 2] // Get the ID from the URL path

    if (!idFromPath) {
      return NextResponse.json({ error: "Missing competition ID" }, { status: 400 })
    }

    const competitionId = Number.parseInt(idFromPath)

    if (isNaN(competitionId)) {
      return NextResponse.json({ error: "Invalid competition ID" }, { status: 400 })
    }

    // First, set all competitions to inactive
    await query("UPDATE competitions SET is_active = 0 WHERE created_by = ?", [userId.toString()])

    // Then, set the selected competition to active
    await query("UPDATE competitions SET is_active = 1 WHERE id = ? AND created_by = ?", [
      competitionId,
      userId.toString(),
    ])

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error("Error setting competition as active:", error)
    return NextResponse.json({ error: "Failed to set competition as active" }, { status: 500 })
  }
}
