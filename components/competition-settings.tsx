import React, { useState } from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { v4 as uuidv4 } from "uuid";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

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
    if (segmentName.trim() === "") {
      toast.error("Enter segment name.");
      return;
    }
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
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Competition Details</CardTitle>
          <CardDescription>Set up the basic information about your competition</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Segments & Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Competition Segments</CardTitle>
          <CardDescription>Set up the segments that will make up your competition</CardDescription>
        </CardHeader>
        <CardContent>
        <div className="flex gap-2 mt-2">
          <Input 
            type="text" 
            placeholder="Segment Name" 
            value={segmentName} 
            onChange={(e) => setSegmentName(e.target.value)} 
          />
          <Button onClick={handleAddSegment}><Plus /> Add Segment</Button>
        </div>

        <Tabs defaultValue={competitionSettings.segments[0].id}>
          <TabsList className="mt-4">
            {competitionSettings.segments.map((segment) => (
              <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" key={segment.id} value={segment.id}>{segment.name}</TabsTrigger>
            ))}
          </TabsList>

          {competitionSettings.segments.map((segment) => (
            <TabsContent key={segment.id} value={segment.id}>
              <div className="mt-4">
              <Button onClick={() => removeSegment(segment.id)} className="mb-4 float-right" variant="destructive"><Trash2 /> Remove Segment</Button>
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
                <div className="border rounded-md space-y-2 mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Criteria</TableHead>
                        <TableHead>Maximum Points</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {segment.criteria.map((criterion) => (
                        <TableRow key={criterion.id} className="border-t">
                        <TableCell>{criterion.name} - {criterion.description}</TableCell>
                        <TableCell>{criterion.maxScore}</TableCell>
                        <TableCell><Button size="sm" variant="destructive" onClick={() => removeCriterion(segment.id, criterion.id)}><Trash2/></Button></TableCell>
                      </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </TabsContent>
          ))}
        </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default CompetitionSettings;
