"use client"

import { useState } from 'react'
import useCompetitionStore from '@/utils/useCompetitionStore'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { calculateSegmentScores } from '@/utils/rankingUtils'
import { getRankingScores, getCacheStatus } from '@/lib/ranking-service'

/**
 * Debug component to test score synchronization
 * This component helps verify that score deletions are properly synchronized
 */
export function ScoreSyncTest() {
  const { scores, deleteScore, refreshScoresFromDatabase, contestants, judges, competitionSettings } = useCompetitionStore()
  const [testResult, setTestResult] = useState<string>('')

  // Count total scores in the store
  const countScores = () => {
    let count = 0
    Object.values(scores).forEach(segmentScores => {
      Object.values(segmentScores).forEach(contestantScores => {
        Object.values(contestantScores).forEach(judgeScores => {
          count += Object.keys(judgeScores).length
        })
      })
    })
    return count
  }

  const testScoreSync = () => {
    const beforeCount = countScores()
    setTestResult(`Before refresh: ${beforeCount} scores in store`)
    
    // Refresh from database
    refreshScoresFromDatabase().then(() => {
      const afterCount = countScores()
      setTestResult(prev => `${prev}\nAfter refresh: ${afterCount} scores in store`)
    })
  }

  const testScoreDeletion = () => {
    // Find the first score to delete for testing
    let foundScore = null
    for (const [segmentId, segmentScores] of Object.entries(scores)) {
      for (const [contestantId, contestantScores] of Object.entries(segmentScores)) {
        for (const [judgeId, judgeScores] of Object.entries(contestantScores)) {
          for (const [criterionId] of Object.entries(judgeScores)) {
            foundScore = { segmentId, contestantId, judgeId, criterionId }
            break
          }
          if (foundScore) break
        }
        if (foundScore) break
      }
      if (foundScore) break
    }

    if (foundScore) {
      const beforeCount = countScores()
      setTestResult(`Before deletion: ${beforeCount} scores in store`)
      
      deleteScore(
        foundScore.segmentId,
        foundScore.contestantId,
        foundScore.judgeId,
        foundScore.criterionId
      )
      
      const afterCount = countScores()
      setTestResult(prev => `${prev}\nAfter deletion: ${afterCount} scores in store`)
    } else {
      setTestResult('No scores found to test deletion')
    }
  }

  const testRankingCalculations = () => {
    if (!contestants.length || !judges.length || !competitionSettings) {
      setTestResult('Need contestants, judges, and competition settings to test rankings')
      return
    }

    // Find a segment with scores
    const segmentWithScores = Object.keys(scores).find(segmentId => 
      Object.keys(scores[segmentId] || {}).length > 0
    )

    if (!segmentWithScores) {
      setTestResult('No segments with scores found')
      return
    }

    try {
      const rankings = calculateSegmentScores(
        contestants,
        judges,
        scores,
        segmentWithScores,
        competitionSettings.ranking
      )

      const rankingInfo = Object.entries(rankings)
        .map(([contestantId, data]) => {
          const contestant = contestants.find(c => c.id === contestantId)
          return `${contestant?.name || contestantId}: Score ${data.score}, Rank ${data.rank}`
        })
        .join('\n')

      setTestResult(`Ranking calculations test:\n${rankingInfo}`)
    } catch (error) {
      setTestResult(`Error in ranking calculations: ${error}`)
    }
  }

  const testDatabaseRankings = async () => {
    if (!selectedCompetitionId) {
      setTestResult('No competition selected')
      return
    }

    try {
      setTestResult('Fetching rankings from database...')
      
      const rankingData = await getRankingScores(selectedCompetitionId, true) // Force refresh
      
      const cacheStatus = getCacheStatus()
      const cacheInfo = cacheStatus.map(c => `${c.competitionId}: ${c.lastUpdated.toLocaleTimeString()}`).join('\n')
      
      setTestResult(`Database rankings fetched successfully!\nLast updated: ${rankingData.lastUpdated.toLocaleTimeString()}\n\nCache status:\n${cacheInfo}`)
    } catch (error) {
      setTestResult(`Error fetching database rankings: ${error}`)
    }
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Score Sync Test</CardTitle>
        <CardDescription>
          Test score synchronization and deletion
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm">
          <p>Current scores in store: {countScores()}</p>
        </div>
        
        <div className="space-x-2">
          <Button onClick={testScoreSync} variant="outline" size="sm">
            Test Refresh
          </Button>
          <Button onClick={testScoreDeletion} variant="outline" size="sm">
            Test Deletion
          </Button>
          <Button onClick={testRankingCalculations} variant="outline" size="sm">
            Test Rankings
          </Button>
          <Button onClick={testDatabaseRankings} variant="outline" size="sm">
            Test DB Rankings
          </Button>
        </div>
        
        {testResult && (
          <div className="text-xs bg-muted p-2 rounded whitespace-pre-line">
            {testResult}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
