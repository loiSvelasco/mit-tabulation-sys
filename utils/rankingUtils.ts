import type { Contestant } from "./useCompetitionStore"

// Helper function to calculate average score
export function calculateAverageScore(scores: number[]): number {
  if (scores.length === 0) return 0
  return scores.reduce((sum, score) => sum + score, 0) / scores.length
}

// Helper function to calculate median score
export function calculateMedianScore(scores: number[]): number {
  if (scores.length === 0) return 0

  const sortedScores = [...scores].sort((a, b) => a - b)
  const middle = Math.floor(sortedScores.length / 2)

  if (sortedScores.length % 2 === 0) {
    return (sortedScores[middle - 1] + sortedScores[middle]) / 2
  } else {
    return sortedScores[middle]
  }
}

// Helper function to calculate trimmed mean
export function calculateTrimmedMean(scores: number[], trimPercentage: number): number {
  if (scores.length <= 2) return calculateAverageScore(scores)

  const sortedScores = [...scores].sort((a, b) => a - b)
  const trimCount = Math.floor((scores.length * (trimPercentage / 100)) / 2)

  if (trimCount === 0) return calculateAverageScore(scores)

  const trimmedScores = sortedScores.slice(trimCount, sortedScores.length - trimCount)
  return calculateAverageScore(trimmedScores)
}

// Helper function to convert scores to ranks
export function convertScoresToRanks(scoresMap: Record<string, number>): Record<string, number> {
  const contestants = Object.keys(scoresMap)
  const scores = Object.values(scoresMap)

  // Create array of [contestantId, score] pairs
  const pairs = contestants.map((id, index) => [id, scores[index]])

  // Sort by score in descending order
  pairs.sort((a, b) => (b[1] as number) - (a[1] as number))

  // Assign ranks (handling ties)
  const ranks: Record<string, number> = {}
  let currentRank = 1
  let currentScore = pairs[0]?.[1] as number
  let sameRankCount = 0

  pairs.forEach(([id, score], index) => {
    if (score !== currentScore) {
      currentRank += sameRankCount
      currentScore = score as number
      sameRankCount = 1
    } else {
      sameRankCount++
    }
    ranks[id as string] = currentRank
  })

  return ranks
}

// Calculate scores for a segment based on the selected ranking method
export function calculateSegmentScores(
  contestants: Contestant[],
  judges: { id: string; name: string }[],
  scores: Record<string, Record<string, number>>,
  segmentId: string,
  rankingConfig: {
    method: string
    trimPercentage?: number
    useSegmentWeights?: boolean
    segmentWeights?: Record<string, number>
    tiebreaker: string
    tiebreakerCriterionId?: string
    customFormula?: string
  },
): Record<string, { score: number; rank: number }> {
  // Filter contestants in this segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Calculate raw scores based on the selected method
  const rawScores: Record<string, number> = {}

  segmentContestants.forEach((contestant) => {
    const contestantScores = scores[contestant.id] || {}
    const judgeScores = Object.values(contestantScores)

    if (judgeScores.length === 0) {
      rawScores[contestant.id] = 0
      return
    }

    switch (rankingConfig.method) {
      case "avg":
        rawScores[contestant.id] = calculateAverageScore(judgeScores)
        break

      case "median":
        rawScores[contestant.id] = calculateMedianScore(judgeScores)
        break

      case "trimmed":
        rawScores[contestant.id] = calculateTrimmedMean(judgeScores, rankingConfig.trimPercentage || 20)
        break

      case "custom":
        if (rankingConfig.customFormula) {
          try {
            const avg_score = calculateAverageScore(judgeScores)
            const median_score = calculateMedianScore(judgeScores)
            const min_score = Math.min(...judgeScores)
            const max_score = Math.max(...judgeScores)
            const judge_count = judgeScores.length

            // eslint-disable-next-line no-new-func
            const formula = new Function(
              "avg_score",
              "median_score",
              "min_score",
              "max_score",
              "judge_count",
              `return ${rankingConfig.customFormula}`,
            )

            rawScores[contestant.id] = formula(avg_score, median_score, min_score, max_score, judge_count)
          } catch (error) {
            console.error("Error evaluating custom formula:", error)
            rawScores[contestant.id] = calculateAverageScore(judgeScores)
          }
        } else {
          rawScores[contestant.id] = calculateAverageScore(judgeScores)
        }
        break

      default:
        rawScores[contestant.id] = calculateAverageScore(judgeScores)
    }
  })

  // For rank-based methods, we need to do additional processing
  let finalScores: Record<string, number> = { ...rawScores }

  if (rankingConfig.method === "avg-rank") {
    // Convert the average scores to ranks
    finalScores = convertScoresToRanks(rawScores)
  } else if (rankingConfig.method === "rank-avg-rank") {
    // For each judge, rank their scores
    const judgeRanks: Record<string, Record<string, number>> = {}

    judges.forEach((judge) => {
      const judgeScores: Record<string, number> = {}

      // Get this judge's scores for all contestants
      segmentContestants.forEach((contestant) => {
        if (scores[contestant.id]?.[judge.id]) {
          judgeScores[contestant.id] = scores[contestant.id][judge.id]
        }
      })

      // Convert to ranks
      judgeRanks[judge.id] = convertScoresToRanks(judgeScores)
    })

    // Average the ranks for each contestant
    const avgRanks: Record<string, number> = {}
    segmentContestants.forEach((contestant) => {
      const ranks: number[] = []

      judges.forEach((judge) => {
        if (judgeRanks[judge.id]?.[contestant.id]) {
          ranks.push(judgeRanks[judge.id][contestant.id])
        }
      })

      avgRanks[contestant.id] = calculateAverageScore(ranks)
    })

    finalScores = avgRanks
  } else if (rankingConfig.method === "borda") {
    // Borda count
    const bordaScores: Record<string, number> = {}
    const contestantCount = segmentContestants.length

    // Initialize borda scores
    segmentContestants.forEach((contestant) => {
      bordaScores[contestant.id] = 0
    })

    // For each judge, calculate Borda points
    judges.forEach((judge) => {
      const judgeScores: Record<string, number> = {}

      // Get this judge's scores for all contestants
      segmentContestants.forEach((contestant) => {
        if (scores[contestant.id]?.[judge.id]) {
          judgeScores[contestant.id] = scores[contestant.id][judge.id]
        }
      })

      // Convert to ranks
      const ranks = convertScoresToRanks(judgeScores)

      // Assign Borda points (contestantCount - rank + 1)
      Object.entries(ranks).forEach(([contestantId, rank]) => {
        bordaScores[contestantId] += contestantCount - rank + 1
      })
    })

    finalScores = bordaScores
  }

  // Apply tiebreaker if needed
  if (rankingConfig.tiebreaker !== "none") {
    applyTiebreaker(finalScores, scores, rankingConfig)
  }

  // Convert scores to ranks for the final result
  const finalRanks = convertScoresToRanks(finalScores)

  // Create the result object with both score and rank
  const result: Record<string, { score: number; rank: number }> = {}

  segmentContestants.forEach((contestant) => {
    result[contestant.id] = {
      score: finalScores[contestant.id] || 0,
      rank: finalRanks[contestant.id] || 0,
    }
  })

  return result
}

