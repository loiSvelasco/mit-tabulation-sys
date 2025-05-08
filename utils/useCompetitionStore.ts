import { create } from "zustand"
import { createSettingsSlice } from "./store/settingsSlice"
import { createContestantsSlice } from "./store/contestantsSlice"
import { createJudgesSlice } from "./store/judgesSlice"
import { createScoresSlice } from "./store/scoresSlice"
import { createPersistenceSlice } from "./store/persistenceSlice"
import { createUIStateSlice } from "./store/uiStateSlice"
import type { CompetitionState } from "./store/types"

// Re-export types to maintain compatibility
export type {
  RankingMethod,
  TiebreakerMethod,
  RankingConfig,
  ActiveCriterion,
  CompetitionData,
} from "./store/types"

// Zustand v5 pattern
const useCompetitionStore = create<CompetitionState>()(
  (set, get, store) => ({
    ...createSettingsSlice(set, get, store),
    ...createContestantsSlice(set, get, store),
    ...createJudgesSlice(set, get, store),
    ...createScoresSlice(set, get, store),
    ...createPersistenceSlice(set, get, store),
    ...createUIStateSlice(set, get, store),
  })
)

export default useCompetitionStore