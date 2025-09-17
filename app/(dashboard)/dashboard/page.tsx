"use client"

import { authClient } from "@/lib/auth-client"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import FullPageLoader from "@/components/auth/loader"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { LaptopMinimalIcon as LaptopMinimalCheck, Save, Clock, PlusCircle, X, Tv2, Trophy } from "lucide-react"
import CompetitionSettings from "@/components/competition-settings"
import DataManagement from "@/components/data-management"
import Results from "@/components/results"
import { RankingConfiguration } from "@/components/ranking-configuration"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { toast } from "sonner"
import { format } from "date-fns"
import EnhancedJudgeScoring from "@/components/judge-scoring"
import { ResetScoresButton } from "@/components/admin/ResetScoresButton"
import { useEventSync } from "@/hooks/useEventSync"
import { ScoreSyncTest } from "@/components/debug/ScoreSyncTest"
import AccessCodeMigrationTest from "@/components/debug/AccessCodeMigrationTest"
import { saveCompetitionSelection, getBestCompetitionId, setActiveCompetition } from "@/lib/competition-selection"
// import { SyncJudgesButton } from "@/components/admin/sync-judges-button"

interface Competition {
  id: number
  name: string
  filename: string
  created_at: string
  is_active: boolean
}

// Key for storing selected competition ID in localStorage
const SELECTED_COMPETITION_KEY = "tabulation-selected-competition"

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
  const [isCreatingNew, setIsCreatingNew] = useState(false)

  const { saveCompetition, loadCompetition, isSaving, lastSaved, setSelectedCompetitionId } = useCompetitionStore()
  
  // Set up real-time event synchronization
  useEventSync()

  // Fetch user's competitions and auto-load the best one
  const fetchCompetitions = async () => {
    try {
      const response = await fetch("/api/competitions")
      if (response.ok) {
        const data = await response.json()
        setCompetitions(data)

        // Auto-select the best competition to work with
        if (data.length > 0) {
          // Priority: 1) Active competition, 2) Previously selected, 3) Most recent
          let competitionToLoad = null

          // First priority: Look for active competition
          const activeCompetition = data.find((comp: Competition) => comp.is_active)
          if (activeCompetition) {
            competitionToLoad = activeCompetition.id
            console.log(`Dashboard: Using active competition ${activeCompetition.id} (${activeCompetition.name})`)
          } else {
            // Second priority: Previously selected competition
            const savedCompetitionId = localStorage.getItem(SELECTED_COMPETITION_KEY)
            if (savedCompetitionId) {
              const competitionId = Number.parseInt(savedCompetitionId, 10)
              const competitionExists = data.some((comp: Competition) => comp.id === competitionId)
              if (competitionExists) {
                competitionToLoad = competitionId
                console.log(`Dashboard: Using previously selected competition ${competitionId}`)
              }
            }

            // Third priority: Most recent competition
            if (!competitionToLoad) {
              competitionToLoad = data[0].id
              console.log(`Dashboard: Using most recent competition ${competitionToLoad}`)
            }
          }

          if (competitionToLoad) {
            setSelectedCompetition(competitionToLoad)
            // Update localStorage to reflect the current selection
            localStorage.setItem(SELECTED_COMPETITION_KEY, competitionToLoad.toString())
          }
        }
      }
    } catch (error) {
      console.error("Error fetching competitions:", error)
    }
  }

  useEffect(() => {
    if (session) {
      fetchCompetitions()
    }
  }, [session])

  // Refresh competitions when window regains focus (e.g., returning from management page)
  useEffect(() => {
    const handleFocus = () => {
      console.log("Dashboard: Window focused, refreshing competitions...")
      fetchCompetitions()
    }

    window.addEventListener('focus', handleFocus)
    return () => window.removeEventListener('focus', handleFocus)
  }, [])

  // Load selected competition
  useEffect(() => {
    const loadSelectedCompetition = async () => {
      if (selectedCompetition) {
        setIsLoadingCompetition(true)
        try {
          // Save the selected competition ID with context
          saveCompetitionSelection(selectedCompetition, 'dashboard')

          await loadCompetition(selectedCompetition)
          toast.success("Competition loaded successfully")

          // Reset the creating new flag when loading an existing competition
          setIsCreatingNew(false)
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

  const handleCreateNew = () => {
    // Clear the selected competition in the UI
    setSelectedCompetition(null)

    // Clear the selected competition ID in the store
    setSelectedCompetitionId(null)

    // Reset all competition data to blank/default values
    useCompetitionStore.getState().resetCompetition();

    // Set the creating new flag
    setIsCreatingNew(true)

    // Clear the localStorage value
    localStorage.removeItem(SELECTED_COMPETITION_KEY)

    // Show a toast to indicate we're creating a new competition
    toast.info("Creating a new competition. Fill in the details and click Save.")
  }

  const handleCancelCreate = () => {
    // If we have competitions, select the first one or the previously selected one
    if (competitions.length > 0) {
      // Try to get the previously selected competition from localStorage
      const savedCompetitionId = localStorage.getItem(SELECTED_COMPETITION_KEY)

      if (savedCompetitionId) {
        const competitionId = Number.parseInt(savedCompetitionId, 10)
        // Check if the competition still exists
        const competitionExists = competitions.some((comp) => comp.id === competitionId)

        if (competitionExists) {
          setSelectedCompetition(competitionId)
        } else {
          // If the saved competition doesn't exist anymore, select the first one
          setSelectedCompetition(competitions[0].id)
        }
      } else {
        // If no saved competition, select the first one
        setSelectedCompetition(competitions[0].id)
      }
    }

    // Reset the creating new flag
    setIsCreatingNew(false)

    // Show a toast to indicate we've canceled
    toast.info("Creation canceled")
  }

  // Add a function to set a competition as active
  const setCompetitionActive = async (competitionId: number) => {
    try {
      const response = await fetch(`/api/competitions/${competitionId}/set-active`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })

      if (!response.ok) {
        throw new Error("Failed to set competition as active")
      }

      // Refresh the competitions list to show updated active status
      const refreshResponse = await fetch("/api/competitions")
      if (refreshResponse.ok) {
        const data = await refreshResponse.json()
        setCompetitions(data)
      }
    } catch (error) {
      console.error("Error setting competition as active:", error)
      toast.error("Failed to set competition as active")
    }
  }

  // Modify the handleSave function to set the competition as active when saving
  const handleSave = async () => {
    try {
      // Save the competition
      const result = await saveCompetition()

      // Show success message
      toast.success(isCreatingNew ? "New competition created successfully" : "Competition updated successfully")

      // Refresh the competitions list
      const response = await fetch("/api/competitions")
      if (response.ok) {
        const data = await response.json()
        setCompetitions(data)

        // If we created a new competition, select it and set it as active
        if (isCreatingNew && result.id) {
          setSelectedCompetition(result.id)
          // Save to localStorage
          localStorage.setItem(SELECTED_COMPETITION_KEY, result.id.toString())
          // Set the new competition as active
          await setCompetitionActive(result.id)
          // Reset the creating new flag
          setIsCreatingNew(false)
        } else if (selectedCompetition) {
          // If updating an existing competition, ensure it's set as active
          await setCompetitionActive(selectedCompetition)
        }
      }
    } catch (error) {
      toast.error("Failed to save competition data")
    }
  }


  const handleOpenPublicDisplay = () => {
    if (selectedCompetition) {
      window.open(`/display/${selectedCompetition}`, "_blank", "noopener,noreferrer")
    }
  }

  const user = session?.user

  if (isLoading || isPending) {
    return <FullPageLoader />
  }

  return (
    <div>
      {/* Your existing dashboard content */}
      <div className="container mx-auto py-8">
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <Trophy className="h-8 w-8 text-primary" />
              {isCreatingNew ? "New Competition" : "Competition Setup"}
            </h1>
            <p className="text-muted-foreground">
              {isCreatingNew 
                ? "Configure your new competition settings, contestants, and judges"
                : "Configure competition settings, manage contestants and judges, and set up scoring"
              }
            </p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild variant="outline">
              <Link href="/dashboard/competitions">
                <Trophy className="mr-2 h-4 w-4" /> Manage Competitions
              </Link>
            </Button>

            <Button asChild variant="outline">
              <Link href="/dashboard/manage-competition" target="_blank">
                <LaptopMinimalCheck className="mr-2 h-4 w-4" /> Monitor Scoring
              </Link>
            </Button>

            <Button
              variant={isCreatingNew ? "destructive" : "outline"}
              onClick={isCreatingNew ? handleCancelCreate : handleCreateNew}
              disabled={isLoadingCompetition}
              className="flex items-center gap-2"
            >
              {isCreatingNew ? (
                <>
                  <X size={16} />
                  Cancel
                </>
              ) : (
                <>
                  <PlusCircle size={16} />
                  Create New
                </>
              )}
            </Button>

            <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
              <Save size={16} />
              {isSaving ? "Saving..." : "Save Competition"}
            </Button>
          </div>
        </div>

        {/* Current Competition Info */}
        {selectedCompetition && !isCreatingNew && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 bg-primary rounded-full"></div>
                <div>
                  <h3 className="font-semibold text-primary">
                    {competitions.find(c => c.id === selectedCompetition)?.name || "Loading..."}
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Currently working on this competition
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" size="sm">
                <Link href="/dashboard/competitions">
                  <Trophy className="h-4 w-4 mr-2" />
                  Switch Competition
                </Link>
              </Button>
            </div>
          </div>
        )}

        {lastSaved && (
          <div className="flex items-center text-sm text-muted-foreground mb-4">
            <Clock size={14} className="mr-1" />
            Last saved: {format(lastSaved, "PPpp")}
          </div>
        )}

        {isCreatingNew && (
          <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-6 rounded">
            <p className="text-blue-700">
              You are creating a new competition. Configure the settings and click "Save Competition" when done.
            </p>
          </div>
        )}

        <Tabs defaultValue="settings" className="w-full">
          <TabsList className="grid grid-cols-4 mb-8">
            <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="settings">
              Competition Settings
            </TabsTrigger>
            <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="scoring">
              Contestants & Judges
            </TabsTrigger>
            <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="ranking">
              Ranking Configuration
            </TabsTrigger>
            {/* <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="results">
              Results
            </TabsTrigger> */}
            <TabsTrigger className="data-[state=active]:font-bold data-[state=active]:bg-white" value="data">
              Data Management
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings">
            <CompetitionSettings />
          </TabsContent>

          <TabsContent value="scoring">
            <EnhancedJudgeScoring />
          </TabsContent>

          <TabsContent value="ranking">
            <RankingConfiguration />
          </TabsContent>

          {/* <TabsContent value="results">
            <Results />
          </TabsContent> */}

          <TabsContent value="data">
            <div className="space-y-6">
              <DataManagement />
              <ScoreSyncTest />
              <AccessCodeMigrationTest />
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default Dashboard
