import { betterAuth } from "better-auth"
import { admin } from "better-auth/plugins/admin"
import { createPool } from "mysql2/promise"
import jwt from "jsonwebtoken"
import { cookies, headers } from "next/headers"
import { type NextRequest, NextResponse } from "next/server"

// Interface for the JWT payload
export interface TokenPayload {
  id: number
  username?: string
  email?: string
  role?: string
  name?: string
  competitionId?: number // Add competitionId to the token payload
  iat?: number
  exp?: number
}

export const auth = betterAuth({
  database: createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
    port: process.env.MYSQL_PORT,
  }),

  emailAndPassword: {
    enabled: true,
    autoSignIn: false, //defaults to true
    async sendResetPassword(data, request) {
      // Send an email to the user with a link to reset their password
    },
  },

  plugins: [admin()],

  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day (every 1 day the session expiration is updated)
  },
})

// Verify a JWT token and return the payload if valid
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    // Verify the token using the JWT_SECRET environment variable
    const decoded = jwt.verify(token, process.env.JWT_SECRET as string) as TokenPayload

    // Add console log to debug
    console.log("Decoded token:", decoded)

    if (!decoded || !decoded.id) {
      return null
    }

    return decoded
  } catch (error) {
    console.error("Token verification error:", error)
    return null
  }
}

// Create a JWT token for a user
export function createToken(payload: Omit<TokenPayload, "iat" | "exp">): string {
  return jwt.sign(payload, process.env.JWT_SECRET as string, {
    expiresIn: "7d", // Token expires in 7 days
  })
}

// Modified getCurrentUser function with improved debugging and error handling
export async function getCurrentUser(req: NextRequest) {
  try {
    console.log("getCurrentUser called")

    // TEMPORARY BYPASS FOR TESTING
    // This allows the application to work while we sort out authentication issues
    if (process.env.ALLOW_TEST_USER === "true") {
      console.log("Using test user bypass")
      return {
        id: "test-user",
        email: "test@example.com",
        role: "admin",
      }
    }

    // Log all cookies for debugging
    const cookieHeader = req.headers.get("cookie")
    console.log("Cookie header:", cookieHeader)

    // Try to get cookies using Next.js cookies() API
    let token
    try {
      const cookieStore = cookies()

      // Check for both regular and __Secure- prefixed cookie names
      token =
        cookieStore.get("better-auth.session_token")?.value ||
        cookieStore.get("__Secure-better-auth.session_token")?.value

      console.log("Token from cookies() API:", token ? "Found" : "Not found")
    } catch (error) {
      console.error("Error accessing cookies() API:", error)
    }

    // If token not found via cookies() API, try to parse from cookie header
    if (!token && cookieHeader) {
      const cookies = cookieHeader.split(";").map((c) => c.trim())

      // Check for both regular and __Secure- prefixed cookie names
      const sessionCookie = cookies.find(
        (c) => c.startsWith("better-auth.session_token=") || c.startsWith("__Secure-better-auth.session_token="),
      )

      if (sessionCookie) {
        token = sessionCookie.split("=")[1]
        console.log("Token from cookie header:", token ? "Found" : "Not found")
      }
    }

    if (!token) {
      console.log("No session token found in cookies")
      return null
    }

    // Try to get the session using better-auth
    try {
      console.log("Attempting to get session with better-auth")
      const headersList = headers()
      console.log("Headers available:", Array.from(headersList.keys()))

      const session = await auth.api.getSession({
        headers: headersList,
      })

      console.log("Session result:", session ? "Session found" : "No session found")

      if (!session || !session.user) {
        console.log("No user in session")
        return null
      }

      console.log("User found in session:", session.user.id)

      // Return the user data from the session
      return {
        id: session.user.id,
        email: session.user.email,
        role: session.user.role || "user",
        // Add other fields as needed
      }
    } catch (error) {
      console.error("Error getting session with better-auth:", error)
      return null
    }
  } catch (error) {
    console.error("Unexpected error in getCurrentUser:", error)
    return null
  }
}

// Middleware to protect routes that require authentication
export async function authMiddleware(req: NextRequest) {
  const user = await getCurrentUser(req)

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  return null // Continue to the route handler if authenticated
}

// Middleware to protect routes that require admin role
export async function adminMiddleware(req: NextRequest) {
  const user = await getCurrentUser(req)

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "admin") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  return null // Continue to the route handler if admin
}

// Middleware to protect routes that require judge role
export async function judgeMiddleware(req: NextRequest) {
  const user = await getCurrentUser(req)

  if (!user) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
  }

  if (user.role !== "judge") {
    return NextResponse.json({ message: "Forbidden" }, { status: 403 })
  }

  return null // Continue to the route handler if judge
}

// Export the auth client for use in components
export const authClient = auth.client
