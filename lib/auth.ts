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
  iat?: number
  exp?: number
}

export const auth = betterAuth({
  database: createPool({
    host: process.env.MYSQL_HOST,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE,
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

// Get the current user from the request
// export async function getCurrentUser(req: NextRequest) {
//   const cookieStore = await cookies()
//   const token = cookieStore.get("better-auth.session_token")?.value

//   if (!token) {
//     return null
//   }

//   return await verifyToken(token)
// }

// Modified getCurrentUser function for auth.ts
export async function getCurrentUser(req: NextRequest) {
  const cookieStore = await cookies()
  
  // Look for the BetterAuth session token instead of auth-token
  const token = cookieStore.get("better-auth.session_token")?.value
  
  if (!token) {
    return null
  }
  
  // You'll need to modify this part to work with BetterAuth's token format
  // BetterAuth likely has its own way to verify the session
  
  // For now, let's try to use your existing auth handler
  try {
    // Use BetterAuth's session verification instead of your custom JWT verification
    const session = await auth.api.getSession({
      headers: await headers()
    })
    
    if (!session || !session.user) {
      return null
    }
    
    // Return the user data from the session
    return {
      id: session.user.id,
      email: session.user.email,
      role: session.user.role || 'user',
      // Add other fields as needed
    }
  } catch (error) {
    console.error("Session verification error:", error)
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

