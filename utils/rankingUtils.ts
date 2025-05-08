// utils/ranking-utils.ts

// Make sure the roundToTwoDecimals function is exported at the top of the file
export function roundToTwoDecimals(value: number): number {
  return Number(value.toFixed(2))
}

// Add these type definitions at the top of the file (after the roundToTwoDecimals function):
// Define minimal types needed for this utility file
interface Contestant {
  id: string
  currentSegmentId: string
  gender?: string
}

import type { Criterion, RankingConfig } from "./store/types"
// Don't import the hook in utility files

// Helper function to calculate average score
export function calculateAverageScore(scores: number[]): number {
  if (scores.length === 0) return 0
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length
  return roundToTwoDecimals(average)
}

// Helper function to calculate median score
export function calculateMedianScore(scores: number[]): number {
  if (scores.length === 0) return 0

  const sortedScores = [...scores].sort((a, b) => a - b)
  const middle = Math.floor(sortedScores.length / 2)

  let median
  if (sortedScores.length % 2 === 0) {
    median = (sortedScores[middle - 1] + sortedScores[middle]) / 2
  } else {
    median = sortedScores[middle]
  }

  return roundToTwoDecimals(median)
}

// Helper function to calculate trimmed mean - FIXED
export function calculateTrimmedMean(scores: number[], trimPercentage: number): number {
  if (scores.length <= 2) return calculateAverageScore(scores)

  // Sort scores in ascending order
  const sortedScores = [...scores].sort((a, b) => a - b)

  // Calculate how many scores to trim from each end
  // The key fix: divide by 100 first, then multiply by scores.length, then divide by 2
  const trimCount = Math.floor(((trimPercentage / 100) * scores.length) / 2)

  // If trimCount is 0, just return the average
  if (trimCount === 0) return calculateAverageScore(sortedScores)

  // Slice the array to remove trimmed scores from both ends
  const trimmedScores = sortedScores.slice(trimCount, sortedScores.length - trimCount)

  // Calculate average of remaining scores
  return calculateAverageScore(trimmedScores)
}

// Helper function to convert scores to ranks - UPDATED to use RANK.AVG style
export function convertScoresToRanks(scoresMap: Record<string, number>): Record<string, number> {
  const contestants = Object.keys(scoresMap)
  const scores = Object.values(scoresMap)

  // Create array of [contestantId, score] pairs
  const pairs = contestants.map((id, index) => [id, scores[index]])

  // Sort by score in descending order
  pairs.sort((a, b) => (b[1] as number) - (a[1] as number))

  // Assign ranks (handling ties with RANK.AVG style)
  const ranks: Record<string, number> = {}

  // First pass: Group contestants by score
  const scoreGroups: Record<number, string[]> = {}

  pairs.forEach(([id, score]) => {
    // Round the score to 2 decimal places for grouping to avoid floating-point comparison issues
    const scoreKey = roundToTwoDecimals(Number(score))
    if (!scoreGroups[scoreKey]) {
      scoreGroups[scoreKey] = []
    }
    scoreGroups[scoreKey].push(id as string)
  })

  // Second pass: Assign average ranks to tied contestants
  let currentPosition = 1

  // Sort scores in descending order
  const uniqueScores = Object.keys(scoreGroups)
    .map(Number)
    .sort((a, b) => b - a)

  uniqueScores.forEach((score) => {
    const tiedContestants = scoreGroups[score]
    const tieCount = tiedContestants.length

    // Calculate the average rank for this group
    // If there are 2 contestants tied at position 1, they both get (1+2)/2 = 1.5
    const averageRank = roundToTwoDecimals(currentPosition + (tieCount - 1) / 2)

    // Assign the same average rank to all tied contestants
    tiedContestants.forEach((id) => {
      ranks[id] = averageRank
    })

    // Move position counter past this group
    currentPosition += tieCount
  })

  return ranks
}

