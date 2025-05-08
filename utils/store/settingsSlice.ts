import { StateCreator } from "zustand"
import { CompetitionState, CompetitionSettings, Criterion, RankingConfig } from "./types"

export const createSettingsSlice: StateCreator<
  CompetitionState,
  [],
  [],
  {
    competitionSettings: CompetitionSettings;
    setCompetitionSettings: (settings: CompetitionSettings) => void;
    addSegment: (name: string) => void;
    removeSegment: (segmentId: string) => void;
    addCriterion: (segmentId: string, criterion: Criterion) => void;
    removeCriterion: (segmentId: string, criterionId: string) => void;
    updateRankingConfig: (config: Partial<RankingConfig>) => void;
  }
> = (set, get, store) => ({
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
    ranking: {
      method: "avg",
      tiebreaker: "highest-score",
      useSegmentWeights: false,
    },
  },

  setCompetitionSettings: (settings: CompetitionSettings) => set({ competitionSettings: settings }),

  addSegment: (name) =>
    set((state) => {
      const newId = state.competitionSettings.segments.length + 1 // Sequential ID
      return {
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

  addCriterion: (segmentId, criterion: Criterion) =>
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

  updateRankingConfig: (config: Partial<RankingConfig>) => {
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
})