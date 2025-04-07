import { NextResponse } from "next/server"
import { cookies } from "next/headers"
import jwt from "jsonwebtoken"

export async function GET() {
  try {
    // Get all cookies to see what's available
    const cookieStore = await cookies()
    const allCookies = cookieStore.getAll()

    console.log(
      "All cookies:",
      allCookies.map((c) => c.name),
    )

    // Check for better-auth session token
    const betterAuthToken = cookieStore.get("better-auth.session_token")?.value

    const result = {
      cookies: {
        available: allCookies.map((c) => ({
          name: c.name,
          value: c.name === "better-auth.session_token" ? "hidden" : c.value,
        })),
        betterAuthToken: betterAuthToken ? "present" : "missing",
      },
      token: { status: "not_checked" },
      environment: {
        JWT_SECRET: process.env.JWT_SECRET ? "set" : "missing",
        MYSQL_HOST: process.env.MYSQL_HOST ? "set" : "missing",
        MYSQL_DATABASE: process.env.MYSQL_DATABASE ? "set" : "missing",
      },
    }

    // Try to decode the better-auth token if present
    if (betterAuthToken) {
      try {
        const decoded = jwt.decode(betterAuthToken)
        result.token = {
          status: "decoded",
          payload: decoded,
        }

        // Try to verify with JWT_SECRET
        try {
          const verified = jwt.verify(betterAuthToken, process.env.JWT_SECRET as string)
          result.token.status = "verified_with_jwt_secret"
          result.token.verified = verified
        } catch (verifyError) {
          result.token.jwt_verify_error = verifyError instanceof Error ? verifyError.message : String(verifyError)
        }
      } catch (decodeError) {
        result.token.status = "decode_error"
        result.token.error = decodeError instanceof Error ? decodeError.message : String(decodeError)
      }
    }

    return NextResponse.json(result, { status: 200 })
  } catch (error) {
    console.error("Debug error:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

