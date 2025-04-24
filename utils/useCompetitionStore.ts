import { create } from "zustand"
import type { CompetitionSettings as CompetitionSettingsType, Contestant as ContestantType, Criterion } from "./types"
import { dbToStoreScores, storeToDbScores } from "./score-adapter"

const generateAccessCode = () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Removed similar looking characters
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

interface Judge {
  id: string
  name: string
  accessCode: string
}

// New ranking configuration types
export type RankingMethod =
  | "avg"
  | "avg-rank"
  | "rank-avg-rank"
  | "weighted"
  | "trimmed"
  | "median"
  | "borda"
  | "custom"

export type TiebreakerMethod = "highest-score" | "head-to-head" | "specific-criteria" | "none"

export interface RankingConfig {
  method: RankingMethod
  trimPercentage?: number
  useSegmentWeights?: boolean
  segmentWeights?: Record<string, number>
  tiebreaker: TiebreakerMethod
  tiebreakerCriterionId?: string
  customFormula?: string
}

// Define active criteria type
export interface ActiveCriterion {
  segmentId: string
  criterionId: string
}

interface Segment {
  id: string
  name: string
  advancingCandidates: number
  criteria: Criterion[]
}

// Update the Contestant interface to allow null for imageUrl
// Find the Contestant interface and update the imageUrl property to be nullable

interface Contestant extends ContestantType {
  id: string
  name: string
  gender: "Male" | "Female"
  currentSegmentId: string
  imageUrl: string | null
}

interface CompetitionSettings extends CompetitionSettingsType {
  name: string
  separateRankingByGender: boolean
  segments: Segment[]
  // Add ranking configuration to settings
  ranking: RankingConfig
}

// Define the structure of the entire competition data for export/import
export interface CompetitionData {
  competitionSettings: CompetitionSettings
  contestants: Contestant[]
  judges: Judge[]
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>
  activeCriteria?: ActiveCriterion[] // Add this to export/import active criteria
}

// Add these to your existing CompetitionState interface
interface CompetitionState {
  competitionSettings: CompetitionSettings
  contestants: Contestant[]
  judges: Judge[]
  // Updated scores structure: scores[segmentId][contestantId][judgeId][criterionId] = score
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>
  isSaving: boolean
  lastSaved: Date | null
  selectedCompetitionId: number | null

  // Replace single active segment/criterion with array of active criteria
  activeCriteria: ActiveCriterion[]

  setCompetitionSettings: (settings: CompetitionSettings) => void
  addSegment: (name: string) => void
  removeSegment: (segmentId: string) => void
  addCriterion: (segmentId: string, criterion: Criterion) => void
  removeCriterion: (segmentId: string, criterionId: string) => void
  addContestant: (name: string, gender?: "Male" | "Female") => void
  updateContestantName: (contestantId: string, newName: string) => void
  updateContestantSegment: (contestantId: string, segmentId: string) => void
  updateContestantImage: (contestantId: string, imageUrl: string | null) => void // New method
  removeContestant: (id: string) => void
  addJudge: (name: string) => void
  removeJudge: (id: string) => void
  updateJudgeAccessCode: (id: string, newCode: string) => void
  updateJudgeName: (id: string, newName: string) => void
  generateAccessCode: (judgeId: string) => void
  setScores: (segmentId: string, contestantId: string, judgeId: string, criterionId: string, score: number) => void
  getTotalScore: (segmentId: string, contestantId: string, judgeId: string) => number
  getContestantTotalScores: (segmentId: string, contestantId: string) => number
  updateRankingConfig: (config: Partial<RankingConfig>) => void

  // New persistence methods
  saveCompetition: () => Promise<void>
  loadCompetition: (competitionId: number) => Promise<void>
  loadScores: (competitionId: number) => Promise<void> // New method to load scores from DB
  exportAllData: () => Promise<string>
  importAllData: (jsonData: string) => void
  exportCompetitionSettings: () => string
  importCompetitionSettings: (jsonData: string) => void
  exportContestants: () => string
  importContestants: (jsonData: string) => void
  exportJudges: () => string
  importJudges: (jsonData: string) => void
  exportScores: () => Promise<string>
  importScores: (jsonData: string) => Promise<void>
  setSelectedCompetitionId: (id: number | null) => void

  // Replace single active segment/criterion methods with these
  toggleActiveCriterion: (segmentId: string, criterionId: string) => void
  isActiveCriterion: (segmentId: string, criterionId: string) => boolean
  clearActiveCriteria: () => void
}