// Update the calculateWeightedScore function to properly handle the weight property
export function calculateWeightedScore(
  contestants: Contestant[],
  judges: { id: string; name: string }[],
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>,
  segmentId: string,
  criteria: Criterion[],
): Record<string, number> {
  const result: Record<string, number> = {}

  contestants.forEach((contestant) => {
    let totalWeightedScore = 0
    let totalWeight = 0

    criteria.forEach((criterion) => {
      // Use this pattern to safely handle the optional weight property
      const weight = typeof criterion.weight === "number" ? criterion.weight : 1
      totalWeight += weight

      // Calculate average score for this criterion
      let criterionTotal = 0
      let criterionCount = 0

      judges.forEach((judge) => {
        if (scores[segmentId]?.[contestant.id]?.[judge.id]?.[criterion.id]) {
          criterionTotal += scores[segmentId][contestant.id][judge.id][criterion.id]
          criterionCount++
        }
      })

      const avgCriterionScore = criterionCount > 0 ? criterionTotal / criterionCount : 0
      totalWeightedScore += avgCriterionScore * weight
    })

    result[contestant.id] = totalWeight > 0 ? roundToTwoDecimals(totalWeightedScore / totalWeight) : 0
  })

  return result
}

// Calculate scores for a segment based on the selected ranking method
export function calculateSegmentScores(
  contestants: Contestant[],
  judges: { id: string; name: string }[],
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>,
  segmentId: string,
  rankingConfig: RankingConfig,
  criteria?: Criterion[],
): Record<string, { score: number; rank: number }> {
  // Filter contestants in this segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Calculate raw scores based on the selected method
  const rawScores: Record<string, number> = {}

  segmentContestants.forEach((contestant) => {
    // Get all scores for this contestant from all judges
    const allScores: number[] = []

    judges.forEach((judge) => {
      if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
        const criterionScores = Object.values(scores[segmentId][contestant.id][judge.id])
        // Round each individual score to 2 decimal places
        const roundedScores = criterionScores.map((score) => roundToTwoDecimals(score as number))
        allScores.push(...roundedScores)
      }
    })

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

      case "weighted":
        // For weighted method, we need to handle each criterion separately
        // Instead of trying to access the store, use the criteria passed in the parameters

        // If we have criteria from the parameters, use them
        if (criteria && criteria.length > 0) {
          const weightedScores = calculateWeightedScore(segmentContestants, judges, scores, segmentId, criteria)

          // Convert weighted scores to the expected format with rank
          const result: Record<string, { score: number; rank: number }> = {}

          // Sort contestants by weighted score (higher is better)
          const sortedContestants = [...segmentContestants].sort(
            (a, b) => (weightedScores[b.id] || 0) - (weightedScores[a.id] || 0),
          )

          // Assign ranks
          sortedContestants.forEach((contestant, index) => {
            result[contestant.id] = {
              score: weightedScores[contestant.id] || 0,
              rank: index + 1,
            }
          })

          return result
        }
        rawScores[contestant.id] = calculateAverageScore(allScores)
        break

      case "custom":
        if (rankingConfig.customFormula) {
          try {
            const avg_score = calculateAverageScore(allScores)
            const median_score = calculateMedianScore(allScores)
            const min_score = roundToTwoDecimals(Math.min(...allScores))
            const max_score = roundToTwoDecimals(Math.max(...allScores))
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

            const result = formula(avg_score, median_score, min_score, max_score, judge_count)
            rawScores[contestant.id] = roundToTwoDecimals(result)
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
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          // Sum all criterion scores for this judge
          const totalScore = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
            (sum, score) => sum + (score as number),
            0,
          )
          judgeScores[contestant.id] = roundToTwoDecimals(totalScore)
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
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          // Sum all criterion scores for this judge
          const totalScore = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
            (sum, score) => sum + (score as number),
            0,
          )
          judgeScores[contestant.id] = roundToTwoDecimals(totalScore)
        }
      })

      // Convert to ranks
      const ranks = convertScoresToRanks(judgeScores)

      // Assign Borda points (contestantCount - rank + 1)
      Object.entries(ranks).forEach(([contestantId, rank]) => {
        bordaScores[contestantId] += contestantCount - rank + 1
      })
    })

    // Round all Borda scores
    Object.keys(bordaScores).forEach((id) => {
      bordaScores[id] = roundToTwoDecimals(bordaScores[id])
    })

    finalScores = bordaScores
  }

  // Apply tiebreaker if needed
  if (rankingConfig.tiebreaker !== "none") {
    applyTiebreaker(finalScores, scores, rankingConfig, segmentId)
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
      score: roundToTwoDecimals(finalScores[contestant.id] || 0),
      rank: index + 1,
    }
  })

  return result
}

// First, let's create a unified tiebreaker function near the top of the file (after the type definitions)

