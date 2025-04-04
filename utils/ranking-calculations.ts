import type { CompetitionSettings, Contestant, Judge, Score } from "@/utils/useCompetitionStore"

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

// Main ranking function that applies the selected method
export function rankContestants(
  contestants: Contestant[],
  judges: Judge[],
  scores: Score[],
  settings: CompetitionSettings,
  segmentId: string,
): Contestant[] {
  const { rankingMethod, trimPercentage, useSegmentWeights, segmentWeights, tiebreaker } = settings

  // Get all scores for this segment
  const segmentScores = scores.filter((score) => score.segmentId === segmentId)

  // Create a map of contestant scores by judge
  const contestantScoresByJudge: Record<string, Record<string, number>> = {}

  // Initialize with all contestants
  contestants.forEach((contestant) => {
    contestantScoresByJudge[contestant.id] = {}
  })

  // Fill in scores
  segmentScores.forEach((score) => {
    if (!contestantScoresByJudge[score.contestantId]) {
      contestantScoresByJudge[score.contestantId] = {}
    }

    if (!contestantScoresByJudge[score.contestantId][score.judgeId]) {
      contestantScoresByJudge[score.contestantId][score.judgeId] = 0
    }

    // Add to the judge's score for this contestant
    contestantScoresByJudge[score.contestantId][score.judgeId] += score.score
  })

  // Calculate final scores based on the selected method
  const finalScores: Record<string, number> = {}

  switch (rankingMethod) {
    case "avg":
      // Simple average
      Object.entries(contestantScoresByJudge).forEach(([contestantId, judgeScores]) => {
        const scores = Object.values(judgeScores)
        finalScores[contestantId] = calculateAverageScore(scores)
      })
      break

    case "avg-rank":
      // Average then rank
      const avgScores: Record<string, number> = {}
      Object.entries(contestantScoresByJudge).forEach(([contestantId, judgeScores]) => {
        const scores = Object.values(judgeScores)
        avgScores[contestantId] = calculateAverageScore(scores)
      })

      // Convert to ranks
      const ranks = convertScoresToRanks(avgScores)
      Object.assign(finalScores, ranks)
      break

    case "rank-avg-rank":
      // Rank per judge, average ranks, then rank again
      const judgeRanks: Record<string, Record<string, number>> = {}

      // For each judge, rank their scores
      judges.forEach((judge) => {
        const judgeScores: Record<string, number> = {}

        // Get this judge's scores for all contestants
        Object.entries(contestantScoresByJudge).forEach(([contestantId, scores]) => {
          if (scores[judge.id]) {
            judgeScores[contestantId] = scores[judge.id]
          }
        })

        // Convert to ranks
        judgeRanks[judge.id] = convertScoresToRanks(judgeScores)
      })

      // Average the ranks for each contestant
      const avgRanks: Record<string, number> = {}
      Object.keys(contestantScoresByJudge).forEach((contestantId) => {
        const ranks: number[] = []

        judges.forEach((judge) => {
          if (judgeRanks[judge.id]?.[contestantId]) {
            ranks.push(judgeRanks[judge.id][contestantId])
          }
        })

        avgRanks[contestantId] = calculateAverageScore(ranks)
      })

      // Rank the average ranks (lower is better for ranks)
      const finalRanks = Object.entries(avgRanks)
        .sort((a, b) => a[1] - b[1])
        .reduce(
          (acc, [id, _], index) => {
            acc[id] = index + 1
            return acc
          },
          {} as Record<string, number>,
        )

      Object.assign(finalScores, finalRanks)
      break

    case "trimmed":
      // Trimmed mean
      Object.entries(contestantScoresByJudge).forEach(([contestantId, judgeScores]) => {
        const scores = Object.values(judgeScores)
        finalScores[contestantId] = calculateTrimmedMean(scores, trimPercentage || 20)
      })
      break

    case "median":
      // Median score
      Object.entries(contestantScoresByJudge).forEach(([contestantId, judgeScores]) => {
        const scores = Object.values(judgeScores)
        finalScores[contestantId] = calculateMedianScore(scores)
      })
      break

    case "borda":
      // Borda count
      const bordaScores: Record<string, number> = {}
      const contestantCount = Object.keys(contestantScoresByJudge).length

      // Initialize borda scores
      Object.keys(contestantScoresByJudge).forEach((contestantId) => {
        bordaScores[contestantId] = 0
      })

      // For each judge, calculate Borda points
      judges.forEach((judge) => {
        const judgeScores: Record<string, number> = {}

        // Get this judge's scores for all contestants
        Object.entries(contestantScoresByJudge).forEach(([contestantId, scores]) => {
          if (scores[judge.id]) {
            judgeScores[contestantId] = scores[judge.id]
          }
        })

        // Convert to ranks
        const ranks = convertScoresToRanks(judgeScores)

        // Assign Borda points (contestantCount - rank + 1)
        Object.entries(ranks).forEach(([contestantId, rank]) => {
          bordaScores[contestantId] += contestantCount - rank + 1
        })
      })

      Object.assign(finalScores, bordaScores)
      break

    case "custom":
      // Custom formula
      if (settings.customFormula) {
        Object.entries(contestantScoresByJudge).forEach(([contestantId, judgeScores]) => {
          const scores = Object.values(judgeScores)

          // Calculate variables for the formula
          const avg_score = calculateAverageScore(scores)
          const median_score = calculateMedianScore(scores)
          const min_score = Math.min(...scores)
          const max_score = Math.max(...scores)
          const judge_count = scores.length

          try {
            // Evaluate the formula
            // eslint-disable-next-line no-new-func
            const formula = new Function(
              "avg_score",
              "median_score",
              "min_score",
              "max_score",
              "judge_count",
              `return ${settings.customFormula}`,
            )

            finalScores[contestantId] = formula(avg_score, median_score, min_score, max_score, judge_count)
          } catch (error) {
            console.error("Error evaluating custom formula:", error)
            finalScores[contestantId] = avg_score // Fallback to average
          }
        })
      } else {
        // Fallback to average if no formula provided
        Object.entries(contestantScoresByJudge).forEach(([contestantId, judgeScores]) => {
          const scores = Object.values(judgeScores)
          finalScores[contestantId] = calculateAverageScore(scores)
        })
      }
      break

    default:
      // Default to average
      Object.entries(contestantScoresByJudge).forEach(([contestantId, judgeScores]) => {
        const scores = Object.values(judgeScores)
        finalScores[contestantId] = calculateAverageScore(scores)
      })
  }

  // Apply tiebreaker if needed
  if (tiebreaker !== "none") {
    applyTiebreaker(finalScores, contestantScoresByJudge, settings, segmentId)
  }

  // Sort contestants by their final scores
  return [...contestants].sort((a, b) => {
    const scoreA = finalScores[a.id] || 0
    const scoreB = finalScores[b.id] || 0

    // For rank-based methods, lower is better
    if (rankingMethod === "avg-rank" || rankingMethod === "rank-avg-rank") {
      return scoreA - scoreB
    }

    // For all other methods, higher is better
    return scoreB - scoreA
  })
}

