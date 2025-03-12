import React from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Card } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table";

interface Props {
  segmentId: string;
}

const DetailedScores: React.FC<Props> = ({segmentId}) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore();

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Detailed Scores by Criterion</h2>
      {competitionSettings.segments.map((segment) => (
        <div key={segment.id} className="mb-6">
          <h3 className="font-semibold">{segment.name}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contestant</TableHead>
                {segment.criteria.map((criterion) => (
                  <TableHead key={criterion.id}>{criterion.name} (Max: {criterion.maxScore})</TableHead>
                ))}
                <TableHead>Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {contestants.map((contestant) => {
                const totalScore = segment.criteria.reduce((acc, criterion) => {
                  return acc + (scores[contestant.id]?.[criterion.id] || 0);
                }, 0);

                return (
                  <TableRow key={contestant.id}>
                    <TableCell>{contestant.name}</TableCell>
                    {segment.criteria.map((criterion) => (
                      <TableCell key={criterion.id}>{scores[contestant.id]?.[criterion.id] || 0}</TableCell>
                    ))}
                    <TableCell>{totalScore}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      ))}
    </Card>
  );
};

export default DetailedScores;
