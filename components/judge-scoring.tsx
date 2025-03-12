import React, { useState } from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EyeIcon, EyeOffIcon, RefreshCcwIcon, Trash2Icon, EditIcon } from "lucide-react";
import { v4 as uuidv4 } from "uuid";

const JudgeScoring = () => {
  const {
    competitionSettings,
    contestants,
    judges,
    addContestant,
    removeContestant,
    addJudge,
    removeJudge,
    updateJudgeAccessCode,
    updateContestantSegment,
  } = useCompetitionStore();

  const [contestantName, setContestantName] = useState("");
	const [contestantGender, setContestantGender] = useState<"Male" | "Female">("Female"); // ✅ Explicit type

  const [judgeName, setJudgeName] = useState("");
  const [showAccessCodes, setShowAccessCodes] = useState<{ [key: string]: boolean }>({});

  const handleAddContestant = () => {
		if (!contestantName.trim()) return;
	
		addContestant(contestantName, contestantGender); // ✅ Match function signature
		setContestantName("");
	};

	const handleAddJudge = () => {
		if (!judgeName.trim()) return;
	
		addJudge(judgeName); // ✅ Match function signature
		setJudgeName("");
	};

  const toggleAccessCodeVisibility = (id: string) => {
    setShowAccessCodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="space-y-4">
      {/* Contestants Management */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold">Contestants</h2>
        <div className="flex gap-2 mt-2">
          <Input
            type="text"
            placeholder="Contestant Name"
            value={contestantName}
            onChange={(e) => setContestantName(e.target.value)}
          />
          {competitionSettings.separateRankingByGender && (
            <Select value={contestantGender} onValueChange={(value) => setContestantGender(value as "Male" | "Female")}>
              <SelectTrigger className="w-28">
                <SelectValue placeholder="Select Gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="male">Male</SelectItem>
              </SelectContent>
            </Select>
          )}
          <Button onClick={handleAddContestant}>Add</Button>
        </div>

        {/* Contestants Table */}
        <div className="mt-4 border rounded p-2">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Name</th>
                {competitionSettings.separateRankingByGender && <th>Gender</th>}
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {contestants.map((contestant) => (
                <tr key={contestant.id} className="border-t">
                  <td>{contestant.name}</td>
                  {competitionSettings.separateRankingByGender && <td>{contestant.gender}</td>}
                  
                  {/* Segment Selection Dropdown */}
                  <td>
                    <Select
                      value={contestant.currentSegmentId}
                      onValueChange={(segmentId) => updateContestantSegment(contestant.id, segmentId)}
                    >
                      <SelectTrigger className="w-48">
                        <SelectValue placeholder="Select Segment" />
                      </SelectTrigger>
                      <SelectContent>
                        {competitionSettings.segments.map((segment) => (
                          <SelectItem key={segment.id} value={segment.id}>
                            {segment.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>

                  <td>
                    <Button size="icon" variant="destructive" onClick={() => removeContestant(contestant.id)}>
                      <Trash2Icon size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Judges Management */}
      <Card className="p-4">
        <h2 className="text-lg font-semibold">Judges</h2>
        <div className="flex gap-2 mt-2">
          <Input
            type="text"
            placeholder="Judge Name"
            value={judgeName}
            onChange={(e) => setJudgeName(e.target.value)}
          />
          <Button onClick={handleAddJudge}>Add</Button>
        </div>

        {/* Judges Table */}
        <div className="mt-4 border rounded p-2">
          <table className="w-full text-left">
            <thead>
              <tr>
                <th>Name</th>
                <th>Access Code</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {judges.map((judge) => (
                <tr key={judge.id} className="border-t">
                  <td>{judge.name}</td>
                  <td className="flex items-center gap-2">
                    <span className="font-mono">
                      {showAccessCodes[judge.id] ? judge.accessCode : "••••••••"}
                    </span>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => toggleAccessCodeVisibility(judge.id)}
                    >
                      {showAccessCodes[judge.id] ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                    </Button>
                  </td>
                  <td>
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => updateJudgeAccessCode(judge.id, uuidv4().slice(0, 8))}
                    >
                      <RefreshCcwIcon size={16} />
                    </Button>
                    <Button
                      size="icon"
                      variant="destructive"
                      onClick={() => removeJudge(judge.id)}
                    >
                      <Trash2Icon size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default JudgeScoring;
