/**
 * Unified competition selection management
 * Ensures consistent competition selection across all routes
 */

const SELECTED_COMPETITION_KEY = 'selected-competition-id'
const COMPETITION_SELECTION_TIMESTAMP_KEY = 'competition-selection-timestamp'

export interface CompetitionSelection {
  id: number
  timestamp: number
  route: string
}

/**
 * Save competition selection with context
 */
export function saveCompetitionSelection(competitionId: number, route: string = 'unknown'): void {
  const selection: CompetitionSelection = {
    id: competitionId,
    timestamp: Date.now(),
    route
  }
  
  localStorage.setItem(SELECTED_COMPETITION_KEY, competitionId.toString())
  localStorage.setItem(COMPETITION_SELECTION_TIMESTAMP_KEY, selection.timestamp.toString())
  
  console.log(`Competition selection saved: ID ${competitionId} from route ${route}`)
}

/**
 * Get the currently selected competition ID
 */
export function getSelectedCompetitionId(): number | null {
  const id = localStorage.getItem(SELECTED_COMPETITION_KEY)
  return id ? parseInt(id, 10) : null
}

/**
 * Get the competition selection with context
 */
export function getCompetitionSelection(): CompetitionSelection | null {
  const id = getSelectedCompetitionId()
  const timestamp = localStorage.getItem(COMPETITION_SELECTION_TIMESTAMP_KEY)
  
  if (!id || !timestamp) return null
  
  return {
    id,
    timestamp: parseInt(timestamp, 10),
    route: 'unknown' // We don't store route in this simple implementation
  }
}

/**
 * Clear competition selection
 */
export function clearCompetitionSelection(): void {
  localStorage.removeItem(SELECTED_COMPETITION_KEY)
  localStorage.removeItem(COMPETITION_SELECTION_TIMESTAMP_KEY)
  console.log('Competition selection cleared')
}

/**
 * Check if a competition selection is recent (within last 5 minutes)
 */
export function isRecentSelection(maxAgeMinutes: number = 5): boolean {
  const selection = getCompetitionSelection()
  if (!selection) return false
  
  const ageMinutes = (Date.now() - selection.timestamp) / (1000 * 60)
  return ageMinutes <= maxAgeMinutes
}

/**
 * Get the best competition to use based on priority:
 * 1. Recent user selection (if within 5 minutes)
 * 2. Active competition from database
 * 3. Most recent competition
 */
export async function getBestCompetitionId(): Promise<number | null> {
  try {
    // First, check if there's a recent user selection
    if (isRecentSelection(5)) {
      const selectedId = getSelectedCompetitionId()
      if (selectedId) {
        console.log(`Using recent user selection: ${selectedId}`)
        return selectedId
      }
    }

    // Fetch competitions from database
    const response = await fetch('/api/competitions')
    if (!response.ok) {
      console.error('Failed to fetch competitions')
      return null
    }

    const competitions = await response.json()
    if (competitions.length === 0) {
      console.log('No competitions found')
      return null
    }

    // Look for active competition
    const activeCompetition = competitions.find((comp: any) => comp.is_active)
    if (activeCompetition) {
      console.log(`Using active competition: ${activeCompetition.id}`)
      return activeCompetition.id
    }

    // Fall back to most recent competition
    const mostRecent = competitions.sort((a: any, b: any) => 
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    )[0]
    
    console.log(`Using most recent competition: ${mostRecent.id}`)
    return mostRecent.id

  } catch (error) {
    console.error('Error getting best competition:', error)
    return null
  }
}

/**
 * Set a competition as active in the database
 */
export async function setActiveCompetition(competitionId: number): Promise<boolean> {
  try {
    const response = await fetch(`/api/competitions/${competitionId}/set-active`, {
      method: 'POST'
    })
    
    if (response.ok) {
      console.log(`Competition ${competitionId} set as active`)
      return true
    } else {
      console.error(`Failed to set competition ${competitionId} as active`)
      return false
    }
  } catch (error) {
    console.error('Error setting active competition:', error)
    return false
  }
}
