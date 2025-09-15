import { NextResponse } from "next/server"
import { query } from "@/lib/db_config"

/**
 * Health check endpoint
 * Returns system status and connectivity information
 */
export async function GET() {
  try {
    // Check database connectivity
    const dbStart = Date.now()
    await query("SELECT 1 as health_check")
    const dbLatency = Date.now() - dbStart
    
    return NextResponse.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: true,
        latency: `${dbLatency}ms`
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    })
  } catch (error) {
    console.error("Health check failed:", error)
    
    return NextResponse.json({
      status: "unhealthy",
      timestamp: new Date().toISOString(),
      database: {
        connected: false,
        error: error instanceof Error ? error.message : String(error)
      },
      server: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        version: process.version
      }
    }, { status: 503 })
  }
}
