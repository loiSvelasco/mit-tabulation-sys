"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { 
  Search, 
  Plus, 
  Filter, 
  MoreHorizontal, 
  Trophy,
  AlertCircle,
  Settings,
  Target,
  Users
} from "lucide-react"
import { CompetitionCard } from "./CompetitionCard"
import { CreateCompetitionModal } from "./CreateCompetitionModal"
import { toast } from "sonner"
import { format } from "date-fns"

interface Competition {
  id: number
  name: string
  is_active: boolean
  created_at: string
}

interface CompetitionListProps {
  onCompetitionSelect?: (competition: Competition) => void
  onCompetitionEdit?: (competition: Competition) => void
  showActions?: boolean
}

export function CompetitionList({ 
  onCompetitionSelect, 
  onCompetitionEdit,
  showActions = true
}: CompetitionListProps) {
  const [competitions, setCompetitions] = useState<Competition[]>([])
  const [filteredCompetitions, setFilteredCompetitions] = useState<Competition[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [filterActive, setFilterActive] = useState<"all" | "active" | "inactive">("all")
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch competitions from API
  const fetchCompetitions = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      const response = await fetch("/api/competitions")
      if (!response.ok) {
        throw new Error("Failed to fetch competitions")
      }
      
      const data = await response.json()
      setCompetitions(data)
      setFilteredCompetitions(data)
    } catch (error) {
      console.error("Error fetching competitions:", error)
      setError(error instanceof Error ? error.message : "Failed to fetch competitions")
      toast.error("Failed to load competitions")
    } finally {
      setIsLoading(false)
    }
  }

  // Filter competitions based on search term and active status
  const filterCompetitions = () => {
    let filtered = competitions

    // Filter by search term
    if (searchTerm.trim()) {
      filtered = filtered.filter(comp => 
        comp.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    // Filter by active status
    if (filterActive !== "all") {
      filtered = filtered.filter(comp => 
        filterActive === "active" ? comp.is_active : !comp.is_active
      )
    }

    setFilteredCompetitions(filtered)
  }

  // Handle competition actions
  const handleCompetitionAction = async (action: string, competition: Competition) => {
    try {
      switch (action) {
        case "activate":
          const activateResponse = await fetch(`/api/competitions/${competition.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              name: competition.name, 
              isActive: true 
            })
          })
          
          if (activateResponse.ok) {
            // Save the activated competition as selected
            localStorage.setItem("tabulation-selected-competition", competition.id.toString())
            console.log(`Competition ${competition.id} activated and saved as selected`)
            
            toast.success(`"${competition.name}" is now active`)
            await fetchCompetitions()
          } else {
            const errorData = await activateResponse.json()
            throw new Error(errorData.message || "Failed to activate competition")
          }
          break

        case "edit":
          onCompetitionEdit?.(competition)
          break

        case "activate-and-edit":
          // First activate the competition
          const activateAndEditResponse = await fetch(`/api/competitions/${competition.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
              name: competition.name, 
              isActive: true 
            })
          })
          
          if (activateAndEditResponse.ok) {
            // Save the activated competition as selected
            localStorage.setItem("tabulation-selected-competition", competition.id.toString())
            console.log(`Competition ${competition.id} activated and saved as selected`)
            
            toast.success(`"${competition.name}" is now active`)
            await fetchCompetitions()
            
            // Then open the edit modal
            onCompetitionEdit?.(competition)
          } else {
            const errorData = await activateAndEditResponse.json()
            throw new Error(errorData.message || "Failed to activate competition")
          }
          break

        case "delete":
          if (confirm(`Are you sure you want to delete "${competition.name}"? This action cannot be undone.`)) {
            const deleteResponse = await fetch(`/api/competitions/${competition.id}`, {
              method: "DELETE"
            })
            
            if (deleteResponse.ok) {
              toast.success(`"${competition.name}" deleted successfully`)
              await fetchCompetitions()
            } else {
              const errorData = await deleteResponse.json()
              throw new Error(errorData.message || "Failed to delete competition")
            }
          }
          break

        case "select":
          onCompetitionSelect?.(competition)
          break
      }
    } catch (error) {
      console.error(`Error performing ${action}:`, error)
      toast.error(`Failed to ${action} competition`)
    }
  }

  // Handle new competition creation
  const handleCompetitionCreated = (newCompetition: Competition) => {
    setCompetitions(prev => [newCompetition, ...prev])
    setFilteredCompetitions(prev => [newCompetition, ...prev])
    setShowCreateModal(false)
    toast.success(`"${newCompetition.name}" created successfully`)
  }

  // Effects
  useEffect(() => {
    fetchCompetitions()
  }, [])

  useEffect(() => {
    filterCompetitions()
  }, [searchTerm, filterActive, competitions])

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-red-500 mx-auto" />
              <div>
                <h3 className="text-lg font-semibold">Failed to load competitions</h3>
                <p className="text-muted-foreground">{error}</p>
              </div>
              <Button onClick={fetchCompetitions} variant="outline">
                Try Again
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="h-6 w-6" />
            Competitions
          </h2>
          <p className="text-muted-foreground">
            Manage your competitions and select which one to work with
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/dashboard`, '_blank')}
            className="flex items-center gap-1"
            title="Setup Competition"
          >
            <Settings className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/dashboard/manage-competition`, '_blank')}
            className="flex items-center gap-1"
            title="Monitor Scoring"
          >
            <Target className="h-3 w-3" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => window.open(`/judge/login`, '_blank')}
            className="flex items-center gap-1"
            title="Judge Portal"
          >
            <Users className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search competitions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
        
        <div className="flex gap-2">
          <Button
            variant={filterActive === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterActive("all")}
          >
            All
          </Button>
          <Button
            variant={filterActive === "active" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterActive("active")}
          >
            Active
          </Button>
          <Button
            variant={filterActive === "inactive" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterActive("inactive")}
          >
            Inactive
          </Button>
          
          {showActions && (
            <Button 
              onClick={() => setShowCreateModal(true)} 
              size="sm"
              className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
            >
              <Plus className="h-4 w-4" />
              Create New
            </Button>
          )}
        </div>
      </div>


      {/* Competition Grid */}
      {filteredCompetitions.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center py-8">
              <div className="text-center space-y-4">
                <Trophy className="h-12 w-12 text-muted-foreground mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold">
                    {searchTerm || filterActive !== "all" ? "No competitions found" : "No competitions yet"}
                  </h3>
                  <p className="text-muted-foreground">
                    {searchTerm || filterActive !== "all" 
                      ? "Try adjusting your search or filter criteria"
                      : "Create your first competition to get started"
                    }
                  </p>
                </div>
                {!searchTerm && filterActive === "all" && showActions && (
                  <Button onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 mr-2" />
                    Create Your First Competition
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredCompetitions.map((competition) => (
            <CompetitionCard
              key={competition.id}
              competition={competition}
              onAction={handleCompetitionAction}
              showActions={showActions}
            />
          ))}
        </div>
      )}

      {/* Create Competition Modal */}
      <CreateCompetitionModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCompetitionCreated={handleCompetitionCreated}
      />
    </div>
  )
}
