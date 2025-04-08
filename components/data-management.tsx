"use client"

import type React from "react"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Download, Upload, Settings, Users, UserCheck, BarChart3, Save, FileJson } from "lucide-react"
import { toast } from "sonner"

export default function DataManagement() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [importType, setImportType] = useState<string>("all")
  const [isExporting, setIsExporting] = useState(false)
  const [isImporting, setIsImporting] = useState(false)

  const {
    exportAllData,
    importAllData,
    exportCompetitionSettings,
    importCompetitionSettings,
    exportContestants,
    importContestants,
    exportJudges,
    importJudges,
    exportScores,
    importScores,
  } = useCompetitionStore()

  const handleExport = async (type: string) => {
    setIsExporting(true)
    try {
      let data: string
      let filename: string

      switch (type) {
        case "all":
          data = await exportAllData()
          filename = "competition_data.json"
          break
        case "settings":
          data = exportCompetitionSettings()
          filename = "competition_settings.json"
          break
        case "contestants":
          data = exportContestants()
          filename = "contestants.json"
          break
        case "judges":
          data = exportJudges()
          filename = "judges.json"
          break
        case "scores":
          data = await exportScores()
          filename = "scores.json"
          break
        default:
          data = await exportAllData()
          filename = "competition_data.json"
      }

      // Create a blob and download link
      const blob = new Blob([data], { type: "application/json" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast.success("Export successful.")
    } catch (error) {
      console.error("Error exporting data:", error)
      toast.error("Export failed.")
    } finally {
      setIsExporting(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0])
    }
  }

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("No file selected")
      return
    }

    setIsImporting(true)
    try {
      const fileContent = await selectedFile.text()

      switch (importType) {
        case "all":
          importAllData(fileContent)
          break
        case "settings":
          importCompetitionSettings(fileContent)
          break
        case "contestants":
          importContestants(fileContent)
          break
        case "judges":
          importJudges(fileContent)
          break
        case "scores":
          await importScores(fileContent)
          break
      }

      toast.success("Import successful.")

      // Reset file selection
      setSelectedFile(null)
      const fileInput = document.getElementById("file-input") as HTMLInputElement
      if (fileInput) fileInput.value = ""
    } catch (error) {
      console.error("Error importing data:", error)
      toast.error("Import failed.")
    } finally {
      setIsImporting(false)
    }
  }

  const dataOptions = [
    {
      id: "all",
      name: "All Competition Data",
      description: "Export/import the entire competition configuration",
      icon: <FileJson className="h-10 w-10 text-primary" />,
    },
    {
      id: "settings",
      name: "Competition Settings",
      description: "Export/import competition settings, segments, and criteria",
      icon: <Settings className="h-10 w-10 text-primary" />,
    },
    {
      id: "contestants",
      name: "Contestants",
      description: "Export/import contestant data",
      icon: <Users className="h-10 w-10 text-primary" />,
    },
    {
      id: "judges",
      name: "Judges",
      description: "Export/import judge data",
      icon: <UserCheck className="h-10 w-10 text-primary" />,
    },
    {
      id: "scores",
      name: "Scores",
      description: "Export/import scoring data",
      icon: <BarChart3 className="h-10 w-10 text-primary" />,
    },
  ]

  return (
    <div className="space-y-6">
      <Tabs defaultValue="export" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="export">Export Data</TabsTrigger>
          <TabsTrigger value="import">Import Data</TabsTrigger>
        </TabsList>

        <TabsContent value="export" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataOptions.map((option) => (
              <Card
                key={option.id}
                className="cursor-pointer hover:border-primary transition-colors"
                onClick={() => handleExport(option.id)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">{option.name}</CardTitle>
                  <Download className={`h-5 w-5 ${isExporting ? "animate-pulse" : "text-muted-foreground"}`} />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4">
                    {option.icon}
                    <CardDescription className="text-sm">{option.description}</CardDescription>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="import" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {dataOptions.map((option) => (
              <Card
                key={option.id}
                className={`cursor-pointer transition-colors ${importType === option.id ? "border-primary" : "hover:border-primary/50"}`}
                onClick={() => setImportType(option.id)}
              >
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-lg font-medium">{option.name}</CardTitle>
                  <Upload
                    className={`h-5 w-5 ${importType === option.id ? "text-primary" : "text-muted-foreground"}`}
                  />
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-4">
                    {option.icon}
                    <CardDescription className="text-sm">{option.description}</CardDescription>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex flex-col space-y-2">
              <label htmlFor="file-input" className="text-sm font-medium">
                Select JSON file to import
              </label>
              <input
                id="file-input"
                type="file"
                accept=".json"
                onChange={handleFileChange}
                className="border rounded p-2"
              />
              {selectedFile && <p className="text-sm text-muted-foreground">Selected file: {selectedFile.name}</p>}
            </div>

            <Button onClick={handleImport} disabled={!selectedFile || isImporting} className="w-full">
              <Save className="mr-2 h-4 w-4" />
              {isImporting ? "Importing..." : `Import ${dataOptions.find((o) => o.id === importType)?.name}`}
            </Button>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}

