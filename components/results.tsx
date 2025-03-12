import React from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import FinalRankings from "./results/FinalRankings";
import DetailedScores from "./results/DetailedScores";
import JudgeComparison from "./results/JudgeComparison";
import RankingBreakdown from "./results/RankingBreakdown";

const Results = () => {
  
  const { competitionSettings } = useCompetitionStore();
  const { segments } = competitionSettings; // ✅ Access segments correctly

  return (
    <Tabs defaultValue={segments[0]?.id || "no-segments"}>
      <TabsList>
        {segments.length > 0 ? (
          segments.map((segment) => (
            <TabsTrigger key={segment.id} value={segment.id}>
              {segment.name}
            </TabsTrigger>
          ))
        ) : (
          <TabsTrigger value="no-segments" disabled>No Segments</TabsTrigger>
        )}
      </TabsList>

      {segments.length > 0 ? (
        segments.map((segment) => (
          <TabsContent key={segment.id} value={segment.id}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card><FinalRankings segmentId={segment.id} /></Card>
              <Card><DetailedScores segmentId={segment.id} /></Card>
              <Card><JudgeComparison segmentId={segment.id} /></Card>
              <Card><RankingBreakdown segmentId={segment.id} /></Card>
            </div>
          </TabsContent>
        ))
      ) : (
        <TabsContent value="no-segments">
          <p className="text-center text-gray-500">No segments available.</p>
        </TabsContent>
      )}
    </Tabs>
  );
};

export default Results;
