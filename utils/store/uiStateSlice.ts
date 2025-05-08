import { StateCreator } from "zustand"
import { CompetitionState, ActiveCriterion } from "./types"

export const createUIStateSlice: StateCreator<
  CompetitionState,
  [],
  [],
  {
    isSaving: boolean;
    lastSaved: Date | null;
    activeCriteria: ActiveCriterion[];
    toggleActiveCriterion: (segmentId: string, criterionId: string) => void;
    isActiveCriterion: (segmentId: string, criterionId: string) => boolean;
    clearActiveCriteria: () => void;
  }
> = (set, get, store) => ({
  isSaving: false,
  lastSaved: null,
  activeCriteria: [],

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
})