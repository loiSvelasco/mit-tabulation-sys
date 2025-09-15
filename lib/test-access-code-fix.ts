/**
 * Test script to verify access code fix
 * This tests that the competition data API returns actual access codes from database
 */

export async function testAccessCodeFix(competitionId: number) {
  console.log(`Testing access code fix for competition ${competitionId}...`)
  
  try {
    // Test the competition data API
    const response = await fetch(`/api/competitions/${competitionId}/data`)
    
    if (!response.ok) {
      throw new Error(`API request failed: ${response.status} ${response.statusText}`)
    }
    
    const competitionData = await response.json()
    
    console.log("Competition data received:")
    console.log(`- Competition name: ${competitionData.competitionSettings?.name || 'N/A'}`)
    console.log(`- Number of judges: ${competitionData.judges?.length || 0}`)
    
    if (competitionData.judges && Array.isArray(competitionData.judges)) {
      console.log("\nJudge access codes:")
      competitionData.judges.forEach((judge: any, index: number) => {
        console.log(`  ${index + 1}. ${judge.name} (${judge.id}): ${judge.accessCode}`)
        
        // Check if access code has the new format
        if (judge.accessCode && judge.accessCode.includes('-')) {
          const [compId, code] = judge.accessCode.split('-', 2)
          console.log(`     ✓ New format detected: Competition ${compId}, Code ${code}`)
        } else if (judge.accessCode && judge.accessCode !== 'TEMP-' + judge.accessCode) {
          console.log(`     ⚠ Old format: ${judge.accessCode}`)
        } else {
          console.log(`     ✗ Invalid or missing access code`)
        }
      })
    }
    
    // Test the debug API to see raw database values
    const debugResponse = await fetch(`/api/debug/judge-access?competitionId=${competitionId}`)
    if (debugResponse.ok) {
      const debugData = await debugResponse.json()
      console.log("\nRaw database access codes:")
      debugData.results.forEach((record: any, index: number) => {
        console.log(`  ${index + 1}. Judge ${record.judge_id}: ${record.access_code} (${record.judge_name})`)
      })
    }
    
    return {
      success: true,
      competitionData,
      judgesCount: competitionData.judges?.length || 0
    }
    
  } catch (error) {
    console.error("Test failed:", error)
    return {
      success: false,
      error: String(error)
    }
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  const competitionId = process.argv[2] ? parseInt(process.argv[2], 10) : 21
  
  if (isNaN(competitionId)) {
    console.error("Please provide a valid competition ID as an argument")
    console.log("Usage: node test-access-code-fix.js <competitionId>")
    process.exit(1)
  }
  
  testAccessCodeFix(competitionId)
    .then(result => {
      console.log("\nTest completed:", result.success ? "PASS" : "FAIL")
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error("Test failed:", error)
      process.exit(1)
    })
}
