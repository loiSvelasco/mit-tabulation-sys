"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import FullPageLoader from "@/components/auth/loader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LaptopMinimalIcon as LaptopMinimalCheck, Save, Clock } from 'lucide-react'
import CompetitionSettings from "@/components/competition-settings"
import DataManagement from "@/components/data-management"
import JudgeScoring from "@/components/judge-scoring"
import Results from "@/components/results"
import { RankingConfiguration } from "@/components/ranking-configuration"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { toast } from "sonner"
import { format } from "date-fns"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface Competition {
  id: number
  name: string
  filename: string
  created_at: string
  is_active: boolean
}

const Dashboard = () => {
  const router = useRouter()
  const {
    data: session,
    isPending,
    refetch,
  } = authClient.useSession() || { data: null, isPending: true, refetch: () => {} }
  const [isLoading, setIsLoading] = useState(true)
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [selectedCompetition, setSelectedCompetition] = useState<number | null>(null)
  const [isLoadingCompetition, setIsLoadingCompetition] = useState(false)

  const { saveCompetition, loadCompetition, isSaving, lastSaved } = useCompetitionStore()

  // Fetch user's competitions
  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await fetch("/api/competitions")
        if (response.ok) {
          const data = await response.json()
          setCompetitions(data)

          // If there's an active competition, select it by default
          const activeCompetition = data.find((comp: Competition) => comp.is_active)
          if (activeCompetition) {
            setSelectedCompetition(activeCompetition.id)
          }
        }
      } catch (error) {
        console.error("Error fetching competitions:", error)
      }
    }

    if (session) {
      fetchCompetitions()
    }
  }, [session])

  // Load selected competition
  useEffect(() => {
    const loadSelectedCompetition = async () => {
      if (selectedCompetition) {
        setIsLoadingCompetition(true)
        try {
          await loadCompetition(selectedCompetition)
          toast.success("Competition loaded successfully")
        } catch (error) {
          toast.error("Failed to load competition data")
        } finally {
          setIsLoadingCompetition(false)
        }
      }
    }

    loadSelectedCompetition()
  }, [selectedCompetition, loadCompetition])

  useEffect(() => {
    if (!session && !isPending) {
      router.replace("/auth")
    } else {
      setIsLoading(false)
    }
  }, [session, isPending, router])

  const handleSave = async () => {
    try {
      // The selectedCompetitionId is already set in the store when a competition is loaded
      const result = await saveCompetition()
      toast.success("Competition saved successfully")

      // Refresh the competitions list
      const response = await fetch("/api/competitions")
      if (response.ok) {
        const data = await response.json()
        setCompetitions(data)
      }
    } catch (error) {
      toast.error("Failed to save competition data")
    }
  }

  const user = session?.user

  if (isLoading || isPending) {
    return <FullPageLoader />
  }

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <span className="inline-flex items-center gap-2 text-2xl font-bold">Setup Competition</span>
        <div className="flex items-center gap-4">
          {competitions.length > 0 && (
            <div className="flex items-center gap-2">
              <Select
                value={selectedCompetition?.toString() || ""}
                onValueChange={(value) => setSelectedCompetition(Number.parseInt(value))}
                disabled={isLoadingCompetition}
              >
                <SelectTrigger className="w-[250px]">
                  <SelectValue placeholder="Select a competition" />
                </SelectTrigger>
                <SelectContent>
                  {competitions.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id.toString()}>
                      {comp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
            <Save size={16} />
            {isSaving ? "Saving..." : "Save Competition"}
          </Button>

          <Button asChild>
            <Link href="/judge">
              <LaptopMinimalCheck /> View Judge Dashboard{" "}
            </Link>
          </Button>
        </div>
      </div>

      {lastSaved && (
        <div className="flex items-center text-sm text-muted-foreground mb-4">
          <Clock size={14} className="mr-1" />
          Last saved: {format(lastSaved, "PPpp")}
        </div>
      )}

      <Tabs defaultValue="settings" className="w-full">
        <TabsList className="grid grid-cols-5 mb-8">
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="settings">
            Competition Settings
          </TabsTrigger>
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="scoring">
            Judge Scoring
          </TabsTrigger>
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="ranking">
            Ranking Configuration
          </TabsTrigger>
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="results">
            Results
          </TabsTrigger>
          <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="data">
            Data Management
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <CompetitionSettings />
        </TabsContent>

        <TabsContent value="scoring">
          <JudgeScoring />
        </TabsContent>

        <TabsContent value="ranking">
          <RankingConfiguration />
        </TabsContent>

        <TabsContent value="results">
          <Results />
        </TabsContent>

        <TabsContent value="data">
          <DataManagement />
        </TabsContent>
      </Tabs>
    </div>
  )
}

export default Dashboard
