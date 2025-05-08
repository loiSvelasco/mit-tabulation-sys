import { StateCreator } from "zustand"
import { CompetitionState, Judge } from "./types"

// Helper function to generate access code
const generateAccessCode = () => {
  const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Removed similar looking characters
  let result = ""
  for (let i = 0; i < 6; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length))
  }
  return result
}

export const createJudgesSlice: StateCreator<
  CompetitionState,
  [],
  [],
  {
    judges: Judge[];
    addJudge: (name: string) => void;
    removeJudge: (id: string) => void;
    updateJudgeAccessCode: (id: string, newCode: string) => void;
    updateJudgeName: (id: string, newName: string) => void;
    generateAccessCode: (judgeId: string) => void;
  }
> = (set, get, store) => ({
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
        j.id === judgeId ? { ...j, accessCode: generateAccessCode() } : j
      ),
    })),
})