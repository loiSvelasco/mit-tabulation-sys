export const calculateRankings = (scores, judges, separateByGender, contestants) => {
  const groupedScores = {};
  
  if (separateByGender) {
    contestants.forEach(({ gender }) => {
      if (!groupedScores[gender]) groupedScores[gender] = [];
    });
  } else {
    groupedScores["all"] = [];
  }

  contestants.forEach((contestant) => {
    const totalScores = judges.map((judge) => scores[judge]?.[contestant.id] || 0);
    const total = totalScores.reduce((acc, score) => acc + score, 0);
    const avg = totalScores.length > 0 ? total / totalScores.length : 0;
    const key = separateByGender ? contestant.gender : "all";
    groupedScores[key].push({ ...contestant, total, avg });
  });

  Object.keys(groupedScores).forEach((key) => {
    groupedScores[key].sort((a, b) => b.avg - a.avg);
    groupedScores[key].forEach((contestant, index) => {
      contestant.rank = index + 1;
    });
  });

  return groupedScores;
};
