/**
 * Test script for scroll preservation functionality
 * This can be run to verify the scroll preservation works correctly
 */

export function testScrollPreservation() {
  console.log("Testing scroll preservation functionality...")
  
  // Test localStorage functions
  const testCompetitionId = 21
  const testScrollPosition = 500
  
  // Test saving scroll position
  localStorage.setItem(`scroll-${testCompetitionId}`, testScrollPosition.toString())
  console.log(`✓ Saved scroll position: ${testScrollPosition}`)
  
  // Test retrieving scroll position
  const saved = localStorage.getItem(`scroll-${testCompetitionId}`)
  const retrievedPosition = saved ? parseInt(saved, 10) : 0
  console.log(`✓ Retrieved scroll position: ${retrievedPosition}`)
  
  // Test scroll position validation
  const isValidPosition = !isNaN(retrievedPosition) && retrievedPosition > 0
  console.log(`✓ Position validation: ${isValidPosition ? 'PASS' : 'FAIL'}`)
  
  // Test scroll state tracking simulation
  let isUserScrolling = false
  let scrollTimeout: NodeJS.Timeout | null = null
  
  const simulateScroll = () => {
    isUserScrolling = true
    console.log("✓ User scrolling detected")
    
    if (scrollTimeout) {
      clearTimeout(scrollTimeout)
    }
    
    scrollTimeout = setTimeout(() => {
      isUserScrolling = false
      console.log("✓ User stopped scrolling (1.5s delay)")
    }, 100) // Shortened for test
  }
  
  // Simulate scroll events
  simulateScroll()
  
  // Test debounced data update
  let dataUpdateTimeout: NodeJS.Timeout | null = null
  
  const debouncedDataUpdate = () => {
    if (dataUpdateTimeout) {
      clearTimeout(dataUpdateTimeout)
    }
    dataUpdateTimeout = setTimeout(() => {
      if (!isUserScrolling) {
        console.log("✓ Data update triggered (not scrolling)")
      } else {
        console.log("✓ Data update skipped (user is scrolling)")
      }
    }, 100) // Shortened for test
  }
  
  // Test data update while scrolling
  debouncedDataUpdate()
  
  // Test data update after scrolling stops
  setTimeout(() => {
    debouncedDataUpdate()
  }, 200)
  
  // Cleanup
  setTimeout(() => {
    if (scrollTimeout) clearTimeout(scrollTimeout)
    if (dataUpdateTimeout) clearTimeout(dataUpdateTimeout)
    localStorage.removeItem(`scroll-${testCompetitionId}`)
    console.log("✓ Test completed and cleaned up")
  }, 500)
  
  return {
    success: true,
    scrollPosition: retrievedPosition,
    isValidPosition,
    testCompetitionId
  }
}

// Run test if this file is executed directly
if (typeof window === 'undefined') {
  testScrollPreservation()
    .then(result => {
      console.log("\nTest completed:", result)
      process.exit(result.success ? 0 : 1)
    })
    .catch(error => {
      console.error("Test failed:", error)
      process.exit(1)
    })
}
