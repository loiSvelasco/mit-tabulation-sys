import { create } from "zustand";

const generateAccessCode = () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Removed similar looking characters
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}
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
  updateContestantName: (contestantId: string, newName: string) => void;
  updateContestantSegment: (contestantId: string, segmentId: string) => void;
  removeContestant: (id: string) => void;
  addJudge: (name: string) => void;
  removeJudge: (id: string) => void;
  updateJudgeAccessCode: (id: string, newCode: string) => void;
  updateJudgeName: (id: string, newName: string) => void;
  generateAccessCode: (judgeId: string) => void;
  setScores: (contestantId: string, judgeId: string, score: number) => void;
  updateRankingMethod: (config: {
    rankingMethod: string;
    trimPercentage?: number;
    useSegmentWeights?: boolean;
    segmentWeights?: Record<string, number>;
    tiebreaker?: string;
    tiebreakerCriterionId?: string;
    customFormula?: string;
  }) => void;
}

const useCompetitionStore = create<CompetitionState>((set) => ({
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
            maxScore: 30
          },
          {
            id: "26c98b1b-f5d0-4cef-9349-62dd5302757e",
            name: "Swimsuit",
            description: "Summer Attire",
            maxScore: 20
          },
          {
            id: "d30e0346-8694-44c8-a430-f32cd54c184d",
            name: "Formal Wear",
            description: "Evening Gown",
            maxScore: 20
          },
          {
            id: "3a3eb14b-81ca-4c3b-b8b4-68c3c8f794ee",
            name: "Q&A",
            description: "Wit and Intelligence",
            maxScore: 30
          }
        ]
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
            maxScore: 50
          },
          {
            id: "5816702c-94c9-4162-9e98-46f12cfa578d",
            name: "Q&A",
            description: "Wit and Intelligence",
            maxScore: 50
          }
        ]
      }
    ],
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
    }
  ],
  judges: [
    {
      id: "a6774c84-2cce-4d8c-b5a8-0e6bd0fecf4c",
      name: "Judge 1",
      accessCode: "6N3GG7"
    },
    {
      id: "628fd605-8d7b-4a67-bc0b-cb11bde6192d",
      name: "Judge 2",
      accessCode: "AM96PY"
    },
    {
      id: "04d513ca-d422-45a3-968a-dd7f95779825",
      name: "Judge 3",
      accessCode: "8EVWE7"
    }
  ],
  scores: {},

  setCompetitionSettings: (settings) => set({ competitionSettings: settings }),

  addSegment: (name) =>
    set((state) => {
      const newId = state.competitionSettings.segments.length + 1; // Sequential ID
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
              criteria: [] 
            },
          ],
        },
      };
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
      const newId = state.contestants.length + 1;
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

  updateContestantName: (contestantId: string, newName: string) =>
    set((state) => ({
      contestants: state.contestants.map((c) =>
        c.id === contestantId ? { ...c, name: newName } : c
      ),
    })),
  

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
      judges: [...state.judges, { id: crypto.randomUUID(), name, accessCode: generateAccessCode() }],
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

  updateJudgeName: (id, newName) =>
    set((state) => ({
      judges: state.judges.map((judge) =>
        judge.id === id ? { ...judge, name: newName } : judge
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
