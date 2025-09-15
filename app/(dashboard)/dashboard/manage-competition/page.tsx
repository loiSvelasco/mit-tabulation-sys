"use client"

import { useState, useEffect } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, Trophy } from "lucide-react"
import MonitorScoring from "@/components/monitor-scoring"
import Results from "@/components/results"
import { getBestCompetitionId, saveCompetitionSelection } from "@/lib/competition-selection"
import useCompetitionStore from "@/utils/useCompetitionStore"

export default function ManageCompetition() {
  const [activeTab, setActiveTab] = useState("monitor")
  const { selectedCompetitionId, loadCompetition } = useCompetitionStore()

  // Restore active tab on mount
  useEffect(() => {
    const savedTab = localStorage.getItem("manage-competition-active-tab")
    if (savedTab && (savedTab === "monitor" || savedTab === "results")) {
      setActiveTab(savedTab)
    }
  }, [])

  // Initialize competition selection on mount
  useEffect(() => {
    const initializeCompetition = async () => {
      if (!selectedCompetitionId) {
        try {
          const bestCompetitionId = await getBestCompetitionId()
          if (bestCompetitionId) {
            saveCompetitionSelection(bestCompetitionId, 'manage-competition')
            await loadCompetition(bestCompetitionId)
          }
        } catch (error) {
          console.error('Failed to initialize competition:', error)
        }
      }
    }

    initializeCompetition()
  }, [selectedCompetitionId, loadCompetition])

  // Save active tab when it changes
  const handleTabChange = (value: string) => {
    setActiveTab(value)
    localStorage.setItem("manage-competition-active-tab", value)
  }

  return (
    <div className="space-y-6 container mx-auto">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl">Competition Management</CardTitle>
          <CardDescription>Monitor live scoring progress and manage competition results</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="monitor" className="flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Scoring Monitor
              </TabsTrigger>
              <TabsTrigger value="results" className="flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Results & Rankings
              </TabsTrigger>
            </TabsList>

            <TabsContent value="monitor" className="mt-6">
              <MonitorScoring />
            </TabsContent>

            <TabsContent value="results" className="mt-6">
              <Results />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  )
}