// Define a more specific type for the scores parameter
type DetailedScores = Record<string, Record<string, Record<string, Record<string, number>>>>
type SimpleScores = Record<string, Record<string, number>>

/**
 * Generic tiebreaker function that can be used in both segment and overall rankings
 */
function applyGenericTiebreaker<T extends { id: string }>(
  contestantGroup: T[] | string[],
  scores: DetailedScores | SimpleScores,
  rankingConfig: {
    method: string
    tiebreaker: string
    tiebreakerCriterionId?: string
  },
  isDetailedScores: boolean,
  adjustScoreCallback: (contestantId: string, adjustment: number) => void,
  segmentId?: string,
): void {
  // Skip if no tiebreaker or only one contestant
  if (rankingConfig.tiebreaker === "none" || contestantGroup.length <= 1) return

  switch (rankingConfig.tiebreaker) {
    case "highest-score":
      // Break tie by highest individual score
      const highestScores: Record<string, number> = {}

      // Get contestant IDs based on the type of contestantGroup
      const contestantIds = contestantGroup.map((contestant) =>
        typeof contestant === "string" ? contestant : contestant.id,
      )

      contestantIds.forEach((contestantId) => {
        let maxScore = 0

        if (isDetailedScores && segmentId) {
          // Detailed scores structure (segmentId -> contestantId -> judgeId -> criterionId -> score)
          const detailedScores = scores as DetailedScores
          if (detailedScores[segmentId]?.[contestantId]) {
            Object.keys(detailedScores[segmentId][contestantId]).forEach((judgeId) => {
              Object.values(detailedScores[segmentId][contestantId][judgeId]).forEach((score) => {
                if ((score as number) > maxScore) maxScore = score as number
              })
            })
          }
        } else {
          // Simple scores structure (judgeId -> contestantId -> score)
          const simpleScores = scores as SimpleScores
          Object.keys(simpleScores).forEach((judgeId) => {
            if (simpleScores[judgeId]?.[contestantId] !== undefined) {
              const score = roundToTwoDecimals(simpleScores[judgeId][contestantId])
              if (score > maxScore) maxScore = score
            }
          })
        }

        highestScores[contestantId] = roundToTwoDecimals(maxScore)
      })

      // Sort by highest score and adjust scores
      contestantIds
        .sort((a, b) => highestScores[b] - highestScores[a])
        .forEach((contestantId, index) => {
          // For rank-based methods, adding makes the rank worse (higher)
          // For score-based methods, adding makes the score better
          const isRankBased = rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank"

          if (isRankBased) {
            // Add more to worse contestants
            adjustScoreCallback(contestantId, index * 0.0001)
          } else {
            // Add more to better contestants (reverse order)
            adjustScoreCallback(contestantId, (contestantIds.length - 1 - index) * 0.0001)
          }
        })
      break

    case "head-to-head":
      // Compare how many judges ranked one contestant higher than the other
      const winCounts: Record<string, number> = {}
      const ids = contestantGroup.map((contestant) => (typeof contestant === "string" ? contestant : contestant.id))

      ids.forEach((id) => {
        winCounts[id] = 0
      })

      // For each pair of contestants
      for (let i = 0; i < ids.length; i++) {
        for (let j = i + 1; j < ids.length; j++) {
          const contestantA = ids[i]
          const contestantB = ids[j]
          let aWins = 0
          let bWins = 0

          if (isDetailedScores && segmentId) {
            // Detailed scores structure
            const detailedScores = scores as DetailedScores
            if (detailedScores[segmentId]?.[contestantA] && detailedScores[segmentId]?.[contestantB]) {
              Object.keys(detailedScores[segmentId][contestantA]).forEach((judgeId) => {
                if (detailedScores[segmentId][contestantB][judgeId]) {
                  const scoreA = roundToTwoDecimals(
                    Object.values(detailedScores[segmentId][contestantA][judgeId]).reduce(
                      (sum, score) => sum + (score as number),
                      0,
                    ),
                  )
                  const scoreB = roundToTwoDecimals(
                    Object.values(detailedScores[segmentId][contestantB][judgeId]).reduce(
                      (sum, score) => sum + (score as number),
                      0,
                    ),
                  )

                  if (scoreA > scoreB) aWins++
                  if (scoreB > scoreA) bWins++
                }
              })
            }
          } else {
            // Simple scores structure
            const simpleScores = scores as SimpleScores
            Object.keys(simpleScores).forEach((judgeId) => {
              const scoreA = roundToTwoDecimals(simpleScores[judgeId]?.[contestantA] || 0)
              const scoreB = roundToTwoDecimals(simpleScores[judgeId]?.[contestantB] || 0)

              if (scoreA > scoreB) aWins++
              if (scoreB > scoreA) bWins++
            })
          }

          if (aWins > bWins) winCounts[contestantA]++
          if (bWins > aWins) winCounts[contestantB]++
        }
      }

      // Sort by win count and adjust scores
      ids
        .sort((a, b) => winCounts[b] - winCounts[a])
        .forEach((contestantId, index) => {
          const isRankBased = rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank"

          if (isRankBased) {
            adjustScoreCallback(contestantId, index * 0.0001)
          } else {
            adjustScoreCallback(contestantId, (ids.length - 1 - index) * 0.0001)
          }
        })
      break

    case "specific-criteria":
      // Use a specific criterion for tiebreaking if provided
      if (isDetailedScores && segmentId && rankingConfig.tiebreakerCriterionId) {
        const criterionScores: Record<string, number> = {}
        const ids = contestantGroup.map((contestant) => (typeof contestant === "string" ? contestant : contestant.id))
        const detailedScores = scores as DetailedScores

        ids.forEach((contestantId) => {
          let totalCriterionScore = 0
          let count = 0

          // Sum scores for the specific criterion across all judges
          if (detailedScores[segmentId]?.[contestantId]) {
            Object.values(detailedScores[segmentId][contestantId]).forEach((judgeScores) => {
              if (judgeScores[rankingConfig.tiebreakerCriterionId!]) {
                totalCriterionScore += judgeScores[rankingConfig.tiebreakerCriterionId!] as number
                count++
              }
            })
          }

          criterionScores[contestantId] = count > 0 ? roundToTwoDecimals(totalCriterionScore / count) : 0
        })

        // Sort by criterion score and adjust scores
        ids
          .sort((a, b) => criterionScores[b] - criterionScores[a])
          .forEach((contestantId, index) => {
            const isRankBased = rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank"

            if (isRankBased) {
              adjustScoreCallback(contestantId, index * 0.0001)
            } else {
              adjustScoreCallback(contestantId, (ids.length - 1 - index) * 0.0001)
            }
          })
      } else {
        // Fallback if no criterion specified or not detailed scores
        const ids = contestantGroup.map((contestant) => (typeof contestant === "string" ? contestant : contestant.id))

        ids.forEach((contestantId, index) => {
          const isRankBased = rankingConfig.method === "rank-avg-rank" || rankingConfig.method === "avg-rank"

          if (isRankBased) {
            adjustScoreCallback(contestantId, index * 0.0001)
          } else {
            adjustScoreCallback(contestantId, (ids.length - 1 - index) * 0.0001)
          }
        })
      }
      break

    default:
      // No tiebreaker, leave scores as is
      break
  }
}