// Function to apply pre-judged scores to all judges
const applyPrejudgedScores = (
  segmentId: string,
  contestants: Contestant[],
  criteria: Criterion[],
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>,
  judges: any[], // Assuming judges is an array of judge objects
) => {
  // Get pre-judged criteria for this segment
  const prejudgedCriteria = criteria.filter((c) => c.isPrejudged && c.prejudgedBy)

  if (prejudgedCriteria.length === 0) return scores

  // Get contestants in this segment
  const segmentContestants = contestants.filter((c) => c.currentSegmentId === segmentId)

  // Create a copy of the scores object
  const updatedScores = { ...scores }

  // Initialize segment if it doesn't exist
  if (!updatedScores[segmentId]) {
    updatedScores[segmentId] = {}
  }

  // For each contestant and pre-judged criterion, copy the admin's score to all judges
  segmentContestants.forEach((contestant) => {
    // Initialize contestant if needed
    if (!updatedScores[segmentId][contestant.id]) {
      updatedScores[segmentId][contestant.id] = {}
    }

    prejudgedCriteria.forEach((criterion) => {
      const adminId = criterion.prejudgedBy

      if (!adminId) return

      // Get the admin's score for this criterion
      const adminScore = updatedScores[segmentId]?.[contestant.id]?.[adminId]?.[criterion.id]

      if (adminScore === undefined) return

      // Apply this score to all judges
      judges.forEach((judge) => {
        // Initialize judge if needed
        if (!updatedScores[segmentId][contestant.id][judge.id]) {
          updatedScores[segmentId][contestant.id][judge.id] = {}
        }

        // Set the judge's score to match the admin's score
        updatedScores[segmentId][contestant.id][judge.id][criterion.id] = adminScore
      })
    })
  })

  return updatedScores
}

