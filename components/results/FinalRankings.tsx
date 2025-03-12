import React from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Card } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table";

interface Props {
  segmentId: string;
}

const FinalRankings: React.FC<Props> = ({segmentId}) => {
  const { contestants, scores, judges } = useCompetitionStore();

  // Compute total and average scores
  const rankings = contestants.map((contestant) => {
    const contestantScores = Object.values(scores[contestant.id] || {});
    const totalScore = contestantScores.reduce((acc, score) => acc + score, 0);
    const averageScore = contestantScores.length ? totalScore / judges.length : 0;
    
    return { ...contestant, totalScore, averageScore };
  });

  // Sort by total score in descending order
  rankings.sort((a, b) => b.totalScore - a.totalScore);

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Final Rankings</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Rank</TableHead>
            <TableHead>Contestant</TableHead>
            <TableHead>Candidate #</TableHead>
            <TableHead>Total Score</TableHead>
            <TableHead>Average Score</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rankings.map((contestant, index) => (
            <TableRow key={contestant.id}>
              <TableCell>{index + 1}</TableCell>
              <TableCell>{contestant.name}</TableCell>
              <TableCell>{contestant.id}</TableCell>
              <TableCell>{contestant.totalScore.toFixed(2)}</TableCell>
              <TableCell>{contestant.averageScore.toFixed(2)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default FinalRankings;
