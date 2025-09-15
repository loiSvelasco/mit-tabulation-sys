/**
 * Access Code Migration Utilities
 * Handles migration of existing access codes to the new format with competition ID prefix
 */

import { query } from "./db_config"

export interface AccessCodeMigrationResult {
  success: boolean
  migrated: number
  errors: string[]
  details: {
    oldFormat: number
    newFormat: number
    updated: number
  }
}

/**
 * Migrates existing access codes to include competition ID prefix
 * Only migrates codes that don't already have the new format
 */
export async function migrateAccessCodes(): Promise<AccessCodeMigrationResult> {
  const result: AccessCodeMigrationResult = {
    success: false,
    migrated: 0,
    errors: [],
    details: {
      oldFormat: 0,
      newFormat: 0,
      updated: 0
    }
  }

  try {
    console.log("Starting access code migration...")

    // Get all judge access records
    const allRecords = await query(`
      SELECT id, judge_id, competition_id, access_code, judge_name, is_active
      FROM judge_competition_access
      ORDER BY competition_id, judge_id
    `) as any[]

    console.log(`Found ${allRecords.length} judge access records to check`)

    // Categorize records by format
    const oldFormatRecords = allRecords.filter(record => 
      !record.access_code.includes('-') || 
      !/^\d+-[A-Z0-9]{6}$/.test(record.access_code)
    )

    const newFormatRecords = allRecords.filter(record => 
      /^\d+-[A-Z0-9]{6}$/.test(record.access_code)
    )

    result.details.oldFormat = oldFormatRecords.length
    result.details.newFormat = newFormatRecords.length

    console.log(`Found ${oldFormatRecords.length} records with old format`)
    console.log(`Found ${newFormatRecords.length} records with new format`)

    // Migrate old format records
    for (const record of oldFormatRecords) {
      try {
        const newAccessCode = generateNewAccessCode(record.competition_id, record.access_code)
        
        await query(`
          UPDATE judge_competition_access 
          SET access_code = ?
          WHERE id = ?
        `, [newAccessCode, record.id])

        console.log(`Migrated: ${record.access_code} -> ${newAccessCode}`)
        result.migrated++
        result.details.updated++
      } catch (error) {
        const errorMsg = `Failed to migrate record ${record.id}: ${error}`
        console.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }

    result.success = result.errors.length === 0

    console.log(`Migration completed. Migrated: ${result.migrated}, Errors: ${result.errors.length}`)
    return result

  } catch (error) {
    const errorMsg = `Migration failed: ${error}`
    console.error(errorMsg)
    result.errors.push(errorMsg)
    return result
  }
}

/**
 * Generates a new access code with competition ID prefix
 * Preserves the original random part if it's valid, otherwise generates new one
 */
function generateNewAccessCode(competitionId: number, oldAccessCode: string): string {
  // Check if the old code already has a valid random part (6 characters)
  const randomPartMatch = oldAccessCode.match(/[A-Z0-9]{6}$/)
  
  if (randomPartMatch) {
    // Use the existing random part
    return `${competitionId}-${randomPartMatch[0]}`
  } else {
    // Generate new random part
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    let randomPart = ""
    for (let i = 0; i < 6; i++) {
      randomPart += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return `${competitionId}-${randomPart}`
  }
}

/**
 * Validates that all access codes in the database have the correct format
 */
export async function validateAccessCodeFormat(): Promise<{
  valid: number
  invalid: number
  invalidRecords: any[]
}> {
  try {
    const allRecords = await query(`
      SELECT id, judge_id, competition_id, access_code, judge_name
      FROM judge_competition_access
    `) as any[]

    const invalidRecords = allRecords.filter(record => 
      !/^\d+-[A-Z0-9]{6}$/.test(record.access_code)
    )

    return {
      valid: allRecords.length - invalidRecords.length,
      invalid: invalidRecords.length,
      invalidRecords
    }
  } catch (error) {
    console.error("Error validating access code format:", error)
    throw error
  }
}

/**
 * Gets migration status and statistics
 */
export async function getMigrationStatus(): Promise<{
  totalRecords: number
  oldFormat: number
  newFormat: number
  needsMigration: boolean
}> {
  try {
    const allRecords = await query(`
      SELECT access_code FROM judge_competition_access
    `) as any[]

    const oldFormat = allRecords.filter(record => 
      !/^\d+-[A-Z0-9]{6}$/.test(record.access_code)
    ).length

    const newFormat = allRecords.length - oldFormat

    return {
      totalRecords: allRecords.length,
      oldFormat,
      newFormat,
      needsMigration: oldFormat > 0
    }
  } catch (error) {
    console.error("Error getting migration status:", error)
    throw error
  }
}
