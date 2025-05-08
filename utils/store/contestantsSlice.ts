import { StateCreator } from "zustand"
import { CompetitionState, Contestant } from "./types"

export const createContestantsSlice: StateCreator<
  CompetitionState,
  [],
  [],
  {
    contestants: Contestant[];
    addContestant: (name: string, gender?: "Male" | "Female") => void;
    updateContestantName: (contestantId: string, newName: string) => void;
    updateContestantSegment: (contestantId: string, segmentId: string) => void;
    updateContestantImage: (contestantId: string, imageUrl: string | null) => void;
    updateContestantDisplayOrder: (contestantId: string, displayOrder: number) => void;
    removeContestant: (id: string) => void;
  }
> = (set, get, store) => ({
  contestants: [
    {
      id: "1",
      name: "Candidate 1",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 1,
    },
    {
      id: "2",
      name: "Candidate 2",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 2,
    },
    {
      id: "3",
      name: "Candidate 3",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 3,
    },
    {
      id: "4",
      name: "Candidate 4",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 4,
    },
    {
      id: "5",
      name: "Candidate 5",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 5,
    },
    {
      id: "6",
      name: "Candidate 6",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 6,
    },
    {
      id: "7",
      name: "Candidate 7",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 7,
    },
    {
      id: "8",
      name: "Candidate 8",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 8,
    },
    {
      id: "9",
      name: "Candidate 9",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 9,
    },
    {
      id: "10",
      name: "Candidate 10",
      gender: "Female",
      currentSegmentId: "1",
      imageUrl: null,
      displayOrder: 10,
    },
  ],

  addContestant: (name, gender = "Female") =>
    set((state) => {
      const newId = state.contestants.length + 1
      const firstSegmentId =
        state.competitionSettings.segments.length > 0 ? state.competitionSettings.segments[0].id : ""

      return {
        contestants: [
          ...state.contestants,
          {
            id: newId.toString(),
            name,
            gender,
            currentSegmentId: firstSegmentId,
            imageUrl: null,
            displayOrder: newId,
          },
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

  updateContestantImage: (contestantId: string, imageUrl: string | null) =>
    set((state) => ({
      contestants: state.contestants.map((c) => (c.id === contestantId ? { ...c, imageUrl: imageUrl } : c)),
    })),

  updateContestantDisplayOrder: (contestantId: string, displayOrder: number) =>
    set((state) => ({
      contestants: state.contestants.map((c) => (c.id === contestantId ? { ...c, displayOrder } : c)),
    })),

  removeContestant: (id) =>
    set((state) => ({
      contestants: state.contestants.filter((c) => c.id !== id),
    })),
})