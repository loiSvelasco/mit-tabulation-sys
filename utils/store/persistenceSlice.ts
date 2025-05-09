import { StateCreator } from "zustand"
import { CompetitionState, CompetitionSettings, Contestant, Judge } from "./types"
import { dbToStoreScores, storeToDbScores } from "../score-adapter"

export const createPersistenceSlice: StateCreator<
  CompetitionState,
  [],
  [],
  {
    selectedCompetitionId: number | null;
    setSelectedCompetitionId: (id: number | null) => void;
    saveCompetition: () => Promise<void>;
    loadCompetition: (competitionId: number) => Promise<void>;
    loadScores: (competitionId: number) => Promise<void>;
    exportAllData: () => Promise<string>;
    importAllData: (jsonData: string) => void;
    exportCompetitionSettings: () => string;
    importCompetitionSettings: (jsonData: string) => void;
    exportContestants: () => string;
    importContestants: (jsonData: string) => void;
    exportJudges: () => string;
    importJudges: (jsonData: string) => void;
    exportScores: () => Promise<string>;
    importScores: (jsonData: string) => Promise<void>;
  }
> = (set, get, store) => ({
  selectedCompetitionId: null,

  setSelectedCompetitionId: (id) => set({ selectedCompetitionId: id }),

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
      const data = JSON.parse(jsonData)
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
})