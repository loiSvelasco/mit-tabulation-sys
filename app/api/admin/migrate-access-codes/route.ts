import { type NextRequest, NextResponse } from "next/server"
import { adminMiddleware } from "@/lib/auth"
import { migrateAccessCodes, validateAccessCodeFormat, getMigrationStatus } from "@/lib/access-code-migration"

/**
 * GET /api/admin/migrate-access-codes
 * Get migration status and validation results
 */
export async function GET(request: NextRequest) {
  // Check if user is admin
  const authCheck = await adminMiddleware(request)
  if (authCheck) {
    return authCheck
  }

  try {
    const [status, validation] = await Promise.all([
      getMigrationStatus(),
      validateAccessCodeFormat()
    ])

    return NextResponse.json({
      success: true,
      status,
      validation,
      message: status.needsMigration 
        ? "Migration needed" 
        : "All access codes are in the correct format"
    })
  } catch (error) {
    console.error("Error getting migration status:", error)
    return NextResponse.json(
      { success: false, message: "Failed to get migration status", error: String(error) },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/migrate-access-codes
 * Run the migration process
 */
export async function POST(request: NextRequest) {
  // Check if user is admin
  const authCheck = await adminMiddleware(request)
  if (authCheck) {
    return authCheck
  }

  try {
    console.log("Starting access code migration...")
    const result = await migrateAccessCodes()

    if (result.success) {
      return NextResponse.json({
        success: true,
        message: `Migration completed successfully. Migrated ${result.migrated} access codes.`,
        result
      })
    } else {
      return NextResponse.json({
        success: false,
        message: `Migration completed with errors. Migrated ${result.migrated} access codes.`,
        result
      }, { status: 400 })
    }
  } catch (error) {
    console.error("Error running migration:", error)
    return NextResponse.json(
      { success: false, message: "Migration failed", error: String(error) },
      { status: 500 }
    )
  }
}
