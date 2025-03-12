import React, { useState } from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { v4 as uuidv4 } from "uuid";

const CompetitionSettings = () => {
  const {
    competitionSettings,
    setCompetitionSettings,
    addSegment,
    removeSegment,
    addCriterion,
    removeCriterion,
  } = useCompetitionStore();

  const [segmentName, setSegmentName] = useState("");
  const [criteriaInput, setCriteriaInput] = useState({ name: "", description: "", maxScore: 10, segmentId: "" });

  const handleCompetitionNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompetitionSettings({ ...competitionSettings, name: e.target.value });
  };

  const handleToggleRankingByGender = () => {
    setCompetitionSettings({ ...competitionSettings, separateRankingByGender: !competitionSettings.separateRankingByGender });
  };

  const handleAddSegment = () => {
    if (segmentName.trim() === "") return;
    addSegment(segmentName);
    setSegmentName("");
  };

  const handleAddCriterion = (segmentId: string) => {
    if (!criteriaInput.name.trim()) return;
    addCriterion(segmentId, {
      id: uuidv4(),
      name: criteriaInput.name,
      description: criteriaInput.description,
      maxScore: criteriaInput.maxScore,
    });
    setCriteriaInput({ ...criteriaInput, name: "", description: "", maxScore: 10 });
  };

  return (
    <div className="space-y-4">
      {/* Competition Details */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold">Competition Details</h2>
        <Input 
          type="text" 
          placeholder="Competition Name" 
          value={competitionSettings.name} 
          onChange={handleCompetitionNameChange} 
          className="mt-2"
        />
        <div className="flex items-center gap-2 mt-4">
          <Checkbox 
            checked={competitionSettings.separateRankingByGender} 
            onCheckedChange={handleToggleRankingByGender} 
          />
          <label>Separate rankings by gender</label>
        </div>
      </Card>

      {/* Segments & Criteria */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold">Competition Segments</h2>
        <div className="flex gap-2 mt-2">
          <Input 
            type="text" 
            placeholder="Segment Name" 
            value={segmentName} 
            onChange={(e) => setSegmentName(e.target.value)} 
          />
          <Button onClick={handleAddSegment}>Add Segment</Button>
        </div>

        <Tabs defaultValue="">
          <TabsList className="mt-4">
            {competitionSettings.segments.map((segment) => (
              <TabsTrigger key={segment.id} value={segment.id}>{segment.name}</TabsTrigger>
            ))}
          </TabsList>

          {competitionSettings.segments.map((segment) => (
            <TabsContent key={segment.id} value={segment.id}>
              <div className="mt-4">
                <h3 className="text-md font-semibold">Advancing Candidates</h3>
                <Input
                  type="number"
                  min="0"
                  value={segment.advancingCandidates}
                  onChange={(e) => {
                    setCompetitionSettings({
                      ...competitionSettings,
                      segments: competitionSettings.segments.map((s) =>
                        s.id === segment.id ? { ...s, advancingCandidates: Number(e.target.value) } : s
                      ),
                    });
                  }}
                  className="mt-2"
                />
                <Button onClick={() => removeSegment(segment.id)} className="mt-2" variant="destructive">Remove Segment</Button>
              </div>

              {/* Criteria */}
              <div className="mt-6">
                <h3 className="text-md font-semibold">Criteria for Judging</h3>
                <div className="flex gap-2 mt-2">
                  <Input
                    type="text"
                    placeholder="Criterion Name"
                    value={criteriaInput.name}
                    onChange={(e) => setCriteriaInput({ ...criteriaInput, name: e.target.value, segmentId: segment.id })}
                  />
                  <Input
                    type="text"
                    placeholder="Description"
                    value={criteriaInput.description}
                    onChange={(e) => setCriteriaInput({ ...criteriaInput, description: e.target.value })}
                  />
                  <Input
                    type="number"
                    min="1"
                    max="100"
                    placeholder="Max Score"
                    value={criteriaInput.maxScore}
                    onChange={(e) => setCriteriaInput({ ...criteriaInput, maxScore: Number(e.target.value) })}
                  />
                  <Button onClick={() => handleAddCriterion(segment.id)}>Add Criterion</Button>
                </div>

                <ul className="mt-4 space-y-2">
                  {segment.criteria.map((criterion) => (
                    <li key={criterion.id} className="flex justify-between p-2 border rounded">
                      <div>
                        <span className="font-medium">{criterion.name}</span> - {criterion.description} (Max: {criterion.maxScore})
                      </div>
                      <Button size="sm" variant="destructive" onClick={() => removeCriterion(segment.id, criterion.id)}>Remove</Button>
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </Card>
    </div>
  );
};

export default CompetitionSettings;
