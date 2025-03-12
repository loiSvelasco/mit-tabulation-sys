import React, { useState } from "react";
import useCompetitionStore, { Contestant } from "@/utils/useCompetitionStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const DataManagement = () => {
  const {
    competitionSettings,
    contestants,
    judges,
    scores,
    setCompetitionSettings,
    setScores,
  } = useCompetitionStore();

  const [importData, setImportData] = useState("");
  const [exportCategory, setExportCategory] = useState<"all" | "settings" | "contestantsJudges" | "scores">("all");

  const handleExport = () => {
    let dataToExport = {};

    switch (exportCategory) {
      case "all":
        dataToExport = { competitionSettings, contestants, judges, scores };
        break;
      case "settings":
        dataToExport = { competitionSettings };
			break;
      case "contestantsJudges":
        dataToExport = { contestants, judges };
        break;
      case "scores":
        dataToExport = { scores };
        break;
      default:
        return;
    }

    const json = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "competition_data.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    try {
      const parsedData = JSON.parse(importData);
  
      if (parsedData.competitionSettings) setCompetitionSettings(parsedData.competitionSettings);
      if (parsedData.scores) {
        Object.entries(parsedData.scores).forEach(([contestantId, judgeScores]) => {
          Object.entries(judgeScores as Record<string, number>).forEach(([judgeId, score]) => {
            useCompetitionStore.getState().setScores(contestantId, judgeId, score);
          });
        });
      }
  
      if (parsedData.contestants) {
        useCompetitionStore.setState({
          contestants: parsedData.contestants.map((c: Contestant) => ({
            ...c,
            currentSegmentId: c.currentSegmentId || (parsedData.competitionSettings?.segments[0]?.id || ""),
          })),
        });
      }
  
      if (parsedData.judges) {
        useCompetitionStore.setState({ judges: parsedData.judges });
      }
  
      alert("Data imported successfully!");
    } catch (error) {
      console.error("Error importing data:", error);
      alert("Invalid JSON format.");
    }
  };

  // setScores(contestantId, judgeId, score);

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle>Export Data</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <select value={exportCategory} onChange={(e) => setExportCategory(e.target.value as any)} className="border rounded px-3 py-2">
              <option value="all">All Data</option>
              <option value="settings">Competition Settings</option>
              <option value="contestantsJudges">Contestants & Judges</option>
              <option value="scores">Scores Only</option>
            </select>
            <Button onClick={handleExport}>Export JSON</Button>
          </div>
        </CardContent>
      </Card>

      {/* Import Section */}
      <Card>
        <CardHeader>
          <CardTitle>Import Data</CardTitle>
        </CardHeader>
        <CardContent>
          <Textarea
            value={importData}
            onChange={(e) => setImportData(e.target.value)}
            placeholder="Paste JSON data here..."
            className="mb-4"
          />
          <Button onClick={handleImport}>Import JSON</Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default DataManagement;
