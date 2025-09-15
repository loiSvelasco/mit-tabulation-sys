/**
 * Test script for new access code generation
 * This can be run to verify the new format works correctly
 */

// Test the new access code generation format
export function testAccessCodeGeneration() {
  console.log("Testing new access code generation...")
  
  // Test with competition ID
  const competitionId = 21
  const testCode = generateTestAccessCode(competitionId)
  console.log(`Competition ${competitionId} access code: ${testCode}`)
  
  // Test without competition ID (fallback)
  const fallbackCode = generateTestAccessCode(null)
  console.log(`Fallback access code: ${fallbackCode}`)
  
  // Test format validation
  const isValidFormat = /^\d+-[A-Z0-9]{6}$/.test(testCode)
  console.log(`Format validation: ${isValidFormat ? 'PASS' : 'FAIL'}`)
  
  return {
    withCompetitionId: testCode,
    withoutCompetitionId: fallbackCode,
    isValidFormat
  }
}

// Helper function to generate test access codes
function generateTestAccessCode(competitionId: number | null): string {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  
  if (competitionId) {
    return `${competitionId}-${result}`
  }
  
  return result
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testAccessCodeGeneration()
}
