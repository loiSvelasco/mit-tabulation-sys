/**
 * Test script for competition context display
 * This can be run to verify the competition context detection works correctly
 */

// Test the competition context detection function
export function testCompetitionContextDetection() {
  console.log("Testing competition context detection...")
  
  const testCases = [
    { input: "21-ABC123", expected: { competitionId: "21", judgeCode: "ABC123" } },
    { input: "5-XYZ789", expected: { competitionId: "5", judgeCode: "XYZ789" } },
    { input: "ABC123", expected: null },
    { input: "21-", expected: null },
    { input: "-ABC123", expected: null },
    { input: "21-ABC-123", expected: { competitionId: "21", judgeCode: "ABC" } },
  ]

  console.log("\nTest Results:")
  testCases.forEach((testCase, index) => {
    const result = detectCompetitionContext(testCase.input)
    const passed = JSON.stringify(result) === JSON.stringify(testCase.expected)
    
    console.log(`Test ${index + 1}: ${passed ? 'PASS' : 'FAIL'}`)
    console.log(`  Input: "${testCase.input}"`)
    console.log(`  Expected: ${JSON.stringify(testCase.expected)}`)
    console.log(`  Got: ${JSON.stringify(result)}`)
    console.log('')
  })

  return testCases.every((testCase, index) => {
    const result = detectCompetitionContext(testCase.input)
    return JSON.stringify(result) === JSON.stringify(testCase.expected)
  })
}

// Helper function to detect competition context from access code
function detectCompetitionContext(code: string) {
  if (code.includes('-')) {
    const [competitionId, judgeCode] = code.split('-', 2)
    const competitionIdNum = parseInt(competitionId, 10)
    
    if (!isNaN(competitionIdNum) && judgeCode) {
      return {
        competitionId: competitionId,
        competitionName: `Competition ${competitionId}`,
        judgeCode: judgeCode
      }
    }
  }
  return null
}

// Test access code format validation
export function testAccessCodeFormat() {
  console.log("Testing access code format validation...")
  
  const validFormats = [
    "21-ABC123",
    "5-XYZ789", 
    "100-DEF456"
  ]
  
  const invalidFormats = [
    "ABC123",
    "21-",
    "-ABC123",
    "21-ABC-123",
    "not-a-code"
  ]

  console.log("\nValid Format Tests:")
  validFormats.forEach(code => {
    const isValid = /^\d+-[A-Z0-9]{6}$/.test(code)
    console.log(`  ${code}: ${isValid ? 'PASS' : 'FAIL'}`)
  })

  console.log("\nInvalid Format Tests:")
  invalidFormats.forEach(code => {
    const isValid = /^\d+-[A-Z0-9]{6}$/.test(code)
    console.log(`  ${code}: ${!isValid ? 'PASS' : 'FAIL'}`)
  })

  return {
    validFormats: validFormats.every(code => /^\d+-[A-Z0-9]{6}$/.test(code)),
    invalidFormats: invalidFormats.every(code => !/^\d+-[A-Z0-9]{6}$/.test(code))
  }
}

// Run tests if this file is executed directly
if (typeof window === 'undefined') {
  const contextTest = testCompetitionContextDetection()
  const formatTest = testAccessCodeFormat()
  
  console.log("\nOverall Results:")
  console.log(`Competition Context Detection: ${contextTest ? 'PASS' : 'FAIL'}`)
  console.log(`Access Code Format Validation: ${formatTest.validFormats && formatTest.invalidFormats ? 'PASS' : 'FAIL'}`)
  
  process.exit(contextTest && formatTest.validFormats && formatTest.invalidFormats ? 0 : 1)
}
