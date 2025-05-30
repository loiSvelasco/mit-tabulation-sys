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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import EnhancedJudgeScoring from "@/components/judge-scoring"
import { ResetScoresButton } from "@/components/admin/ResetScoresButton"
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

  // Fetch user's competitions
  useEffect(() => {
    const fetchCompetitions = async () => {
      try {
        const response = await fetch("/api/competitions")
        if (response.ok) {
          const data = await response.json()
          setCompetitions(data)

          // Try to load the previously selected competition from localStorage
          const savedCompetitionId = localStorage.getItem(SELECTED_COMPETITION_KEY)

          if (savedCompetitionId) {
            const competitionId = Number.parseInt(savedCompetitionId, 10)
            // Check if the competition still exists
            const competitionExists = data.some((comp: Competition) => comp.id === competitionId)

            if (competitionExists) {
              setSelectedCompetition(competitionId)
            } else if (data.length > 0) {
              // If the saved competition doesn't exist anymore, select the first one
              setSelectedCompetition(data[0].id)
            }
          } else if (data.length > 0) {
            // If no saved competition, select the first one or an active one
            const activeCompetition = data.find((comp: Competition) => comp.is_active)
            setSelectedCompetition(activeCompetition ? activeCompetition.id : data[0].id)
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
          // Save the selected competition ID to localStorage
          localStorage.setItem(SELECTED_COMPETITION_KEY, selectedCompetition.toString())

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

  // Modify the competition selection handler to set the selected competition as active
  const handleCompetitionChange = async (value: string) => {
    const competitionId = Number.parseInt(value)
    setSelectedCompetition(competitionId)

    // Set the selected competition as active
    await setCompetitionActive(competitionId)
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
        <div className="flex justify-between items-center mb-6">
          <span className="inline-flex items-center gap-2 text-2xl font-bold">
            <Trophy size={24} />
            {isCreatingNew ? "New Competition" : "Setup Competition"}
          </span>
          <div className="flex items-center gap-4">
            {competitions.length > 0 && (
              <div className="flex items-center gap-2">
                <Select
                  value={selectedCompetition?.toString() || ""}
                  onValueChange={(value) => {
                    const id = Number.parseInt(value)
                    setSelectedCompetition(id)
                    setCompetitionActive(id)
                  }}
                  disabled={isLoadingCompetition || isCreatingNew}
                >
                  <SelectTrigger className="w-[250px]">
                    <SelectValue placeholder="Select a competition" />
                  </SelectTrigger>
                  <SelectContent>
                    {competitions.map((comp) => (
                      <SelectItem key={comp.id} value={comp.id.toString()}>
                        {comp.name} {comp.is_active ? "(Active)" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

            <ResetScoresButton />

            <Button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2">
              <Save size={16} />
              {isSaving ? "Saving..." : "Save Competition"}
            </Button>

            {/* {selectedCompetition && <SyncJudgesButton competitionId={selectedCompetition} />} */}

            {/* <Button asChild>
              <Link href="/judge">
                <LaptopMinimalCheck className="mr-2 h-4 w-4" /> View Judge Dashboard
              </Link>
            </Button> */}

            {/* <Button asChild>
              <Link href="/dashboard/monitor-scoring" target="_blank">
                <LaptopMinimalCheck className="mr-2 h-4 w-4" /> Monitoring of Scores
              </Link>
            </Button> */}

            <Button asChild>
              <Link href="/dashboard/manage-competition" target="_blank">
                <LaptopMinimalCheck className="mr-2 h-4 w-4" /> Manage Competition
              </Link>
            </Button>

            {/* {selectedCompetition && (
              <Button variant="outline" onClick={handleOpenPublicDisplay} className="flex items-center gap-2">
                <Tv2 className="h-4 w-4 mr-2" /> Public Display
              </Button>
            )} */}
          </div>
        </div>

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
            <DataManagement />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}

export default Dashboard
