import { saveAs } from "file-saver";
import useCompetitionStore from "./useCompetitionStore";

export const exportData = (type) => {
  const {
    competitionName,
    separateRankingsByGender,
    segments,
    contestants,
    judges,
    scores,
  } = useCompetitionStore.getState();

  let dataToExport = {};
  switch (type) {
    case "all":
      dataToExport = {
        competitionName,
        separateRankingsByGender,
        segments,
        contestants,
        judges,
        scores,
      };
      break;
    case "settings":
      dataToExport = { competitionName, separateRankingsByGender, segments };
      break;
    case "contestantsJudges":
      dataToExport = { contestants, judges };
      break;
    case "scores":
      dataToExport = { scores };
      break;
    default:
      return;
  }

  const json = JSON.stringify(dataToExport, null, 2);
  const blob = new Blob([json], { type: "application/json" });
  saveAs(blob, "competition_data.json");
};

export const importData = (jsonData, type) => {
  try {
    const data = JSON.parse(jsonData);
    const setStore = useCompetitionStore.getState();

    switch (type) {
      case "all":
        setStore.setCompetitionName(data.competitionName);
        setStore.setSeparateRankingsByGender(data.separateRankingsByGender);
        setStore.setSegments(data.segments);
        setStore.setContestants(data.contestants);
        setStore.setJudges(data.judges);
        setStore.setScores(data.scores);
        break;
      case "settings":
        setStore.setCompetitionName(data.competitionName);
        setStore.setSeparateRankingsByGender(data.separateRankingsByGender);
        setStore.setSegments(data.segments);
        break;
      case "contestantsJudges":
        setStore.setContestants(data.contestants);
        setStore.setJudges(data.judges);
        break;
      case "scores":
        setStore.setScores(data.scores);
        break;
      default:
        return;
    }
  } catch (error) {
    console.error("Error importing data:", error);
  }
};