// Add these to your store implementation
const useCompetitionStore = create<CompetitionState>((set, get) => ({
  competitionSettings: {
    name: "Beauty Pageant",
    separateRankingByGender: false,
    segments: [
      {
        id: "1",
        name: "Preliminary",
        advancingCandidates: 10,
        criteria: [
          {
            id: "38cfe650-23a9-4613-9420-f29b701c530f",
            name: "Beauty",
            description: "Overall Physical Appearance",
            maxScore: 30,
          },
          {
            id: "26c98b1b-f5d0-4cef-9349-62dd5302757e",
            name: "Swimsuit",
            description: "Summer Attire",
            maxScore: 20,
          },
          {
            id: "d30e0346-8694-44c8-a430-f32cd54c184d",
            name: "Formal Wear",
            description: "Evening Gown",
            maxScore: 20,
          },
          {
            id: "3a3eb14b-81ca-4c3b-b8b4-68c3c8f794ee",
            name: "Q&A",
            description: "Wit and Intelligence",
            maxScore: 30,
          },
        ],
      },
      {
        id: "2",
        name: "Final",
        advancingCandidates: 3,
        criteria: [
          {
            id: "770d1856-2a7b-4d30-b9d3-b069d001de40",
            name: "Beauty",
            description: "Overall Physical Appearance",
            maxScore: 50,
          },
          {
            id: "5816702c-94c9-4162-9e98-46f12cfa578d",
            name: "Q&A",
            description: "Wit and Intelligence",
            maxScore: 50,
          },
        ],
      },
    ],
    // Add default ranking configuration
    ranking: {
      method: "avg",
      tiebreaker: "highest-score",
      useSegmentWeights: false,
    },
  },
  contestants: [
    {
      id: "1",
      name: "Candidate 1",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "2",
      name: "Candidate 2",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "3",
      name: "Candidate 3",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "4",
      name: "Candidate 4",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "5",
      name: "Candidate 5",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "6",
      name: "Candidate 6",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "7",
      name: "Candidate 7",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "8",
      name: "Candidate 8",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "9",
      name: "Candidate 9",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
    {
      id: "10",
      name: "Candidate 10",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
    },
  ],
  judges: [
    {
      id: "a6774c84-2cce-4d8c-b5a8-0e6bd0fecf4c",
      name: "Judge 1",
      accessCode: "6N3GG7",
    },
    {
      id: "628fd605-8d7b-4a67-bc0b-cb11bde6192d",
      name: "Judge 2",
      accessCode: "AM96PY",
    },
    {
      id: "04d513ca-d422-45a3-968a-dd7f95779825",
      name: "Judge 3",
      accessCode: "8EVWE7",
    },
  ],
  scores: {},
  isSaving: false,
  lastSaved: null,
  selectedCompetitionId: null,

  // Replace single active segment/criterion with array
  activeCriteria: [],

  setCompetitionSettings: (settings) => set({ competitionSettings: settings }),
  setSelectedCompetitionId: (id) => set({ selectedCompetitionId: id }),

  addSegment: (name) =>
    set((state) => {
      const newId = state.competitionSettings.segments.length + 1 // Sequential ID
      return {
        ...state, // Ensure the entire state is returned properly
        competitionSettings: {
          ...state.competitionSettings,
          segments: [
            ...state.competitionSettings.segments,
            {
              id: newId.toString(),
              name,
              advancingCandidates: 0,
              criteria: [],
            },
          ],
        },
      }
    }),

  removeSegment: (segmentId) =>
    set((state) => ({
      competitionSettings: {
        ...state.competitionSettings,
        segments: state.competitionSettings.segments.filter((s) => s.id !== segmentId),
      },
      // Also remove any active criteria for this segment
      activeCriteria: state.activeCriteria.filter((ac) => ac.segmentId !== segmentId),
    })),

  addCriterion: (segmentId, criterion) =>
    set((state) => ({
      competitionSettings: {
        ...state.competitionSettings,
        segments: state.competitionSettings.segments.map((s) =>
          s.id === segmentId ? { ...s, criteria: [...s.criteria, criterion] } : s,
        ),
      },
    })),

  removeCriterion: (segmentId, criterionId) =>
    set((state) => ({
      competitionSettings: {
        ...state.competitionSettings,
        segments: state.competitionSettings.segments.map((s) =>
          s.id === segmentId ? { ...s, criteria: s.criteria.filter((c) => c.id !== criterionId) } : s,
        ),
      },
      // Also remove this criterion from active criteria if it exists
      activeCriteria: state.activeCriteria.filter(
        (ac) => !(ac.segmentId === segmentId && ac.criterionId === criterionId),
      ),
    })),

  addContestant: (name, gender = "Female") =>
    set((state) => {
      const newId = state.contestants.length + 1
      const firstSegmentId =
        state.competitionSettings.segments.length > 0 ? state.competitionSettings.segments[0].id : ""

      return {
        contestants: [
          ...state.contestants,
          { id: newId.toString(), name, gender, currentSegmentId: firstSegmentId, imageUrl: null },
        ],
      }
    }),

  updateContestantName: (contestantId: string, newName: string) =>
    set((state) => ({
      contestants: state.contestants.map((c) => (c.id === contestantId ? { ...c, name: newName } : c)),
    })),

  updateContestantSegment: (contestantId: string, segmentId: string) =>
    set((state) => ({
      contestants: state.contestants.map((c) => (c.id === contestantId ? { ...c, currentSegmentId: segmentId } : c)),
    })),

  // New method to update contestant image
  updateContestantImage: (contestantId: string, imageUrl: string | null) =>
    set((state) => ({
      contestants: state.contestants.map((c) => (c.id === contestantId ? { ...c, imageUrl: imageUrl } : c)),
    })),

  removeContestant: (id) =>
    set((state) => ({
      contestants: state.contestants.filter((c) => c.id !== id),
    })),

  addJudge: (name) =>
    set((state) => ({
      judges: [...state.judges, { id: crypto.randomUUID(), name, accessCode: generateAccessCode() }],
    })),

  removeJudge: (id) =>
    set((state) => ({
      judges: state.judges.filter((j) => j.id !== id),
    })),

  updateJudgeAccessCode: (id, newCode) =>
    set((state) => ({
      judges: state.judges.map((judge) => (judge.id === id ? { ...judge, accessCode: newCode } : judge)),
    })),

  updateJudgeName: (id, newName) =>
    set((state) => ({
      judges: state.judges.map((judge) => (judge.id === id ? { ...judge, name: newName } : judge)),
    })),

  generateAccessCode: (judgeId) =>
    set((state) => ({
      judges: state.judges.map((j) =>
        j.id === judgeId ? { ...j, accessCode: Math.random().toString(36).slice(2, 10) } : j,
      ),
    })),

  // MODIFIED: Update setScores to save to database with better error handling and proper decimal rounding
  // Also skip saving scores for "admin" to avoid cluttering the database
  setScores: (segmentId: string, contestantId: string, judgeId: string, criterionId: string, score: number) => {
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

  // NEW: Add loadScores method to fetch scores from database
  loadScores: async (competitionId) => {
    try {
      const response = await fetch(`/api/scores?competitionId=${competitionId}`)

      if (!response.ok) {
        throw new Error("Failed to load scores from database")
      }

      const scoresData = await response.json()

      // Convert database format to store format
      const storeScores = dbToStoreScores(scoresData)

      set({ scores: storeScores })
    } catch (error) {
      console.error("Error loading scores:", error)
      // Keep existing scores if loading fails
    }
  },

  updateRankingConfig: (config) => {
    console.log("Store: Updating ranking config with:", config)
    console.log("Store: Current ranking config:", get().competitionSettings.ranking)

    set((state) => {
      const newConfig = {
        ...state.competitionSettings,
        ranking: {
          ...state.competitionSettings.ranking,
          ...config,
        },
      }

      console.log("Store: New ranking config will be:", newConfig.ranking)

      return {
        competitionSettings: newConfig,
      }
    })

    // Log the updated config after the state change
    console.log("Store: Updated ranking config is now:", get().competitionSettings.ranking)
  },

  // MODIFIED: Update saveCompetition to properly handle new competitions
  saveCompetition: async () => {
    set({ isSaving: true })

    try {
      const state = get()
      const competitionData = {
        competitionSettings: state.competitionSettings,
        contestants: state.contestants,
        judges: state.judges,
        // Don't include scores here, they're saved separately
        scores: {},
        // Include active criteria
        activeCriteria: state.activeCriteria,
      }

      // Check if we're updating an existing competition or creating a new one
      const isNewCompetition = !state.selectedCompetitionId

      // If creating a new competition, clear the selectedCompetitionId to ensure a new one is created
      if (isNewCompetition) {
        console.log("Creating a new competition")
      } else {
        console.log("Updating existing competition:", state.selectedCompetitionId)
      }

      const response = await fetch("/api/competitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competitionData,
          name: state.competitionSettings.name,
          // Only pass competitionId if we're updating an existing competition
          competitionId: isNewCompetition ? null : state.selectedCompetitionId,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to save competition")
      }

      const result = await response.json()

      // If this was a new competition, store its ID for future updates
      if (isNewCompetition && result.id) {
        set({ selectedCompetitionId: result.id })

        // If we have scores in memory, save them to the database for the new competition
        if (Object.keys(state.scores).length > 0) {
          await get().exportScores()
        }
      }

      set({
        isSaving: false,
        lastSaved: new Date(),
      })

      return result
    } catch (error) {
      console.error("Error saving competition:", error)
      set({ isSaving: false })
      throw error
    }
  },

  // MODIFIED: Update loadCompetition to load scores from database
  loadCompetition: async (competitionId) => {
    try {
      const response = await fetch(`/api/competitions/${competitionId}/data`)

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to load competition")
      }

      const competitionData = await response.json()

      set({
        competitionSettings: competitionData.competitionSettings,
        contestants: competitionData.contestants,
        judges: competitionData.judges,
        // Don't set scores here, we'll load them separately
        lastSaved: new Date(),
        selectedCompetitionId: competitionId,
        // Load active criteria if available
        activeCriteria: competitionData.activeCriteria || [],
      })

      // Load scores from database
      await get().loadScores(competitionId)
    } catch (error) {
      console.error("Error loading competition:", error)
      throw error
    }
  },

  // MODIFIED: Update exportAllData to include scores from database
  exportAllData: async () => {
    const state = get()
    const competitionId = state.selectedCompetitionId

    // Fetch latest scores from database if we have a competition ID
    let scores = state.scores
    if (competitionId) {
      try {
        const response = await fetch(`/api/scores?competitionId=${competitionId}`)

        if (response.ok) {
          const scoresData = await response.json()
          scores = dbToStoreScores(scoresData)
        }
      } catch (error) {
        console.error("Error fetching scores for export:", error)
        // Use existing scores if fetch fails
      }
    }

    const competitionData = {
      competitionSettings: state.competitionSettings,
      contestants: state.contestants,
      judges: state.judges,
      scores: scores,
      activeCriteria: state.activeCriteria,
    }

    return JSON.stringify(competitionData, null, 2)
  },

  importAllData: (jsonData) => {
    try {
      const data = JSON.parse(jsonData) as CompetitionData
      set({
        competitionSettings: data.competitionSettings,
        contestants: data.contestants,
        judges: data.judges,
        scores: data.scores,
        activeCriteria: data.activeCriteria || [],
      })

      // If we have a selected competition, save the imported scores to the database
      const competitionId = get().selectedCompetitionId
      if (competitionId && Object.keys(data.scores).length > 0) {
        // We'll handle this in a separate function to avoid making this async
        get().importScores(JSON.stringify(data.scores))
      }
    } catch (error) {
      console.error("Error importing data:", error)
      throw new Error("Invalid JSON data format")
    }
  },

  exportCompetitionSettings: () => {
    return JSON.stringify(get().competitionSettings, null, 2)
  },

  importCompetitionSettings: (jsonData) => {
    try {
      const settings = JSON.parse(jsonData) as CompetitionSettings
      set({ competitionSettings: settings })
    } catch (error) {
      console.error("Error importing competition settings:", error)
      throw new Error("Invalid competition settings format")
    }
  },

  exportContestants: () => {
    return JSON.stringify(get().contestants, null, 2)
  },

  importContestants: (jsonData) => {
    try {
      const contestants = JSON.parse(jsonData) as Contestant[]
      set({ contestants })
    } catch (error) {
      console.error("Error importing contestants:", error)
      throw new Error("Invalid contestants format")
    }
  },

  exportJudges: () => {
    return JSON.stringify(get().judges, null, 2)
  },

  importJudges: (jsonData) => {
    try {
      const judges = JSON.parse(jsonData) as Judge[]
      set({ judges })
    } catch (error) {
      console.error("Error importing judges:", error)
      throw new Error("Invalid judges format")
    }
  },

  // MODIFIED: Update exportScores to fetch from database
  exportScores: async () => {
    try {
      const state = get()
      const competitionId = state.selectedCompetitionId

      if (!competitionId) {
        // If no competition is selected, just export the in-memory scores
        return JSON.stringify(state.scores, null, 2)
      }

      // Fetch scores from database
      const response = await fetch(`/api/scores?competitionId=${competitionId}`)

      if (!response.ok) {
        throw new Error("Failed to fetch scores from database")
      }

      const scoresData = await response.json()

      // Transform the data to match the current structure
      const formattedScores = dbToStoreScores(scoresData)

      return JSON.stringify(formattedScores, null, 2)
    } catch (error) {
      console.error("Error exporting scores:", error)
      // Fall back to in-memory scores if database fetch fails
      return JSON.stringify(get().scores, null, 2)
    }
  },

  // MODIFIED: Update importScores to save to database
  importScores: async (jsonData) => {
    try {
      const scores = JSON.parse(jsonData) as Record<string, Record<string, Record<string, Record<string, number>>>>
      const state = get()
      const competitionId = state.selectedCompetitionId

      // Update local state first for immediate UI feedback
      set({ scores })

      // If we have a competition ID, save to database
      if (competitionId) {
        // First, clear existing scores for this competition
        await fetch(`/api/scores?competitionId=${competitionId}`, {
          method: "DELETE",
        })

        // Convert store format to database format
        const dbScores = storeToDbScores(scores, competitionId)

        // Then import new scores
        const scorePromises = dbScores.map((scoreData) =>
          fetch("/api/scores", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(scoreData),
          }),
        )

        await Promise.all(scorePromises)
      }
    } catch (error) {
      console.error("Error importing scores:", error)
      throw new Error("Invalid scores format")
    }
  },

  // Replace single active segment/criterion methods with these
  toggleActiveCriterion: (segmentId, criterionId) => {
    set((state) => {
      const isActive = state.activeCriteria.some((ac) => ac.segmentId === segmentId && ac.criterionId === criterionId)

      if (isActive) {
        // Remove if already active
        return {
          activeCriteria: state.activeCriteria.filter(
            (ac) => !(ac.segmentId === segmentId && ac.criterionId === criterionId),
          ),
        }
      } else {
        // Add if not active
        return {
          activeCriteria: [...state.activeCriteria, { segmentId, criterionId }],
        }
      }
    })
  },

  isActiveCriterion: (segmentId, criterionId) => {
    return get().activeCriteria.some((ac) => ac.segmentId === segmentId && ac.criterionId === criterionId)
  },

  clearActiveCriteria: () => {
    set({ activeCriteria: [] })
  },
}))

export default useCompetitionStore
