import { NextResponse } from "next/server"

export async function GET(request: Request) {
  try {
    // Forward the request to better-auth's /me endpoint
    const response = await fetch(`${process.env.BETTER_AUTH_URL}/api/auth/me`, {
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    })

    const status = response.status
    let data = null

    try {
      data = await response.json()
    } catch (e) {
      // If it's not JSON, get the text
      data = await response.text()
    }

    return NextResponse.json(
      {
        status,
        data,
        headers: Object.fromEntries(response.headers.entries()),
      },
      { status: 200 },
    )
  } catch (error) {
    console.error("Error checking better-auth /me endpoint:", error)
    return NextResponse.json(
      {
        error: "Internal server error",
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    )
  }
}