// Apply tiebreaker rules
function applyTiebreaker(
  finalScores: Record<string, number>,
  contestantScoresByJudge: Record<string, Record<string, number>>,
  settings: CompetitionSettings,
  segmentId: string,
): void {
  const { tiebreaker, tiebreakerCriterionId } = settings

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

    switch (tiebreaker) {
      case "highest-score":
        // Break tie by highest individual score
        const highestScores: Record<string, number> = {}

        contestantIds.forEach((contestantId) => {
          const scores = Object.values(contestantScoresByJudge[contestantId])
          highestScores[contestantId] = Math.max(...scores)
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
            Object.keys(contestantScoresByJudge[contestantA]).forEach((judgeId) => {
              const scoreA = contestantScoresByJudge[contestantA][judgeId] || 0
              const scoreB = contestantScoresByJudge[contestantB][judgeId] || 0

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
        // Break tie based on a specific criterion
        if (tiebreakerCriterionId) {
          // This would require access to the original scores by criterion
          // For now, we'll just use a placeholder implementation
          // In a real implementation, you would look up scores for the specific criterion
          contestantIds.forEach((contestantId, index) => {
            finalScores[contestantId] += index * 0.0001
          })
        }
        break

      default:
        // No tiebreaker, leave scores as is
        break
    }
  })
}

