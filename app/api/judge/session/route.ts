import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import { verifyToken, createToken } from "@/lib/auth"

export async function GET() {
  try {
    const cookieStore = await cookies()
    const token = cookieStore.get("auth-token")?.value

    if (!token) {
      return NextResponse.json({ user: null })
    }

    const user = await verifyToken(token)

    // Add console log to debug
    console.log("User from token:", user)

    if (!user) {
      return NextResponse.json({ user: null })
    }

    // Check if token is close to expiration (less than 30 minutes left)
    const now = Math.floor(Date.now() / 1000)
    const tokenExpiration = user.exp || 0
    const timeLeft = tokenExpiration - now

    // If token is close to expiration (less than 30 minutes), refresh it
    if (timeLeft < 30 * 60 && timeLeft > 0) {
      // Create a new token
      const newToken = createToken({
        id: user.id,
        name: user.name,
        role: user.role,
        competitionId: user.competitionId,
      })

      // Set the new token in cookies
      cookies().set({
        name: "auth-token",
        value: newToken,
        httpOnly: true,
        path: "/",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24 * 7, // 7 days
      })
    }

    // Return the user info and competition ID
    return NextResponse.json({
      user,
      competitionId: user.competitionId,
    })
  } catch (error) {
    console.error("Error getting judge session:", error)
    return NextResponse.json({ user: null, error: "Failed to get session" }, { status: 500 })
  }
}
