// Define types for better type safety
interface DbScore {
  segment_id: string
  contestant_id: string
  judge_id: string
  criterion_id: string
  score: number
}

interface ApiScore {
  competitionId: number
  segmentId: string
  criteriaId: string // Changed from criterionId to criteriaId
  contestantId: string
  judgeId: string
  score: number
}

// Convert from database format to store format
export function dbToStoreScores(
  dbScores: DbScore[],
): Record<string, Record<string, Record<string, Record<string, number>>>> {
  const storeScores: Record<string, Record<string, Record<string, Record<string, number>>>> = {}

  dbScores.forEach((score) => {
    const { segment_id, contestant_id, judge_id, criterion_id, score: scoreValue } = score

    if (!storeScores[segment_id]) {
      storeScores[segment_id] = {}
    }

    if (!storeScores[segment_id][contestant_id]) {
      storeScores[segment_id][contestant_id] = {}
    }

    if (!storeScores[segment_id][contestant_id][judge_id]) {
      storeScores[segment_id][contestant_id][judge_id] = {}
    }

    // Round the score to exactly 2 decimal places when loading from database
    const roundedScore = Number(scoreValue.toFixed(2))

    // Set the score for the specific criterion
    storeScores[segment_id][contestant_id][judge_id][criterion_id] = roundedScore
  })

  return storeScores
}

// Convert from store format to database format
export function storeToDbScores(
  storeScores: Record<string, Record<string, Record<string, Record<string, number>>>>,
  competitionId: number,
): ApiScore[] {
  const dbScores: ApiScore[] = []

  // Iterate through segments
  Object.entries(storeScores).forEach(([segmentId, segmentScores]) => {
    // Iterate through contestants
    Object.entries(segmentScores).forEach(([contestantId, judgeScores]) => {
      // Iterate through judges
      Object.entries(judgeScores).forEach(([judgeId, criterionScores]) => {
        // Skip admin scores
        if (judgeId === "admin") return

        // Iterate through criteria
        Object.entries(criterionScores).forEach(([criterionId, score]) => {
          // Ensure score is rounded to exactly 2 decimal places
          const roundedScore = Number(score.toFixed(2))

          dbScores.push({
            competitionId,
            segmentId,
            criteriaId: criterionId, // Changed from criterionId to criteriaId to match API expectation
            contestantId,
            judgeId,
            score: roundedScore,
          })
        })
      })
    })
  })

  return dbScores
}
