/**
 * Test script for database queries with new access code format
 * This can be run to verify the database integration works correctly
 */

import { query } from "./db_config"

export async function testDatabaseQueries() {
  console.log("Testing database queries with new access code format...")
  
  try {
    // Test 1: Check current access codes in database
    console.log("\n1. Checking current access codes...")
    const allCodes = await query(`
      SELECT id, judge_id, competition_id, access_code, judge_name, is_active
      FROM judge_competition_access
      ORDER BY competition_id, judge_id
    `) as any[]
    
    console.log(`Found ${allCodes.length} access codes:`)
    allCodes.forEach(record => {
      const format = /^\d+-[A-Z0-9]{6}$/.test(record.access_code) ? 'NEW' : 'OLD'
      console.log(`  ${record.competition_id}: ${record.access_code} (${format}) - ${record.judge_name}`)
    })

    // Test 2: Test exact match query (new format)
    console.log("\n2. Testing exact match query...")
    const testNewCode = "21-ABC123"
    const exactMatch = await query(`
      SELECT * FROM judge_competition_access 
      WHERE access_code = ? AND is_active = TRUE
    `, [testNewCode]) as any[]
    
    console.log(`Exact match for ${testNewCode}: ${exactMatch.length} results`)

    // Test 3: Test fallback query (competition ID + partial code)
    console.log("\n3. Testing fallback query...")
    const testCompetitionId = 21
    const testCodePart = "ABC123"
    const fallbackMatch = await query(`
      SELECT * FROM judge_competition_access 
      WHERE competition_id = ? AND access_code LIKE ? AND is_active = TRUE
    `, [testCompetitionId, `%${testCodePart}`]) as any[]
    
    console.log(`Fallback match for competition ${testCompetitionId} with code part ${testCodePart}: ${fallbackMatch.length} results`)

    // Test 4: Test format validation
    console.log("\n4. Testing format validation...")
    const formatValidation = await query(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN access_code REGEXP '^[0-9]+-[A-Z0-9]{6}$' THEN 1 ELSE 0 END) as new_format,
        SUM(CASE WHEN access_code NOT REGEXP '^[0-9]+-[A-Z0-9]{6}$' THEN 1 ELSE 0 END) as old_format
      FROM judge_competition_access
    `) as any[]
    
    const stats = formatValidation[0]
    console.log(`Format validation results:`)
    console.log(`  Total records: ${stats.total}`)
    console.log(`  New format: ${stats.new_format}`)
    console.log(`  Old format: ${stats.old_format}`)

    return {
      success: true,
      totalCodes: allCodes.length,
      exactMatchResults: exactMatch.length,
      fallbackMatchResults: fallbackMatch.length,
      formatStats: stats
    }

  } catch (error) {
    console.error("Database query test failed:", error)
    return {
      success: false,
      error: String(error)
    }
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testDatabaseQueries()
    .then(result => {
      console.log("\nTest completed:", result)
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error("Test failed:", error)
      process.exit(1)
    })
}
