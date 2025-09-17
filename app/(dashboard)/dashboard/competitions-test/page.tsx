"use client"

import { useState } from "react"
import { CompetitionList, EditCompetitionModal } from "@/components/competition-management"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Settings, Eye } from "lucide-react"

interface Competition {
  id: number
  name: string
  is_active: boolean
  created_at: string
  score_count?: number
  judge_count?: number
}

export default function CompetitionsTestPage() {
  const [selectedCompetition, setSelectedCompetition] = useState<Competition | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)

  const handleCompetitionSelect = (competition: Competition) => {
    setSelectedCompetition(competition)
    console.log("Selected competition:", competition)
  }

  const handleCompetitionEdit = (competition: Competition) => {
    setSelectedCompetition(competition)
    setShowEditModal(true)
  }

  const handleCompetitionUpdated = (updatedCompetition: Competition) => {
    setSelectedCompetition(updatedCompetition)
    setShowEditModal(false)
    console.log("Updated competition:", updatedCompetition)
  }

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Trophy className="h-8 w-8" />
            Competition Management Test
          </h1>
          <p className="text-muted-foreground mt-2">
            Test page for the new competition management components
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
            <Settings className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </div>

      {/* Selected Competition Info */}
      {selectedCompetition && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5" />
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

      {/* Component Documentation */}
      <Card>
        <CardHeader>
          <CardTitle>Component Features</CardTitle>
          <CardDescription>
            Overview of the competition management components
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="font-semibold mb-2">CompetitionList</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Fetches and displays all competitions</li>
                <li>• Search and filter functionality</li>
                <li>• Statistics overview (total, active, judges)</li>
                <li>• Loading and error states</li>
                <li>• Empty state with call-to-action</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">CompetitionCard</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Displays competition details</li>
                <li>• Action dropdown menu</li>
                <li>• Active/inactive status badge</li>
                <li>• Statistics (judges, scores)</li>
                <li>• Compact and default variants</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">CreateCompetitionModal</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Form validation</li>
                <li>• Create competition with minimal data</li>
                <li>• Set as active option</li>
                <li>• Loading states</li>
                <li>• Error handling</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-2">EditCompetitionModal</h4>
              <ul className="text-sm text-muted-foreground space-y-1">
                <li>• Load competition details</li>
                <li>• Update name and status</li>
                <li>• Display statistics</li>
                <li>• Form validation</li>
                <li>• Loading states</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

