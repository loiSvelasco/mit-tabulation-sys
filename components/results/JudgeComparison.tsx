import React from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Card } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table";

interface Props {
  segmentId: string;
}

const JudgeComparison: React.FC<Props> = ({segmentId}) => {
  const { contestants, judges, scores } = useCompetitionStore();

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Judge Scoring Comparison</h2>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Contestant</TableHead>
            {judges.map((judge) => (
              <TableHead key={judge.id}>{judge.name}</TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {contestants.map((contestant) => (
            <TableRow key={contestant.id}>
              <TableCell>{contestant.name}</TableCell>
              {judges.map((judge) => (
                <TableCell key={judge.id}>
                  {scores[contestant.id]?.[judge.id] || "N/A"}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
};

export default JudgeComparison;
