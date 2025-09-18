import { StateCreator } from "zustand"
import { CompetitionState, CompetitionSettings, Contestant, Judge } from "./types"
import { dbToStoreScores, storeToDbScores } from "../score-adapter"
import { globalEventEmitter, SCORE_UPDATED } from "../../lib/event-emitter"
import { invalidateRankingCache } from "../../lib/ranking-service"

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
    refreshScoresFromDatabase: () => Promise<void>;
    setupEventListeners: () => void;
    cleanupEventListeners: () => void;
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
      // Clean up existing event listeners before loading new competition
      get().cleanupEventListeners()

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

      // Set up event listeners for real-time synchronization
      get().setupEventListeners()
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

      // Only update if scores actually changed to prevent unnecessary re-renders
      const currentState = get()
      const currentScores = currentState.scores
      
      // Deep comparison to check if scores actually changed
      const scoresChanged = JSON.stringify(currentScores) !== JSON.stringify(storeScores)
      
      if (scoresChanged) {
        console.log("Scores changed, updating store")
        set({ scores: storeScores })
      } else {
        console.log("Scores unchanged, skipping store update")
      }
    } catch (error) {
      console.error("Error loading scores:", error)
      // Keep existing scores if loading fails
    }
  },

  // Refresh scores from database without changing competition
  refreshScoresFromDatabase: async () => {
    const state = get()
    const competitionId = state.selectedCompetitionId

    if (!competitionId) {
      console.warn("No competition selected, cannot refresh scores")
      return
    }

    try {
      const response = await fetch(`/api/scores?competitionId=${competitionId}`)

      if (!response.ok) {
        throw new Error("Failed to refresh scores from database")
      }

      const scoresData = await response.json()

      // Convert database format to store format
      const storeScores = dbToStoreScores(scoresData)

      // Only update if scores actually changed to prevent unnecessary re-renders
      const currentScores = state.scores
      const scoresChanged = JSON.stringify(currentScores) !== JSON.stringify(storeScores)
      
      if (scoresChanged) {
        set({ scores: storeScores })
        console.log("Scores refreshed from database - data changed")
      } else {
        console.log("Scores refreshed from database - no changes detected")
      }
    } catch (error) {
      console.error("Error refreshing scores:", error)
    }
  },

  // Set up event listeners for real-time synchronization
  setupEventListeners: () => {
    // Listen for score updates (including deletions)
    const handleScoreUpdate = (scoreData: any) => {
      const state = get()
      
      console.log("Event received:", scoreData)
      console.log("Current competition ID:", state.selectedCompetitionId)
      
      // Only process events for the current competition
      if (scoreData.competitionId && state.selectedCompetitionId && 
          scoreData.competitionId !== state.selectedCompetitionId) {
        console.log("Event ignored - different competition")
        return
      }

      // If it's a deletion event, update the store immediately
      if (scoreData.deleted) {
        console.log("Score deletion event received:", scoreData)
        
        // Use the deleteScore function from scoresSlice
        if (scoreData.segmentId && scoreData.contestantId && 
            scoreData.judgeId && scoreData.criterionId) {
          console.log("Deleting score from store...")
          state.deleteScore(
            scoreData.segmentId,
            scoreData.contestantId,
            scoreData.judgeId,
            scoreData.criterionId
          )
          console.log("Score deleted from store successfully")
        } else {
          console.warn("Incomplete score deletion data:", scoreData)
        }
      } else {
        // For score updates, refresh from database to ensure consistency
        console.log("Score update event received, refreshing from database...")
        state.refreshScoresFromDatabase()
      }

      // Invalidate ranking cache for this competition
      if (state.selectedCompetitionId) {
        console.log("Invalidating ranking cache for competition:", state.selectedCompetitionId)
        invalidateRankingCache(state.selectedCompetitionId)
      }
    }

    // Add the event listener
    globalEventEmitter.on(SCORE_UPDATED, handleScoreUpdate)

    // Store the handler reference for cleanup
    set({ _scoreUpdateHandler: handleScoreUpdate })
    
    console.log("Event listeners set up successfully")
  },

  // Clean up event listeners
  cleanupEventListeners: () => {
    const state = get()
    if (state._scoreUpdateHandler) {
      globalEventEmitter.off(SCORE_UPDATED, state._scoreUpdateHandler)
      set({ _scoreUpdateHandler: undefined })
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