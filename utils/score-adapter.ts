// Convert from database format to store format
export function dbToStoreScores(
  dbScores: any[],
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

    // Set the score for the specific criterion
    storeScores[segment_id][contestant_id][judge_id][criterion_id] = scoreValue
  })

  return storeScores
}

// Convert from store format to database format
export function storeToDbScores(
  storeScores: Record<string, Record<string, Record<string, Record<string, number>>>>,
  competitionId: number,
): {
  competitionId: number
  segmentId: string
  criterionId: string
  contestantId: string
  judgeId: string
  score: number
}[] {
  const dbScores: {
    competitionId: number
    segmentId: string
    criterionId: string
    contestantId: string
    judgeId: string
    score: number
  }[] = []

  // Iterate through segments
  Object.entries(storeScores).forEach(([segmentId, segmentScores]) => {
    // Iterate through contestants
    Object.entries(segmentScores).forEach(([contestantId, judgeScores]) => {
      // Iterate through judges
      Object.entries(judgeScores).forEach(([judgeId, criterionScores]) => {
        // Iterate through criteria
        Object.entries(criterionScores).forEach(([criterionId, score]) => {
          dbScores.push({
            competitionId,
            segmentId,
            criterionId,
            contestantId,
            judgeId,
            score,
          })
        })
      })
    })
  })

  return dbScores
}
