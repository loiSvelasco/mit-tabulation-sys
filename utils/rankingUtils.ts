// utils/ranking-utils.ts

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

interface RankingConfig {
  method: string
  trimPercentage?: number
  useSegmentWeights?: boolean
  segmentWeights?: Record<string, number>
  tiebreaker: string
  tiebreakerCriterionId?: string
  customFormula?: string
}

// Calculate scores for a segment based on the selected ranking method
export function calculateSegmentScores(
  contestants: Contestant[],
  judges: { id: string; name: string }[],
  scores: Record<string, Record<string, Record<string, number>>>,
  segmentId: string,
  rankingConfig: RankingConfig,
): Record<string, { score: number; rank: number }> {
  // Filter contestants in this segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Calculate raw scores based on the selected method
  const rawScores: Record<string, number> = {}

  segmentContestants.forEach((contestant) => {
    // Get all criterion scores for this contestant from all judges
    const allScores: number[] = []

    if (scores[contestant.id]) {
      Object.keys(scores[contestant.id]).forEach((judgeId) => {
        const criterionScores = Object.values(scores[contestant.id][judgeId] || {})
        allScores.push(...criterionScores)
      })
    }

    if (allScores.length === 0) {
      rawScores[contestant.id] = 0
      return
    }

    switch (rankingConfig.method) {
      case "avg":
        rawScores[contestant.id] = calculateAverageScore(allScores)
        break

      case "median":
        rawScores[contestant.id] = calculateMedianScore(allScores)
        break

      case "trimmed":
        rawScores[contestant.id] = calculateTrimmedMean(allScores, rankingConfig.trimPercentage || 20)
        break

      case "custom":
        if (rankingConfig.customFormula) {
          try {
            const avg_score = calculateAverageScore(allScores)
            const median_score = calculateMedianScore(allScores)
            const min_score = Math.min(...allScores)
            const max_score = Math.max(...allScores)
            const judge_count = judges.length

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
            rawScores[contestant.id] = calculateAverageScore(allScores)
          }
        } else {
          rawScores[contestant.id] = calculateAverageScore(allScores)
        }
        break

      default:
        rawScores[contestant.id] = calculateAverageScore(allScores)
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
          // Sum all criterion scores for this judge
          judgeScores[contestant.id] = Object.values(scores[contestant.id][judge.id]).reduce(
            (sum, score) => sum + score,
            0,
          )
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
          // Sum all criterion scores for this judge
          judgeScores[contestant.id] = Object.values(scores[contestant.id][judge.id]).reduce(
            (sum, score) => sum + score,
            0,
          )
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

  // Create the result object with both score and rank
  const result: Record<string, { score: number; rank: number }> = {}

  // For rank-based methods (lower is better), sort in ascending order
  // For other methods (higher is better), sort in descending order
  const isRankBased = rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank"

  // Sort contestants based on their scores
  const sortedContestants = [...segmentContestants].sort((a, b) => {
    const scoreA = finalScores[a.id] || 0
    const scoreB = finalScores[b.id] || 0

    // For rank-based methods, lower scores are better
    if (isRankBased) {
      return scoreA - scoreB
    }

    // For other methods, higher scores are better
    return scoreB - scoreA
  })

  // Assign ranks based on the sorted order
  sortedContestants.forEach((contestant, index) => {
    result[contestant.id] = {
      score: finalScores[contestant.id] || 0,
      rank: index + 1,
    }
  })

  // Add debug logging to verify correct ranking
  console.log(`Ranking Method: ${rankingConfig.method}, Is Rank Based: ${isRankBased}`)
  console.log("Final Scores:", finalScores)
  console.log("Final Results:", result)

  return result
}

// Apply tiebreaker rules
function applyTiebreaker(
  finalScores: Record<string, number>,
  scores: Record<string, Record<string, Record<string, number>>>,
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
          let maxScore = 0

          // Find the highest score across all judges and criteria
          if (scores[contestantId]) {
            Object.values(scores[contestantId]).forEach((judgeScores) => {
              Object.values(judgeScores).forEach((score) => {
                if (score > maxScore) maxScore = score
              })
            })
          }

          highestScores[contestantId] = maxScore
        })

        // Sort by highest score and adjust final scores slightly to break tie
        contestantIds
          .sort((a, b) => highestScores[b] - highestScores[a])
          .forEach((contestantId, index) => {
            // For rank-based methods, we need to adjust differently
            if (rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank") {
              // For rank-based methods, adding makes the rank worse (higher)
              // So we add more to worse contestants
              finalScores[contestantId] += index * 0.0001
            } else {
              // For score-based methods, adding makes the score better
              // So we add more to better contestants (reverse order)
              finalScores[contestantId] += (contestantIds.length - 1 - index) * 0.0001
            }
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

            // Compare total scores from each judge
            if (scores[contestantA] && scores[contestantB]) {
              const judgesA = Object.keys(scores[contestantA])
              const judgesB = Object.keys(scores[contestantB])
              const commonJudges = judgesA.filter((id) => judgesB.includes(id))

              commonJudges.forEach((judgeId) => {
                // Calculate total scores for each contestant from this judge
                const scoreA = Object.values(scores[contestantA][judgeId] || {}).reduce((sum, score) => sum + score, 0)
                const scoreB = Object.values(scores[contestantB][judgeId] || {}).reduce((sum, score) => sum + score, 0)

                if (scoreA > scoreB) aWins++
                if (scoreB > scoreA) bWins++
              })
            }

            if (aWins > bWins) winCounts[contestantA]++
            if (bWins > aWins) winCounts[contestantB]++
          }
        }

        // Sort by win count and adjust final scores slightly to break tie
        contestantIds
          .sort((a, b) => winCounts[b] - winCounts[a])
          .forEach((contestantId, index) => {
            // For rank-based methods, we need to adjust differently
            if (rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank") {
              // For rank-based methods, adding makes the rank worse (higher)
              finalScores[contestantId] += index * 0.0001
            } else {
              // For score-based methods, adding makes the score better
              finalScores[contestantId] += (contestantIds.length - 1 - index) * 0.0001
            }
          })
        break

      case "specific-criteria":
        // Use a specific criterion for tiebreaking if provided
        if (rankingConfig.tiebreakerCriterionId) {
          const criterionScores: Record<string, number> = {}

          contestantIds.forEach((contestantId) => {
            let totalCriterionScore = 0
            let count = 0

            // Sum scores for the specific criterion across all judges
            if (scores[contestantId]) {
              Object.values(scores[contestantId]).forEach((judgeScores) => {
                if (judgeScores[rankingConfig.tiebreakerCriterionId]) {
                  totalCriterionScore += judgeScores[rankingConfig.tiebreakerCriterionId]
                  count++
                }
              })
            }

            criterionScores[contestantId] = count > 0 ? totalCriterionScore / count : 0
          })

          // Sort by criterion score and adjust final scores
          contestantIds
            .sort((a, b) => criterionScores[b] - criterionScores[a])
            .forEach((contestantId, index) => {
              if (rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank") {
                finalScores[contestantId] += index * 0.0001
              } else {
                finalScores[contestantId] += (contestantIds.length - 1 - index) * 0.0001
              }
            })
        } else {
          // Fallback if no criterion specified
          contestantIds.forEach((contestantId, index) => {
            if (rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank") {
              finalScores[contestantId] += index * 0.0001
            } else {
              finalScores[contestantId] += (contestantIds.length - 1 - index) * 0.0001
            }
          })
        }
        break

      default:
        // No tiebreaker, leave scores as is
        break
    }
  })
}

export function calculateSegmentRankings(
  segmentResults: Record<string, { score: number; rank: number }>,
  rankingConfig: RankingConfig,
): Record<string, number> {
  const contestantIds = Object.keys(segmentResults)
  const rankings: Record<string, number> = {}

  if (rankingConfig.method === "score-sum") {
    // Sort contestants by score (higher is better)
    contestantIds.sort((a, b) => segmentResults[b].score - segmentResults[a].score)
  } else if (rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank") {
    // Sort contestants by rank (lower is better)
    contestantIds.sort((a, b) => segmentResults[a].score - segmentResults[b].score)
  } else {
    // Default: No sorting
  }

  contestantIds.forEach((contestantId, index) => {
    rankings[contestantId] = index + 1
  })

  return rankings
}
