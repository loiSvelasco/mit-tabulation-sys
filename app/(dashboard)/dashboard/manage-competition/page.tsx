"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Monitor, Trophy } from "lucide-react"
import MonitorScoring from "@/components/monitor-scoring"
import Results from "@/components/results"

export default function ManageCompetition() {
  const [activeTab, setActiveTab] = useState("monitor")

  return (
    <div className="space-y-6 container mx-auto">
      <Card className="border-0 shadow-none">
        <CardHeader>
          <CardTitle className="text-2xl">Competition Management</CardTitle>
          <CardDescription>Monitor live scoring progress and manage competition results</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
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