// Apply tiebreaker rules
function applyTiebreaker(
  finalScores: Record<string, number>,
  scores: Record<string, Record<string, number>>,
  rankingConfig: {
    method: string
    tiebreaker: string
    tiebreakerCriterionId?: string
  },
): void {
  // Find ties
  const scoreGroups: Record<number, string[]> = {}

  Object.entries(finalScores).forEach(([contestantId, score]) => {
    if (!scoreGroups[score]) {
      scoreGroups[score] = []
    }
    scoreGroups[score].push(contestantId)
  })

  // Process each group of tied contestants
  Object.values(scoreGroups).forEach((contestantIds) => {
    if (contestantIds.length <= 1) return // No tie

    switch (rankingConfig.tiebreaker) {
      case "highest-score":
        // Break tie by highest individual score
        const highestScores: Record<string, number> = {}

        contestantIds.forEach((contestantId) => {
          const contestantScores = scores[contestantId] || {}
          const judgeScores = Object.values(contestantScores)
          highestScores[contestantId] = judgeScores.length > 0 ? Math.max(...judgeScores) : 0
        })

        // Sort by highest score and adjust final scores slightly to break tie
        contestantIds
          .sort((a, b) => highestScores[b] - highestScores[a])
          .forEach((contestantId, index) => {
            // Add a tiny amount to break the tie while preserving the original score
            finalScores[contestantId] += index * 0.0001
          })
        break

      case "head-to-head":
        // Compare how many judges ranked one contestant higher than the other
        const winCounts: Record<string, number> = {}
        contestantIds.forEach((id) => {
          winCounts[id] = 0
        })

        // For each pair of contestants
        for (let i = 0; i < contestantIds.length; i++) {
          for (let j = i + 1; j < contestantIds.length; j++) {
            const contestantA = contestantIds[i]
            const contestantB = contestantIds[j]
            let aWins = 0
            let bWins = 0

            // Compare scores from each judge
            const judgesA = Object.keys(scores[contestantA] || {})
            const judgesB = Object.keys(scores[contestantB] || {})
            const commonJudges = judgesA.filter((id) => judgesB.includes(id))

            commonJudges.forEach((judgeId) => {
              const scoreA = scores[contestantA]?.[judgeId] || 0
              const scoreB = scores[contestantB]?.[judgeId] || 0

              if (scoreA > scoreB) aWins++
              if (scoreB > scoreA) bWins++
            })

            if (aWins > bWins) winCounts[contestantA]++
            if (bWins > aWins) winCounts[contestantB]++
          }
        }

        // Sort by win count and adjust final scores slightly to break tie
        contestantIds
          .sort((a, b) => winCounts[b] - winCounts[a])
          .forEach((contestantId, index) => {
            finalScores[contestantId] += index * 0.0001
          })
        break

      case "specific-criteria":
        // This would require access to scores by criterion, which isn't in your current data model
        // For now, we'll just use a placeholder implementation
        contestantIds.forEach((contestantId, index) => {
          finalScores[contestantId] += index * 0.0001
        })
        break

      default:
        // No tiebreaker, leave scores as is
        break
    }
  })
}

