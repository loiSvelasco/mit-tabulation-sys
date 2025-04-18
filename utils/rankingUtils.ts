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
    const scoreKey = Number(score)
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
    const averageRank = currentPosition + (tieCount - 1) / 2

    // Assign the same average rank to all tied contestants
    tiedContestants.forEach((id) => {
      ranks[id] = averageRank
    })

    // Move position counter past this group
    currentPosition += tieCount
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
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>,
  segmentId: string,
  rankingConfig: RankingConfig,
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
        allScores.push(...criterionScores)
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
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          // Sum all criterion scores for this judge
          judgeScores[contestant.id] = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
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
        if (scores[segmentId]?.[contestant.id]?.[judge.id]) {
          // Sum all criterion scores for this judge
          judgeScores[contestant.id] = Object.values(scores[segmentId][contestant.id][judge.id]).reduce(
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
      score: finalScores[contestant.id] || 0,
      rank: index + 1,
    }
  })

  return result
}

// Apply tiebreaker rules
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
    const scoreKey = Number.parseFloat(score.toFixed(6))

    if (!scoreGroups[scoreKey]) {
      scoreGroups[scoreKey] = []
    }
    scoreGroups[scoreKey].push(contestantId)
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
          if (scores[segmentId]?.[contestantId]) {
            Object.keys(scores[segmentId][contestantId]).forEach((judgeId) => {
              Object.values(scores[segmentId][contestantId][judgeId]).forEach((score) => {
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
            if (scores[segmentId]?.[contestantA] && scores[segmentId]?.[contestantB]) {
              Object.keys(scores[segmentId][contestantA]).forEach((judgeId) => {
                if (scores[segmentId][contestantB][judgeId]) {
                  // Calculate total scores for each contestant from this judge
                  const scoreA = Object.values(scores[segmentId][contestantA][judgeId]).reduce(
                    (sum, score) => sum + score,
                    0,
                  )
                  const scoreB = Object.values(scores[segmentId][contestantB][judgeId]).reduce(
                    (sum, score) => sum + score,
                    0,
                  )

                  if (scoreA > scoreB) aWins++
                  if (scoreB > scoreA) bWins++
                }
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
            if (scores[segmentId]?.[contestantId]) {
              Object.values(scores[segmentId][contestantId]).forEach((judgeScores) => {
                if (judgeScores[rankingConfig.tiebreakerCriterionId!]) {
                  totalCriterionScore += judgeScores[rankingConfig.tiebreakerCriterionId!]
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
        judgeScores.push(scores[judge.id][contestant.id])
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

        case "custom":
          if (rankingConfig.customFormula) {
            try {
              const avg_score = calculateAverageScore(judgeScores)
              const median_score = calculateMedianScore(judgeScores)
              const min_score = Math.min(...(judgeScores.length ? judgeScores : [0]))
              const max_score = Math.max(...(judgeScores.length ? judgeScores : [0]))
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

              calculatedScore = formula(avg_score, median_score, min_score, max_score, judge_count)
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
      calculatedScore = judgeScores.length > 0 ? total / judgeScores.length : 0
    }

    // Add to the appropriate group
    const key = separateByGender && contestant.gender ? contestant.gender : "all"
    if (groupedScores[key]) {
      groupedScores[key].push({
        ...contestant,
        total,
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
        if (Math.abs(group[i].avg - group[i - 1].avg) < 0.0001) {
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
        switch (rankingConfig.tiebreaker) {
          case "highest-score":
            // Break tie by highest individual score
            tiedGroup.forEach((contestant) => {
              const judgeScores: number[] = []
              judges.forEach((judge) => {
                if (scores[judge.id]?.[contestant.id] !== undefined) {
                  judgeScores.push(scores[judge.id][contestant.id])
                }
              })

              contestant.highestScore = Math.max(...(judgeScores.length ? judgeScores : [0]))
            })

            // Sort by highest score and adjust avg slightly to break tie
            tiedGroup.sort((a, b) => (b.highestScore || 0) - (a.highestScore || 0))
            tiedGroup.forEach((contestant, index) => {
              contestant.avg += index * 0.0001
            })
            break

          case "head-to-head":
            // Compare how many judges ranked one contestant higher than the other
            const winCounts: Record<string, number> = {}
            tiedGroup.forEach((contestant) => {
              winCounts[contestant.id] = 0
            })

            // For each pair of contestants
            for (let i = 0; i < tiedGroup.length; i++) {
              for (let j = i + 1; j < tiedGroup.length; j++) {
                const contestantA = tiedGroup[i]
                const contestantB = tiedGroup[j]
                let aWins = 0
                let bWins = 0

                // Compare scores from each judge
                judges.forEach((judge) => {
                  const scoreA = scores[judge.id]?.[contestantA.id] || 0
                  const scoreB = scores[judge.id]?.[contestantB.id] || 0

                  if (scoreA > scoreB) aWins++
                  if (scoreB > scoreA) bWins++
                })

                if (aWins > bWins) winCounts[contestantA.id]++
                if (bWins > aWins) winCounts[contestantB.id]++
              }
            }

            // Sort by win count and adjust avg slightly to break tie
            tiedGroup.sort((a, b) => winCounts[b.id] - winCounts[a.id])
            tiedGroup.forEach((contestant, index) => {
              contestant.avg += index * 0.0001
            })
            break

          case "specific-criteria":
            // This would require access to scores by criterion, which isn't in your current data model
            // For now, we'll just use a placeholder implementation
            tiedGroup.forEach((contestant, index) => {
              contestant.avg += index * 0.0001
            })
            break

          default:
            // No tiebreaker, leave scores as is
            break
        }
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
      const scoreKey = Number(contestant.avg.toFixed(6))
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
      const averageRank = currentPosition + (tieCount - 1) / 2

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
