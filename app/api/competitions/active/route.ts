import { NextResponse } from "next/server"
import { query } from "@/lib/db_config"

export async function GET() {
  try {
    const result = await query(
      "SELECT id, name, filename, created_by, created_at FROM competitions WHERE is_active = TRUE LIMIT 1",
    )

    if (result.length === 0) {
      return NextResponse.json({ message: "No active competition found" }, { status: 404 })
    }

    return NextResponse.json(result[0])
  } catch (error) {
    console.error("Error fetching active competition:", error)
    return NextResponse.json({ message: "Internal server error" }, { status: 500 })
  }
}
