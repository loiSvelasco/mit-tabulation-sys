// app/api/auth-test/route.ts
import { NextRequest, NextResponse } from "next/server"
import { getCurrentUser } from "@/lib/auth"

export async function GET(request: NextRequest) {
  const user = await getCurrentUser(request)
  
  if (!user) {
    return NextResponse.json({ 
      authenticated: false,
      message: "No valid auth token found",
      cookies: request.cookies.getAll().map(c => c.name)
    }, { status: 401 })
  }
  
  return NextResponse.json({ 
    authenticated: true,
    userId: user.id,
    role: user.role
  })
}