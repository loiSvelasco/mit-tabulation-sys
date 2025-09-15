import { StateCreator } from "zustand"
import { CompetitionState } from "./types"

export const createScoresSlice: StateCreator<
  CompetitionState,
  [],
  [],
  {
    scores: Record<string, Record<string, Record<string, Record<string, number>>>>;
    setScores: (segmentId: string, contestantId: string, judgeId: string, criterionId: string, score: number) => void;
    deleteScore: (segmentId: string, contestantId: string, judgeId: string, criterionId: string) => void;
    getTotalScore: (segmentId: string, contestantId: string, judgeId: string) => number;
    getContestantTotalScores: (segmentId: string, contestantId: string) => number;
    resetScores: () => Promise<void>;
  }
> = (set, get, store) => ({
  scores: {},

  setScores: (segmentId: string, contestantId: string, judgeId: string, criterionId: string, score: number) => {
    // Validate input parameters
    if (!segmentId || !contestantId || !judgeId || !criterionId) {
      console.error("Invalid score parameters:", { segmentId, contestantId, judgeId, criterionId, score })
      return
    }

    if (typeof score !== 'number' || isNaN(score) || score < 0) {
      console.error("Invalid score value:", score)
      return
    }

    // Round the score to exactly 2 decimal places
    const roundedScore = Number(score.toFixed(2))

    // Skip saving scores for "admin" - we only want to save scores for actual judges
    if (judgeId === "admin") {
      // Still update the local state for UI purposes, but don't save to database
      set((state) => {
        // Create a deep copy of the current scores to avoid mutation issues
        const newScores = { ...state.scores }

        // Initialize segment scores object if it doesn't exist
        if (!newScores[segmentId]) {
          newScores[segmentId] = {}
        }

        // Initialize contestant scores object if it doesn't exist
        if (!newScores[segmentId][contestantId]) {
          newScores[segmentId][contestantId] = {}
        }

        // Initialize judge scores object if it doesn't exist
        if (!newScores[segmentId][contestantId][judgeId]) {
          newScores[segmentId][contestantId][judgeId] = {}
        }

        // Check if score already exists and log for debugging
        const existingScore = newScores[segmentId][contestantId][judgeId][criterionId]
        if (existingScore !== undefined) {
          console.log(`Replacing existing score: ${existingScore} -> ${roundedScore} for ${judgeId}/${contestantId}/${criterionId}`)
        }

        // Set the score for the specific criterion with exactly 2 decimal places
        newScores[segmentId][contestantId][judgeId][criterionId] = roundedScore

        return { scores: newScores }
      })

      return // Don't proceed to database saving
    }

    // Update the store immediately for UI feedback
    set((state) => {
      // Create a deep copy of the current scores to avoid mutation issues
      const newScores = { ...state.scores }

      // Initialize segment scores object if it doesn't exist
      if (!newScores[segmentId]) {
        newScores[segmentId] = {}
      }

      // Initialize contestant scores object if it doesn't exist
      if (!newScores[segmentId][contestantId]) {
        newScores[segmentId][contestantId] = {}
      }

      // Initialize judge scores object if it doesn't exist
      if (!newScores[segmentId][contestantId][judgeId]) {
        newScores[segmentId][contestantId][judgeId] = {}
      }

      // Check if score already exists and log for debugging
      const existingScore = newScores[segmentId][contestantId][judgeId][criterionId]
      if (existingScore !== undefined) {
        console.log(`Replacing existing score: ${existingScore} -> ${roundedScore} for ${judgeId}/${contestantId}/${criterionId}`)
      }

      // Set the score for the specific criterion with exactly 2 decimal places
      newScores[segmentId][contestantId][judgeId][criterionId] = roundedScore

      return { scores: newScores }
    })

    // Then try to save to the database (but don't block the UI update)
    const state = get()
    const competitionId = state.selectedCompetitionId

    if (competitionId) {
      // Get the segment and criterion
      const segment = state.competitionSettings.segments.find((s) => s.id === segmentId)
      const criterion = segment?.criteria.find((c) => c.id === criterionId)

      if (segment && criterion) {
        const scoreData = {
          competitionId,
          segmentId,
          criteriaId: criterionId, // Changed from criterionId to criteriaId to match API expectation
          contestantId,
          judgeId,
          score: roundedScore, // Use the rounded score here too
        }

        console.log("Saving score to database:", scoreData)

        fetch("/api/scores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(scoreData),
        })
          .then((response) => {
            if (!response.ok) {
              return response.json().then((data) => {
                throw new Error(`Failed to save score: ${data.error || response.statusText}`)
              })
            }
            return response.json()
          })
          .then((data) => {
            console.log("Score saved successfully:", data)
          })
          .catch((error) => {
            console.error("Error saving score to database:", error)
          })
      }
    }
  },

  // Delete a specific score from the store
  deleteScore: (segmentId: string, contestantId: string, judgeId: string, criterionId: string) => {
    set((state) => {
      // Create a deep copy of the current scores to avoid mutation issues
      const newScores = { ...state.scores }

      // Check if the score exists before trying to delete it
      if (newScores[segmentId]?.[contestantId]?.[judgeId]?.[criterionId] !== undefined) {
        // Delete the specific score
        delete newScores[segmentId][contestantId][judgeId][criterionId]

        // Clean up empty objects to prevent memory leaks
        if (Object.keys(newScores[segmentId][contestantId][judgeId]).length === 0) {
          delete newScores[segmentId][contestantId][judgeId]
        }
        if (Object.keys(newScores[segmentId][contestantId]).length === 0) {
          delete newScores[segmentId][contestantId]
        }
        if (Object.keys(newScores[segmentId]).length === 0) {
          delete newScores[segmentId]
        }

        console.log(`Score deleted from store: ${segmentId}/${contestantId}/${judgeId}/${criterionId}`)
      }

      return { scores: newScores }
    })
  },

  // Helper function to get the total score for a contestant from a judge in a segment
  getTotalScore: (segmentId: string, contestantId: string, judgeId: string) => {
    const state = get()
    const judgeScores = state.scores[segmentId]?.[contestantId]?.[judgeId] || {}

    // Sum all criterion scores
    return Object.values(judgeScores).reduce((total, score) => total + score, 0)
  },

  // Helper function to get the total score for a contestant across all judges in a segment
  getContestantTotalScores: (segmentId: string, contestantId: string) => {
    const state = get()
    const contestantScores = state.scores[segmentId]?.[contestantId] || {}

    let totalScore = 0

    // Sum scores from all judges
    Object.keys(contestantScores).forEach((judgeId) => {
      const judgeScores = contestantScores[judgeId] || {}
      totalScore += Object.values(judgeScores).reduce((sum, score) => sum + score, 0)
    })

    return totalScore
  },

  // Reset scores
  resetScores: async () => {
    try {
      const competitionId = get().selectedCompetitionId
      if (!competitionId) return

      // Call API to reset scores in the database
      const response = await fetch('/api/scores/reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competitionId })
      })
      
      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || 'Failed to reset scores')
      }

      // Get all segments and identify pre-judged criteria
      const segments = get().competitionSettings.segments
      const prejudgedCriteria = segments.flatMap((segment) =>
        segment.criteria
          .filter((criterion) => criterion.isPrejudged)
          .map((criterion) => ({
            segmentId: segment.id,
            criterionId: criterion.id,
          })),
      )

      // Create a new scores object with only pre-judged scores
      const currentScores = get().scores
      const newScores = {} as Record<string, Record<string, Record<string, Record<string, number>>>>

      // For each segment
      Object.keys(currentScores).forEach((segmentId) => {
        // Check if this segment has any pre-judged criteria
        const segmentPrejudgedCriteria = prejudgedCriteria
          .filter((c) => c.segmentId === segmentId)
          .map((c) => c.criterionId)

        if (segmentPrejudgedCriteria.length > 0) {
          // Initialize segment if it has pre-judged criteria
          newScores[segmentId] = {}

          // For each contestant in this segment
          Object.keys(currentScores[segmentId] || {}).forEach((contestantId) => {
            newScores[segmentId][contestantId] = {}

            // For each judge
            Object.keys(currentScores[segmentId][contestantId] || {}).forEach((judgeId) => {
              newScores[segmentId][contestantId][judgeId] = {}

              // Only keep pre-judged criteria scores
              segmentPrejudgedCriteria.forEach((criterionId) => {
                if (currentScores[segmentId]?.[contestantId]?.[judgeId]?.[criterionId] !== undefined) {
                  newScores[segmentId][contestantId][judgeId][criterionId] =
                    currentScores[segmentId][contestantId][judgeId][criterionId]
                }
              })
            })
          })
        }
      })

      // Update state with new scores
      set({ scores: newScores })

      return
    } catch (error) {
      console.error("Error resetting scores:", error)
      throw error
    }
  },
})