import { create } from "zustand";

interface Criterion {
  id: string;
  name: string;
  description: string;
  maxScore: number;
}

interface Segment {
  id: string;
  name: string;
  advancingCandidates: number;
  criteria: Criterion[];
}

export interface Contestant {
  id: string;
  name: string;
  gender?: "Male" | "Female";
  currentSegmentId: string; // Tracks which segment the contestant is in
}

interface Judge {
  id: string;
  name: string;
  accessCode: string;
}

interface CompetitionSettings {
  name: string;
  separateRankingByGender: boolean;
  segments: Segment[];
}

interface CompetitionState {
  competitionSettings: CompetitionSettings;
  contestants: Contestant[];
  judges: Judge[];
  scores: Record<string, Record<string, number>>; // scores[contestantId][judgeId] = score
  setCompetitionSettings: (settings: CompetitionSettings) => void;
  addSegment: (name: string) => void;
  removeSegment: (segmentId: string) => void;
  addCriterion: (segmentId: string, criterion: Criterion) => void;
  removeCriterion: (segmentId: string, criterionId: string) => void;
  addContestant: (name: string, gender?: "Male" | "Female") => void;
  updateContestantSegment: (contestantId: string, segmentId: string) => void;
  removeContestant: (id: string) => void;
  addJudge: (name: string) => void;
  removeJudge: (id: string) => void;
  updateJudgeAccessCode: (id: string, newCode: string) => void;
  generateAccessCode: (judgeId: string) => void;
  setScores: (contestantId: string, judgeId: string, score: number) => void;
}

const useCompetitionStore = create<CompetitionState>((set) => ({
  competitionSettings: {
    name: "",
    separateRankingByGender: false,
    segments: [],
  },
  contestants: [],
  judges: [],
  scores: {},

  setCompetitionSettings: (settings) => set({ competitionSettings: settings }),

  addSegment: (name) =>
    set((state) => ({
      competitionSettings: {
        ...state.competitionSettings,
        segments: [
          ...state.competitionSettings.segments,
          { id: crypto.randomUUID(), name, advancingCandidates: 0, criteria: [] },
        ],
      },
    })),

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
          s.id === segmentId ? { ...s, criteria: [...s.criteria, criterion] } : s
        ),
      },
    })),

  removeCriterion: (segmentId, criterionId) =>
    set((state) => ({
      competitionSettings: {
        ...state.competitionSettings,
        segments: state.competitionSettings.segments.map((s) =>
          s.id === segmentId
            ? { ...s, criteria: s.criteria.filter((c) => c.id !== criterionId) }
            : s
        ),
      },
    })),

  addContestant: (name, gender = "Female") =>
    set((state) => {
      const newId = state.contestants.length + 1; // Sequential ID
      const firstSegmentId = state.competitionSettings.segments.length > 0
        ? state.competitionSettings.segments[0].id
        : "";
  
      return {
        contestants: [
          ...state.contestants,
          { id: newId.toString(), name, gender, currentSegmentId: firstSegmentId },
        ],
      };
    }),
  
  // updateContestantSegment: (contestantId: string, segmentId: string) =>
  //   set((state) => ({
  //     contestants: state.contestants.map((contestant) =>
  //       contestant.id === contestantId
  //         ? { ...contestant, currentSegmentId: segmentId }
  //         : contestant
  //     ),
  //   })),

  updateContestantSegment: (contestantId: string, segmentId: string) =>
    set((state) => ({
      contestants: state.contestants.map((c) =>
        c.id === contestantId ? { ...c, currentSegmentId: segmentId } : c
      ),
    })),
  

  removeContestant: (id) =>
    set((state) => ({
      contestants: state.contestants.filter((c) => c.id !== id),
    })),

  addJudge: (name) =>
    set((state) => ({
      judges: [...state.judges, { id: crypto.randomUUID(), name, accessCode: Math.random().toString(36).slice(2, 10) }],
    })),

  removeJudge: (id) =>
    set((state) => ({
      judges: state.judges.filter((j) => j.id !== id),
    })),

  updateJudgeAccessCode: (id, newCode) =>
    set((state) => ({
      judges: state.judges.map((judge) =>
        judge.id === id ? { ...judge, accessCode: newCode } : judge
      ),
    })),

  generateAccessCode: (judgeId) =>
    set((state) => ({
      judges: state.judges.map((j) =>
        j.id === judgeId ? { ...j, accessCode: Math.random().toString(36).slice(2, 10) } : j
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
}));

export default useCompetitionStore;
