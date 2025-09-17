"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { CompetitionList, EditCompetitionModal } from "@/components/competition-management"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { 
  Trophy, 
  Settings, 
  ArrowLeft, 
  Plus,
  Search,
  Filter,
  MoreHorizontal,
  Calendar,
  Users,
  Target,
  AlertCircle,
  CheckCircle
} from "lucide-react"
import { Breadcrumb } from "@/components/ui/breadcrumb"
import { toast } from "sonner"
import { format } from "date-fns"
import { authClient } from "@/lib/auth-client"
import FullPageLoader from "@/components/auth/loader"

interface Competition {
  id: number
  name: string
  is_active: boolean
  created_at: string
  score_count?: number
  judge_count?: number
}

export default function CompetitionsPage() {
  const router = useRouter()
  const { data: session, isPending } = authClient.useSession() || { data: null, isPending: true }
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Handle authentication
  useEffect(() => {
    if (!session && !isPending) {
      router.replace("/auth")
    } else if (session) {
      setIsLoading(false)
    }
  }, [session, isPending, router])

  const handleCompetitionSelect = (competition: Competition) => {
    setSelectedCompetition(competition)
    // Save the selected competition to localStorage
    localStorage.setItem("tabulation-selected-competition", competition.id.toString())
    console.log(`Competition ${competition.id} selected and saved`)
    // Navigate to dashboard with selected competition
    router.push(`/dashboard?competition=${competition.id}`)
  }

  const handleCompetitionEdit = (competition: Competition) => {
    setSelectedCompetition(competition)
    setShowEditModal(true)
  }

  const handleCompetitionUpdated = (updatedCompetition: Competition) => {
    setSelectedCompetition(updatedCompetition)
    setShowEditModal(false)
    toast.success(`"${updatedCompetition.name}" updated successfully`)
  }

  const handleCompetitionDeleted = () => {
    setSelectedCompetition(null)
    toast.success("Competition deleted successfully")
  }

  const handleCompetitionActivated = (competition: Competition) => {
    setSelectedCompetition(competition)
    toast.success(`"${competition.name}" is now active`)
  }

  const handleBackToDashboard = () => {
    router.push("/dashboard")
  }

  if (isLoading || isPending) {
    return <FullPageLoader />
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto py-8 space-y-8">
        {/* Breadcrumb */}
        <Breadcrumb
          items={[
            { label: "Dashboard", href: "/dashboard" },
            { label: "Competitions", icon: <Trophy className="h-4 w-4" /> }
          ]}
        />

        {/* Header */}
        <div className="flex items-center justify-end">
          <Button
            variant="outline"
            onClick={handleBackToDashboard}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Dashboard
          </Button>
        </div>


        {/* Selected Competition Info */}
        {selectedCompetition && (
          <Card className="border-primary/20 bg-primary/5">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-primary" />
                Selected Competition
              </CardTitle>
              <CardDescription>
                Currently selected competition details
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Name</p>
                  <p className="text-lg font-semibold">{selectedCompetition.name}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Status</p>
                  <Badge 
                    variant="outline" 
                    className={selectedCompetition.is_active ? "bg-green-100 text-green-800 border-green-200" : "bg-gray-100 text-gray-800 border-gray-200"}
                  >
                    {selectedCompetition.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Judges</p>
                  <p className="text-lg font-semibold">{selectedCompetition.judge_count || 0}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Scores</p>
                  <p className="text-lg font-semibold">{selectedCompetition.score_count || 0}</p>
                </div>
              </div>
              
              <div className="mt-4 flex gap-2">
                <Button 
                  size="sm" 
                  onClick={() => router.push(`/dashboard?competition=${selectedCompetition.id}`)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Setup Competition
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => router.push(`/dashboard/manage-competition?competition=${selectedCompetition.id}`)}
                >
                  <Target className="h-4 w-4 mr-2" />
                  Monitor Scoring
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setShowEditModal(true)}
                >
                  <Settings className="h-4 w-4 mr-2" />
                  Edit Details
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Competition List */}
        <CompetitionList
          onCompetitionSelect={handleCompetitionSelect}
          onCompetitionEdit={handleCompetitionEdit}
          showActions={true}
        />

        {/* Edit Modal */}
        <EditCompetitionModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          competition={selectedCompetition}
          onCompetitionUpdated={handleCompetitionUpdated}
        />

      </div>
    </div>
  )
}
