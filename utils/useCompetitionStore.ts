import { create } from "zustand"

const generateAccessCode = () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Removed similar looking characters
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

interface Criterion {
  id: string
  name: string
  description: string
  maxScore: number
}

interface Segment {
  id: string
  name: string
  advancingCandidates: number
  criteria: Criterion[]
}

export interface Contestant {
  id: string
  name: string
  gender?: "Male" | "Female"
  currentSegmentId: string // Tracks which segment the contestant is in
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

interface CompetitionSettings {
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
  scores: Record<string, Record<string, number>>
}

interface CompetitionState {
  competitionSettings: CompetitionSettings
  contestants: Contestant[]
  judges: Judge[]
  scores: Record<string, Record<string, number>> // scores[contestantId][judgeId] = score
  isSaving: boolean
  lastSaved: Date | null
  selectedCompetitionId: number | null
  setCompetitionSettings: (settings: CompetitionSettings) => void
  addSegment: (name: string) => void
  removeSegment: (segmentId: string) => void
  addCriterion: (segmentId: string, criterion: Criterion) => void
  removeCriterion: (segmentId: string, criterionId: string) => void
  addContestant: (name: string, gender?: "Male" | "Female") => void
  updateContestantName: (contestantId: string, newName: string) => void
  updateContestantSegment: (contestantId: string, segmentId: string) => void
  removeContestant: (id: string) => void
  addJudge: (name: string) => void
  removeJudge: (id: string) => void
  updateJudgeAccessCode: (id: string, newCode: string) => void
  updateJudgeName: (id: string, newName: string) => void
  generateAccessCode: (judgeId: string) => void
  setScores: (contestantId: string, judgeId: string, score: number) => void
  updateRankingConfig: (config: Partial<RankingConfig>) => void

  // New persistence methods
  saveCompetition: () => Promise<void>
  loadCompetition: (competitionId: number) => Promise<void>
  exportAllData: () => string
  importAllData: (jsonData: string) => void
  exportCompetitionSettings: () => string
  importCompetitionSettings: (jsonData: string) => void
  exportContestants: () => string
  importContestants: (jsonData: string) => void
  exportJudges: () => string
  importJudges: (jsonData: string) => void
  exportScores: () => string
  importScores: (jsonData: string) => void
  setSelectedCompetitionId: (id: number | null) => void
}

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
    },
    {
      id: "2",
      name: "Candidate 2",
      gender: "Female",
      currentSegmentId: "1",
    },
    {
      id: "3",
      name: "Candidate 3",
      gender: "Female",
      currentSegmentId: "1",
    },
    {
      id: "4",
      name: "Candidate 4",
      gender: "Female",
      currentSegmentId: "1",
    },
    {
      id: "5",
      name: "Candidate 5",
      gender: "Female",
      currentSegmentId: "1",
    },
    {
      id: "6",
      name: "Candidate 6",
      gender: "Female",
      currentSegmentId: "1",
    },
    {
      id: "7",
      name: "Candidate 7",
      gender: "Female",
      currentSegmentId: "1",
    },
    {
      id: "8",
      name: "Candidate 8",
      gender: "Female",
      currentSegmentId: "1",
    },
    {
      id: "9",
      name: "Candidate 9",
      gender: "Female",
      currentSegmentId: "1",
    },
    {
      id: "10",
      name: "Candidate 10",
      gender: "Female",
      currentSegmentId: "1",
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
    })),

  addContestant: (name, gender = "Female") =>
    set((state) => {
      const newId = state.contestants.length + 1
      const firstSegmentId =
        state.competitionSettings.segments.length > 0 ? state.competitionSettings.segments[0].id : ""

      return {
        contestants: [...state.contestants, { id: newId.toString(), name, gender, currentSegmentId: firstSegmentId }],
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

  setScores: (contestantId, judgeId, score) =>
    set((state) => ({
      scores: {
        ...state.scores,
        [contestantId]: {
          ...state.scores[contestantId],
          [judgeId]: score,
        },
      },
    })),

  updateRankingConfig: (config) =>
    set((state) => ({
      competitionSettings: {
        ...state.competitionSettings,
        ranking: {
          ...state.competitionSettings.ranking,
          ...config,
        },
      },
    })),

  // New persistence methods
  saveCompetition: async () => {
    set({ isSaving: true })

    try {
      const state = get()
      const competitionData = {
        competitionSettings: state.competitionSettings,
        contestants: state.contestants,
        judges: state.judges,
        scores: state.scores,
      }

      const response = await fetch("/api/competitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competitionData,
          name: state.competitionSettings.name,
          competitionId: state.selectedCompetitionId, // Pass the ID if updating an existing competition
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to save competition")
      }

      const result = await response.json()

      // If this was a new competition, store its ID for future updates
      if (!state.selectedCompetitionId && result.id) {
        set({ selectedCompetitionId: result.id })
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
        scores: competitionData.scores,
        lastSaved: new Date(),
        selectedCompetitionId: competitionId, // Set the selected competition ID
      })
    } catch (error) {
      console.error("Error loading competition:", error)
      throw error
    }
  },

  // Export/import methods for the entire competition data
  exportAllData: () => {
    const state = get()
    const competitionData = {
      competitionSettings: state.competitionSettings,
      contestants: state.contestants,
      judges: state.judges,
      scores: state.scores,
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
      })
    } catch (error) {
      console.error("Error importing data:", error)
      throw new Error("Invalid JSON data format")
    }
  },

  // Export/import methods for individual sections
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

  exportScores: () => {
    return JSON.stringify(get().scores, null, 2)
  },

  importScores: (jsonData) => {
    try {
      const scores = JSON.parse(jsonData) as Record<string, Record<string, number>>
      set({ scores })
    } catch (error) {
      console.error("Error importing scores:", error)
      throw new Error("Invalid scores format")
    }
  },
}))

export default useCompetitionStore

