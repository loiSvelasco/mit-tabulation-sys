import React, { useState } from "react";
import useCompetitionStore from "@/utils/useCompetitionStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { EyeIcon, EyeOffIcon, RefreshCcwIcon, Trash2Icon, EditIcon, UserPlus, Plus, SaveIcon, XIcon } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";

const JudgeScoring = () => {
  const {
    competitionSettings,
    contestants,
    judges,
    addContestant,
    updateContestantName,
    removeContestant,
    addJudge,
    removeJudge,
    updateJudgeAccessCode,
    updateJudgeName,
    updateContestantSegment,
  } = useCompetitionStore();

  const [contestantName, setContestantName] = useState("");
	const [contestantGender, setContestantGender] = useState<"Male" | "Female">("Female");
  const [editingContestant, setEditingContestant] = useState<{contestantId: string; name:string} | null>(null);

  const handleEditClickContestant = (contestantId: string, currentName: string) => {
    setEditingContestant({ contestantId: contestantId, name: currentName });
  }
  
  const handleSaveClickContestant = () => {
    if (editingContestant) {
      updateContestantName(editingContestant.contestantId, editingContestant.name);
      setEditingContestant(null);
    }
  };

  const handleCancelClickContestant = () => {
    setEditingContestant(null);
  };

  const [judgeName, setJudgeName] = useState("");
  const [showAccessCodes, setShowAccessCodes] = useState<{ [key: string]: boolean }>({});
  const [editingJudge, setEditingJudge] = useState<{ id: string; name: string} | null>(null);

  const handleEditClickJudge = (judgeId: string, currentName: string) => {
    setEditingJudge({ id: judgeId, name: currentName });
  }

  const handleSaveClickJudge = () => {
    if (editingJudge) {
      updateJudgeName(editingJudge.id, editingJudge.name);
      setEditingJudge(null);
    }
  };

  const handleCancelClickJudge = () => {
    setEditingJudge(null);
  };

  const handleAddContestant = () => {
		if (!contestantName.trim()) return;
	
		addContestant(contestantName, contestantGender);
		setContestantName("");
	};

	const handleAddJudge = () => {
		if (!judgeName.trim()) return;
	
		addJudge(judgeName);
		setJudgeName("");
	};

  const generateAccessCode = () => {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Removed similar looking characters
    let result = ""
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }

  const toggleAccessCodeVisibility = (id: string) => {
    setShowAccessCodes((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Contestants Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Contestants</CardTitle>
          <CardDescription>Add and manage contestants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
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
            <Button onClick={handleAddContestant}><Plus /> Add</Button>
          </div>

          {/* Contestants Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Name</TableHead>
                  {competitionSettings.separateRankingByGender && <TableHead>Gender</TableHead>}
                  <TableHead>Segment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contestants.map((contestant) => (
                  <TableRow key={contestant.id} className="border-t">
                    <TableCell>{contestant.id}</TableCell>
                    <TableCell>
                      {editingContestant?.contestantId === contestant.id ? (
                        <Input
                        value={editingContestant.name}
                        onChange={(e) =>
                          setEditingContestant((prev) => prev && { ...prev, name: e.target.value })
                        }
                      />
                      ) : contestant.name }
                    </TableCell>
                    {competitionSettings.separateRankingByGender && <TableCell>{contestant.gender}</TableCell>}
                    
                    {/* Segment Selection Dropdown */}
                    <TableCell>
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
                    </TableCell>

                    <TableCell>
                    {editingContestant?.contestantId === contestant.id ? (
                        <>
                          <Button size="icon" variant="secondary" onClick={handleSaveClickContestant}>
                            <SaveIcon size={16} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={handleCancelClickContestant}>
                            <XIcon size={16} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleEditClickContestant(contestant.id, contestant.name)}>
                            <EditIcon size={16} />
                          </Button>
                        </>
                      ) }
                      <Button size="icon" variant="destructive" onClick={() => removeContestant(contestant.id)}>
                        <Trash2Icon size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {
                  contestants.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No contestants added.
                      </TableCell>
                    </TableRow>
                  )
                }
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Judges Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Judges</CardTitle>
          <CardDescription>Add and manage judges</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="text"
              placeholder="Judge Name"
              value={judgeName}
              onChange={(e) => setJudgeName(e.target.value)}
            />
            <Button onClick={handleAddJudge}><UserPlus /> Add</Button>
          </div>

          {/* Judges Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Access Code</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {judges.map((judge) => (
                  <TableRow key={judge.id} className="border-t">
                    <TableCell>
                      {editingJudge?.id === judge.id ? (
                        <Input
                        value={editingJudge.name}
                        onChange={(e) =>
                          setEditingJudge((prev) => prev && { ...prev, name: e.target.value })
                        }
                      />
                      ) : judge.name }
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <span className="font-mono">
                        {showAccessCodes[judge.id] ? judge.accessCode : "••••••"}
                      </span>
                      <Button 
                        size="icon"
                        variant="ghost"
                        onClick={() => toggleAccessCodeVisibility(judge.id)}
                      >
                        {showAccessCodes[judge.id] ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => updateJudgeAccessCode(judge.id, generateAccessCode())}
                      >
                        <RefreshCcwIcon size={16} />
                      </Button>
                    </TableCell>
                    <TableCell>
                      {editingJudge?.id === judge.id ? (
                        <>
                          <Button size="icon" variant="secondary" onClick={handleSaveClickJudge}>
                            <SaveIcon size={16} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={handleCancelClickJudge}>
                            <XIcon size={16} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button size="icon" variant="ghost" onClick={() => handleEditClickJudge(judge.id, judge.name)}>
                            <EditIcon size={16} />
                          </Button>
                        </>
                      ) }
                      <Button
                        size="icon"
                        variant="destructive"
                        onClick={() => removeJudge(judge.id)}
                      >
                        <Trash2Icon size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {
                  judges.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={3} className="text-center text-muted-foreground">
                        No judges added.
                      </TableCell>
                    </TableRow>
                  )
                }
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default JudgeScoring;