// Now, let's update the applyTiebreaker function to use our new generic function
function applyTiebreaker(
  finalScores: Record<string, number>,
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>,
  rankingConfig: {
    method: string
    tiebreaker: string
    tiebreakerCriterionId?: string
  },
  segmentId: string,
): void {
  // Find ties
  const scoreGroups: Record<number, string[]> = {}

  Object.entries(finalScores).forEach(([contestantId, score]) => {
    // Convert to string with fixed precision to handle floating point comparison issues
    const scoreKey = roundToTwoDecimals(score)

    if (!scoreGroups[scoreKey]) {
      scoreGroups[scoreKey] = []
    }
    scoreGroups[scoreKey].push(contestantId)
  })

  // Process each group of tied contestants
  Object.values(scoreGroups).forEach((contestantIds) => {
    if (contestantIds.length <= 1) return // No tie

    // Use the generic tiebreaker function
    applyGenericTiebreaker(
      contestantIds,
      scores,
      rankingConfig,
      true, // isDetailedScores
      (contestantId, adjustment) => {
        finalScores[contestantId] = roundToTwoDecimals(finalScores[contestantId] + adjustment)
      },
      segmentId,
    )
  })
}

// Main ranking calculation function
export const calculateRankings = (
  scores: Record<string, Record<string, number>>,
  judges: Array<{ id: string }>,
  separateByGender: boolean,
  contestants: Array<Contestant>,
  rankingConfig?: {
    method?: string
    trimPercentage?: number
    useSegmentWeights?: boolean
    segmentWeights?: Record<string, number>
    tiebreaker?: string
    tiebreakerCriterionId?: string
    customFormula?: string
    criteria?: Array<{ weight?: number }> // Added criteria type
  },
  competitionSettings?: {
    segments?: Array<{
      id: string
      criteria?: Array<{
        weight?: number
      }>
    }>
  },
) => {
  const groupedScores: Record<string, Array<Contestant & { total: number; avg: number; rank: number }>> = {}

  // Initialize groups based on gender separation setting
  if (separateByGender) {
    contestants.forEach(({ gender }) => {
      if (gender && !groupedScores[gender]) groupedScores[gender] = []
    })
  } else {
    groupedScores["all"] = []
  }

  // Calculate scores for each contestant based on the selected ranking method
  contestants.forEach((contestant) => {
    // Get all scores for this contestant from all judges
    const judgeScores: number[] = []
    judges.forEach((judge) => {
      if (scores[judge.id]?.[contestant.id] !== undefined) {
        // Round each score to 2 decimal places
        judgeScores.push(roundToTwoDecimals(scores[judge.id][contestant.id]))
      }
    })

    // Calculate score based on the selected method
    let calculatedScore = 0
    const total = judgeScores.reduce((acc, score) => acc + score, 0)

    if (rankingConfig?.method) {
      switch (rankingConfig.method) {
        case "avg":
          calculatedScore = calculateAverageScore(judgeScores)
          break

        case "median":
          calculatedScore = calculateMedianScore(judgeScores)
          break

        case "trimmed":
          calculatedScore = calculateTrimmedMean(judgeScores, rankingConfig.trimPercentage || 20)
          break

        case "weighted":
          // For weighted method, we need to get the criteria for the contestant's segment
          // This is more complex in the overall rankings since contestants might be in different segments

          // Get the segment for this contestant to access its criteria
          const segment = competitionSettings?.segments?.find((s) => s.id === contestant.currentSegmentId)

          if (segment && segment.criteria && segment.criteria.length > 0) {
            // We have criteria with potential weights
            let totalWeightedScore = 0
            let totalWeight = 0

            // Process each criterion
            segment.criteria.forEach((criterion) => {
              // Use weight property if available, otherwise default to 1
              const weight = typeof criterion.weight === "number" ? criterion.weight : 1
              totalWeight += weight

              // Get scores for this criterion from all judges
              const criterionScores: number[] = []

              judges.forEach((judge) => {
                // In the overall rankings, scores are structured differently than in segment scores
                // We need to check if there's a score for this contestant from this judge
                if (scores[judge.id]?.[contestant.id] !== undefined) {
                  // In this case, we're assuming each judge's score corresponds to a criterion
                  // You may need to adjust this based on your actual data structure
                  criterionScores.push(roundToTwoDecimals(scores[judge.id][contestant.id]))
                }
              })

              // Calculate average score for this criterion
              const avgCriterionScore =
                criterionScores.length > 0
                  ? roundToTwoDecimals(criterionScores.reduce((sum, score) => sum + score, 0) / criterionScores.length)
                  : 0

              // Add weighted score to total
              totalWeightedScore += avgCriterionScore * weight
            })

            // Calculate final weighted average
            calculatedScore = totalWeight > 0 ? roundToTwoDecimals(totalWeightedScore / totalWeight) : 0
          } else {
            // Fallback to average if criteria information is not available
            calculatedScore = calculateAverageScore(judgeScores)
          }
          break

        case "custom":
          if (rankingConfig.customFormula) {
            try {
              const avg_score = calculateAverageScore(judgeScores)
              const median_score = calculateMedianScore(judgeScores)
              const min_score = roundToTwoDecimals(Math.min(...(judgeScores.length ? judgeScores : [0])))
              const max_score = roundToTwoDecimals(Math.max(...(judgeScores.length ? judgeScores : [0])))
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

              const result = formula(avg_score, median_score, min_score, max_score, judge_count)
              calculatedScore = roundToTwoDecimals(result)
            } catch (error) {
              console.error("Error evaluating custom formula:", error)
              calculatedScore = calculateAverageScore(judgeScores)
            }
          } else {
            calculatedScore = calculateAverageScore(judgeScores)
          }
          break

        default:
          calculatedScore = calculateAverageScore(judgeScores)
      }
    } else {
      // Default to average if no method specified (for backward compatibility)
      calculatedScore = judgeScores.length > 0 ? roundToTwoDecimals(total / judgeScores.length) : 0
    }

    // Add to the appropriate group
    const key = separateByGender && contestant.gender ? contestant.gender : "all"
    if (groupedScores[key]) {
      groupedScores[key].push({
        ...contestant,
        total: roundToTwoDecimals(total),
        avg: calculatedScore,
        rank: 0, // Will be set after sorting
      })
    }
  })

  // Apply tiebreaker if needed
  if (rankingConfig?.tiebreaker && rankingConfig.tiebreaker !== "none") {
    Object.keys(groupedScores).forEach((key) => {
      const group = groupedScores[key]

      // Sort first to identify ties
      group.sort((a, b) => b.avg - a.avg)

      // Find ties
      const tiedGroups: Array<Array<(typeof group)[0]>> = []
      let currentTiedGroup: Array<(typeof group)[0]> = [group[0]]

      for (let i = 1; i < group.length; i++) {
        // Use rounded values for comparison to avoid floating-point issues
        const currentScore = roundToTwoDecimals(group[i].avg)
        const previousScore = roundToTwoDecimals(group[i - 1].avg)

        if (currentScore === previousScore) {
          currentTiedGroup.push(group[i])
        } else {
          if (currentTiedGroup.length > 1) {
            tiedGroups.push([...currentTiedGroup])
          }
          currentTiedGroup = [group[i]]
        }
      }

      if (currentTiedGroup.length > 1) {
        tiedGroups.push(currentTiedGroup)
      }

      // Apply tiebreaker to each tied group
      tiedGroups.forEach((tiedGroup) => {
        // Use the generic tiebreaker function
        applyGenericTiebreaker(
          tiedGroup,
          scores,
          rankingConfig as any, // Type assertion needed due to optional properties
          false, // isDetailedScores
          (contestantId, adjustment) => {
            // Find the contestant in the group and adjust its avg
            const contestant = tiedGroup.find((c) => c.id === contestantId)
            if (contestant) {
              contestant.avg = roundToTwoDecimals(contestant.avg + adjustment)
            }
          },
        )
      })

      // Re-sort the group after applying tiebreakers
      group.sort((a, b) => b.avg - a.avg)
    })
  }

  // Assign ranks after sorting - UPDATED to use RANK.AVG style
  Object.keys(groupedScores).forEach((key) => {
    const group = groupedScores[key]

    // Sort by avg score in descending order
    group.sort((a, b) => b.avg - a.avg)

    // Group contestants by score
    const scoreGroups: Record<number, Array<(typeof group)[0]>> = {}

    group.forEach((contestant) => {
      // Use fixed precision to handle floating point comparison
      const scoreKey = roundToTwoDecimals(contestant.avg)
      if (!scoreGroups[scoreKey]) {
        scoreGroups[scoreKey] = []
      }
      scoreGroups[scoreKey].push(contestant)
    })

    // Assign ranks using RANK.AVG style
    let currentPosition = 1

    // Sort scores in descending order
    const uniqueScores = Object.keys(scoreGroups)
      .map(Number)
      .sort((a, b) => b - a)

    uniqueScores.forEach((score) => {
      const tiedContestants = scoreGroups[score]
      const tieCount = tiedContestants.length

      // Calculate the average rank for this group
      const averageRank = roundToTwoDecimals(currentPosition + (tieCount - 1) / 2)

      // Assign the same average rank to all tied contestants
      tiedContestants.forEach((contestant) => {
        contestant.rank = averageRank
      })

      // Move position counter past this group
      currentPosition += tieCount
    })
  })

  return groupedScores
}

// For segment-specific calculations
export const calculateSegmentRankings = (
  scores: Record<string, Record<string, number>>,
  judges: Array<{ id: string }>,
  separateByGender: boolean,
  contestants: Array<Contestant & { currentSegmentId: string }>,
  segmentId: string,
  rankingConfig?: {
    method?: string
    trimPercentage?: number
    useSegmentWeights?: boolean
    segmentWeights?: Record<string, number>
    tiebreaker?: string
    tiebreakerCriterionId?: string
    customFormula?: string
  },
) => {
  // Filter contestants by segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Use the main ranking function with the filtered contestants
  return calculateRankings(scores, judges, separateByGender, segmentContestants, rankingConfig)
}
