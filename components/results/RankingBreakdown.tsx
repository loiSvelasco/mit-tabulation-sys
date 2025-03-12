import React from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Card } from "@/components/ui/card";
import { Table, TableHead, TableRow, TableHeader, TableBody, TableCell } from "@/components/ui/table";

interface Props {
  segmentId: string;
}

const RankingBreakdown: React.FC<Props> = ({segmentId}) => {
  const { contestants, judges, scores, competitionSettings } = useCompetitionStore();
  const separateByGender = competitionSettings.separateRankingByGender;

  let groupedContestants = separateByGender
    ? { Male: contestants.filter(c => c.gender === "Male"), Female: contestants.filter(c => c.gender === "Female") }
    : { All: contestants };

  return (
    <Card className="p-4">
      <h2 className="text-lg font-semibold mb-4">Breakdown of Calculation for Ranking</h2>
      {Object.entries(groupedContestants).map(([group, groupContestants]) => (
        <div key={group} className="mb-6">
          <h3 className="font-semibold">{separateByGender ? `${group} Division` : "Overall"}</h3>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Candidate #</TableHead>
                <TableHead>Candidate Name</TableHead>
                {judges.map(j => <TableHead key={j.id}>{j.name}</TableHead>)}
                <TableHead>Final Rank</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupContestants.map(contestant => (
                <TableRow key={contestant.id}>
                  <TableCell>{contestant.id}</TableCell>
                  <TableCell>{contestant.name}</TableCell>
                  {judges.map(j => (
                    <TableCell key={j.id}>{scores[contestant.id]?.[j.id] || 0}</TableCell>
                  ))}
                  <TableCell>TODO: Compute final ranking</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      ))}
    </Card>
  );
};

export default RankingBreakdown;
