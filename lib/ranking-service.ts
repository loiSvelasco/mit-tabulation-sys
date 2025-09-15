import { dbToStoreScores } from '@/utils/score-adapter'

export interface DatabaseScore {
  id: string
  competition_id: number
  segment_id: string
  criterion_id: string
  contestant_id: string
  judge_id: string
  score: number
  created_at: string
  updated_at: string
}

export interface RankingData {
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>
  lastUpdated: Date
}

// Cache for ranking data
const rankingCache = new Map<string, RankingData>()

/**
 * Fetch fresh scores from database for ranking calculations
 */
export async function fetchRankingScores(competitionId: number): Promise<RankingData> {
  try {
    const response = await fetch(`/api/scores?competitionId=${competitionId}`)
    
    if (!response.ok) {
      throw new Error(`Failed to fetch scores: ${response.statusText}`)
    }

    const scoresData: DatabaseScore[] = await response.json()
    
    // Convert database format to store format
    const storeScores = dbToStoreScores(scoresData)
    
    const rankingData: RankingData = {
      scores: storeScores,
      lastUpdated: new Date()
    }

    // Cache the result
    rankingCache.set(competitionId.toString(), rankingData)
    
    console.log(`Fetched fresh ranking scores for competition ${competitionId}`)
    return rankingData
  } catch (error) {
    console.error('Error fetching ranking scores:', error)
    throw error
  }
}

/**
 * Get cached ranking scores or fetch fresh if needed
 */
export async function getRankingScores(
  competitionId: number, 
  forceRefresh: boolean = false
): Promise<RankingData> {
  const cacheKey = competitionId.toString()
  
  // Check cache first
  if (!forceRefresh && rankingCache.has(cacheKey)) {
    const cached = rankingCache.get(cacheKey)!
    console.log(`Using cached ranking scores for competition ${competitionId}`)
    return cached
  }

  // Fetch fresh data
  return await fetchRankingScores(competitionId)
}

/**
 * Invalidate cache for a specific competition
 */
export function invalidateRankingCache(competitionId: number): void {
  const cacheKey = competitionId.toString()
  if (rankingCache.has(cacheKey)) {
    rankingCache.delete(cacheKey)
    console.log(`Invalidated ranking cache for competition ${competitionId}`)
  }
}

/**
 * Clear all ranking cache
 */
export function clearRankingCache(): void {
  rankingCache.clear()
  console.log('Cleared all ranking cache')
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): { competitionId: string; lastUpdated: Date }[] {
  return Array.from(rankingCache.entries()).map(([competitionId, data]) => ({
    competitionId,
    lastUpdated: data.lastUpdated
  }))
}
