import { useState, useEffect, useCallback, useMemo } from 'react'
import useCompetitionStore from '@/utils/useCompetitionStore'
import { getRankingScores, invalidateRankingCache, type RankingData } from '@/lib/ranking-service'
import { calculateSegmentScores, convertScoresToRanks, roundToTwoDecimals } from '@/utils/rankingUtils'

export interface DatabaseRankingCalculations {
  rankings: Record<string, { score: number; rank: number }>
  judgeRankings: Record<string, Record<string, number>>
  judgeScores: Record<string, Record<string, number>>
  totalScores: Record<string, number>
  avgScores: Record<string, number>
  avgCriteriaScores: Record<string, Record<string, number>>
  isLoading: boolean
  lastUpdated: Date | null
  error: string | null
  refreshRankings: () => void
}

/**
 * Hook for database-driven ranking calculations
 * This ensures rankings always use fresh data from the database
 */
export function useDatabaseRankings(
  segmentId: string | undefined,
  contestantsGroup: any[] | undefined,
  judges: any[] | undefined,
  competitionSettings: any | undefined,
  forceRefresh: boolean = false
): DatabaseRankingCalculations {
  const { selectedCompetitionId } = useCompetitionStore()
  const [rankingData, setRankingData] = useState<RankingData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch ranking data from database
  const fetchRankingData = useCallback(async () => {
    if (!selectedCompetitionId || !segmentId || !contestantsGroup || !judges || !competitionSettings) {
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const data = await getRankingScores(selectedCompetitionId, forceRefresh)
      setRankingData(data)
    } catch (err) {
      console.error('Error fetching ranking data:', err)
      setError(err instanceof Error ? err.message : 'Failed to fetch ranking data')
    } finally {
      setIsLoading(false)
    }
  }, [selectedCompetitionId, segmentId, contestantsGroup, judges, competitionSettings, forceRefresh])

  // Fetch data when dependencies change
  useEffect(() => {
    fetchRankingData()
  }, [fetchRankingData])

  // Function to manually refresh rankings
  const refreshRankings = useCallback(() => {
    if (selectedCompetitionId) {
      invalidateRankingCache(selectedCompetitionId)
      fetchRankingData()
    }
  }, [selectedCompetitionId, fetchRankingData])

  // Calculate rankings using database data
  const calculations = useMemo(() => {
    const emptyResult: DatabaseRankingCalculations = {
      rankings: {},
      judgeRankings: {},
      judgeScores: {},
      totalScores: {},
      avgScores: {},
      avgCriteriaScores: {},
      isLoading,
      lastUpdated: rankingData?.lastUpdated || null,
      error,
      refreshRankings: () => {}
    }

    if (!segmentId || !contestantsGroup || !judges || !competitionSettings || !rankingData) {
      return emptyResult
    }

    try {
      const { scores } = rankingData

      // Get the selected segment and criteria
      const segment = competitionSettings.segments.find((s: any) => s.id === segmentId)
      const criteria = segment?.criteria || []

      // Calculate rankings using the ranking-utils
      const rankings = calculateSegmentScores(contestantsGroup, judges, scores, segmentId, competitionSettings.ranking)

      // For each judge, calculate their individual rankings
      const judgeRankings: Record<string, Record<string, number>> = {}
      const judgeScores: Record<string, Record<string, number>> = {}

      judges.forEach((judge) => {
        const judgeScoreMap: Record<string, number> = {}

        contestantsGroup.forEach((contestant) => {
          // Get total score from this judge for this contestant
          const totalScore = getJudgeTotalScore(scores, segmentId, contestant.id, judge.id)
          judgeScoreMap[contestant.id] = totalScore
        })

        judgeScores[judge.id] = judgeScoreMap
        judgeRankings[judge.id] = convertScoresToRanks(judgeScoreMap)
      })

      // Calculate total and average scores for each contestant
      const totalScores: Record<string, number> = {}
      const avgScores: Record<string, number> = {}

      contestantsGroup.forEach((contestant) => {
        let totalScore = 0
        let count = 0

        judges.forEach((judge) => {
          const judgeTotal = getJudgeTotalScore(scores, segmentId, contestant.id, judge.id)
          if (judgeTotal > 0) {
            totalScore += judgeTotal
            count++
          }
        })

        totalScores[contestant.id] = roundToTwoDecimals(totalScore)
        avgScores[contestant.id] = count > 0 ? roundToTwoDecimals(totalScore / count) : 0
      })

      // Calculate average scores per criteria for each contestant
      const avgCriteriaScores: Record<string, Record<string, number>> = {}
      contestantsGroup.forEach((contestant) => {
        const criteriaScores: { [criterionId: string]: number } = {}

        criteria.forEach((criterion: any) => {
          let totalCriterionScore = 0
          let criterionCount = 0

          judges.forEach((judge) => {
            if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
              totalCriterionScore += scores[segmentId][contestant.id][judge.id][criterion.id]
              criterionCount++
            }
          })

          criteriaScores[criterion.id] = criterionCount > 0 ? roundToTwoDecimals(totalCriterionScore / criterionCount) : 0
        })

        avgCriteriaScores[contestant.id] = criteriaScores
      })

      return {
        rankings,
        judgeRankings,
        judgeScores,
        totalScores,
        avgScores,
        avgCriteriaScores,
        isLoading,
        lastUpdated: rankingData.lastUpdated,
        error: null,
        refreshRankings
      }
    } catch (err) {
      console.error('Error calculating rankings:', err)
      return {
        ...emptyResult,
        error: err instanceof Error ? err.message : 'Failed to calculate rankings'
      }
    }
  }, [segmentId, contestantsGroup, judges, competitionSettings, rankingData, isLoading, error, refreshRankings])

  return {
    ...calculations,
    refreshRankings
  }
}

// Helper function for getting judge total score
function getJudgeTotalScore(
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>, 
  segmentId: string, 
  contestantId: string, 
  judgeId: string
): number {
  if (!scores[segmentId]?.[contestantId]?.[judgeId]) return 0

  const total = Object.values(scores[segmentId][contestantId][judgeId]).reduce((sum, score) => sum + score, 0)
  return roundToTwoDecimals(total)
}
