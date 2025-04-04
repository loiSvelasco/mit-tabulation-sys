"use client"

import React, { useState } from "react";
import useCompetitionStore, { Contestant } from "@/utils/useCompetitionStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Database, Settings, Users, Award, Download, Upload, FileJson } from 'lucide-react';
import { cn } from "@/lib/utils";
import { toast } from "sonner";

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
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");

  const handleExport = () => {
    let dataToExport = {};
    let fileName = "competition_data.json";

    switch (exportCategory) {
      case "all":
        dataToExport = { competitionSettings, contestants, judges, scores };
        fileName = "competition_full_data.json";
        break;
      case "settings":
        dataToExport = { competitionSettings };
        fileName = "competition_settings.json";
        break;
      case "contestantsJudges":
        dataToExport = { contestants, judges };
        fileName = "contestants_and_judges.json";
        break;
      case "scores":
        dataToExport = { scores };
        fileName = "competition_scores.json";
        break;
      default:
        return;
    }

    const json = JSON.stringify(dataToExport, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
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
  
      setImportData("");
      // alert("Data imported successfully!");
      toast.success("Data imported successfully!")
    } catch (error) {
      console.error("Error importing data:", error);
      // alert("Invalid JSON format.");
      toast.error("Invalid JSON format.")
      
    }
  };

  const exportOptions = [
    {
      id: "all",
      title: "All Data",
      description: "Export everything: settings, contestants, judges, and scores",
      icon: <Database className="h-10 w-10 mb-2 text-primary" />,
    },
    {
      id: "settings",
      title: "Competition Settings",
      description: "Export only competition settings and criteria",
      icon: <Settings className="h-10 w-10 mb-2 text-primary" />,
    },
    {
      id: "contestantsJudges",
      title: "Contestants & Judges",
      description: "Export only contestant and judge information",
      icon: <Users className="h-10 w-10 mb-2 text-primary" />,
    },
    {
      id: "scores",
      title: "Scores Only",
      description: "Export only the scores data",
      icon: <Award className="h-10 w-10 mb-2 text-primary" />,
    },
  ];

  return (
    <div className="space-y-6">
      <Tabs defaultValue="export" value={activeTab} onValueChange={(value) => setActiveTab(value as "export" | "import")}>
        <TabsList className="grid grid-cols-2 mb-6">
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="export">Export Data</TabsTrigger>
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="import">Import Data</TabsTrigger>
        </TabsList>

        <TabsContent value="export">
          <Card>
            <CardHeader>
              <CardTitle>Export Competition Data</CardTitle>
              <CardDescription>
                Export your competition data for backup or to transfer to another system
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {exportOptions.map((option) => (
                  <Card 
                    key={option.id}
                    className={cn(
                      "cursor-pointer border-2 transition-all hover:shadow-md",
                      exportCategory === option.id ? "border-primary" : "border-border"
                    )}
                    onClick={() => setExportCategory(option.id as any)}
                  >
                    <CardContent className="flex flex-col items-center justify-center p-6">
                      {option.icon}
                      <h3 className="font-medium">{option.title}</h3>
                      <p className="text-sm text-muted-foreground text-center">
                        {option.description}
                      </p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <Button onClick={handleExport} className="w-full">
                <Download className="mr-2 h-4 w-4" /> Export {exportOptions.find(o => o.id === exportCategory)?.title}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="import">
          <Card>
            <CardHeader>
              <CardTitle>Import Competition Data</CardTitle>
              <CardDescription>Import competition data from a previously exported file</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-center p-6 border-2 border-dashed rounded-lg">
                <div className="text-center">
                  <FileJson className="mx-auto h-12 w-12 text-muted-foreground" />
                  <p className="mt-2 text-sm font-medium">Paste JSON data below</p>
                  <p className="text-xs text-muted-foreground">
                    The system will automatically detect and import the relevant data
                  </p>
                </div>
              </div>

              <Textarea
                value={importData}
                onChange={(e) => setImportData(e.target.value)}
                placeholder="Paste JSON data here..."
                className="min-h-[200px] font-mono text-sm"
              />
              
              <Button onClick={handleImport} className="w-full" disabled={!importData.trim()}>
                <Upload className="mr-2 h-4 w-4" /> Import Data
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DataManagement;