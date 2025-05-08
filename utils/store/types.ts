// Define all shared types here
export interface Judge {
  id: string
  name: string
  accessCode: string
}

export interface Criterion {
  id: string
  name: string
  description: string
  maxScore: number
  isPrejudged?: boolean
  prejudgedBy?: string
	weight?: number
}

export interface Segment {
  id: string
  name: string
  advancingCandidates: number
  criteria: Criterion[]
}

export interface Contestant {
  id: string
  name: string
  gender: "Male" | "Female"
  currentSegmentId: string
  imageUrl: string | null
  displayOrder?: number
}

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

export interface CompetitionSettings {
  name: string
  separateRankingByGender: boolean
  segments: Segment[]
  ranking: RankingConfig
}

export interface ActiveCriterion {
  segmentId: string
  criterionId: string
}

export interface CompetitionData {
  competitionSettings: CompetitionSettings
  contestants: Contestant[]
  judges: Judge[]
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>
  activeCriteria?: ActiveCriterion[]
}

// Define slice state interfaces
export interface SettingsSlice {
  competitionSettings: CompetitionSettings
  setCompetitionSettings: (settings: CompetitionSettings) => void
  addSegment: (name: string) => void
  removeSegment: (segmentId: string) => void
  addCriterion: (segmentId: string, criterion: Criterion) => void
  removeCriterion: (segmentId: string, criterionId: string) => void
  updateRankingConfig: (config: Partial<RankingConfig>) => void
}

export interface ContestantsSlice {
  contestants: Contestant[]
  addContestant: (name: string, gender?: "Male" | "Female") => void
  updateContestantName: (contestantId: string, newName: string) => void
  updateContestantSegment: (contestantId: string, segmentId: string) => void
  updateContestantImage: (contestantId: string, imageUrl: string | null) => void
  updateContestantDisplayOrder: (contestantId: string, displayOrder: number) => void
  removeContestant: (id: string) => void
}

export interface JudgesSlice {
  judges: Judge[]
  addJudge: (name: string) => void
  removeJudge: (id: string) => void
  updateJudgeAccessCode: (id: string, newCode: string) => void
  updateJudgeName: (id: string, newName: string) => void
  generateAccessCode: (judgeId: string) => void
}

export interface ScoresSlice {
  scores: Record<string, Record<string, Record<string, Record<string, number>>>>
  setScores: (segmentId: string, contestantId: string, judgeId: string, criterionId: string, score: number) => void
  getTotalScore: (segmentId: string, contestantId: string, judgeId: string) => number
  getContestantTotalScores: (segmentId: string, contestantId: string) => number
  resetScores: () => Promise<void>
}

export interface PersistenceSlice {
  selectedCompetitionId: number | null
  setSelectedCompetitionId: (id: number | null) => void
  saveCompetition: () => Promise<void>
  loadCompetition: (competitionId: number) => Promise<void>
  loadScores: (competitionId: number) => Promise<void>
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
}

export interface UIStateSlice {
  isSaving: boolean
  lastSaved: Date | null
  activeCriteria: ActiveCriterion[]
  toggleActiveCriterion: (segmentId: string, criterionId: string) => void
  isActiveCriterion: (segmentId: string, criterionId: string) => boolean
  clearActiveCriteria: () => void
}

// Combined state type
export interface CompetitionState 
  extends SettingsSlice, 
    ContestantsSlice, 
    JudgesSlice, 
    ScoresSlice, 
    PersistenceSlice, 
    UIStateSlice {}