"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2, Save, X, AlertCircle } from "lucide-react"
import { toast } from "sonner"

interface Competition {
  id: number
  name: string
  is_active: boolean
  created_at: string
  score_count?: number
  judge_count?: number
}

interface EditCompetitionModalProps {
  isOpen: boolean
  onClose: () => void
  competition: Competition | null
  onCompetitionUpdated: (competition: Competition) => void
}

export function EditCompetitionModal({ 
  isOpen, 
  onClose, 
  competition,
  onCompetitionUpdated 
}: EditCompetitionModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLoadingCompetition, setIsLoadingCompetition] = useState(false)

  // Load competition data when modal opens
  useEffect(() => {
    if (isOpen && competition) {
      setIsLoadingCompetition(true)
      
      // Load full competition details
      fetch(`/api/competitions/${competition.id}`)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            const comp = data.competition
            setFormData({
              name: comp.name,
              description: "", // We'll need to add description to the API response
              isActive: comp.is_active
            })
          } else {
            throw new Error(data.message || "Failed to load competition details")
          }
        })
        .catch(error => {
          console.error("Error loading competition details:", error)
          toast.error("Failed to load competition details")
          onClose()
        })
        .finally(() => {
          setIsLoadingCompetition(false)
        })
    }
  }, [isOpen, competition, onClose])

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!formData.name.trim()) {
      newErrors.name = "Competition name is required"
    } else if (formData.name.trim().length < 3) {
      newErrors.name = "Competition name must be at least 3 characters"
    } else if (formData.name.trim().length > 100) {
      newErrors.name = "Competition name must be less than 100 characters"
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!competition || !validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      const response = await fetch(`/api/competitions/${competition.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: formData.name.trim(),
          isActive: formData.isActive
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to update competition")
      }

      const result = await response.json()
      
      // Create the updated competition object
      const updatedCompetition: Competition = {
        ...competition,
        name: result.competition.name,
        is_active: result.competition.is_active
      }

      onCompetitionUpdated(updatedCompetition)
      
      onClose()
      
    } catch (error) {
      console.error("Error updating competition:", error)
      toast.error(error instanceof Error ? error.message : "Failed to update competition")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading && !isLoadingCompetition) {
      setFormData({
        name: "",
        description: "",
        isActive: false
      })
      setErrors({})
      onClose()
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }))
    }
  }

  if (!competition) {
    return null
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Save className="h-5 w-5" />
            Edit Competition
          </DialogTitle>
          <DialogDescription>
            Update the competition name and settings. Changes will be saved immediately.
          </DialogDescription>
        </DialogHeader>

        {isLoadingCompetition ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <Loader2 className="h-8 w-8 animate-spin mx-auto" />
              <p className="text-sm text-muted-foreground">Loading competition details...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Competition Name <span className="text-red-500">*</span>
              </Label>
              <Input
                id="name"
                placeholder="e.g., Mr. & Ms. SCUAA 2025"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className={errors.name ? "border-red-500" : ""}
                disabled={isLoading}
              />
              {errors.name && (
                <p className="text-sm text-red-500">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">
                Description (Optional)
              </Label>
              <Textarea
                id="description"
                placeholder="Brief description of the competition..."
                value={formData.description}
                onChange={(e) => handleInputChange("description", e.target.value)}
                rows={3}
                disabled={isLoading}
              />
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <Label htmlFor="isActive">Set as Active Competition</Label>
                <p className="text-sm text-muted-foreground">
                  Only one competition can be active at a time
                </p>
              </div>
              <Switch
                id="isActive"
                checked={formData.isActive}
                onCheckedChange={(checked) => handleInputChange("isActive", checked)}
                disabled={isLoading}
              />
            </div>

            {/* Competition Stats */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <h4 className="text-sm font-medium">Competition Statistics</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Created:</span>
                  <span className="ml-2 font-medium">
                    {new Date(competition.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Judges:</span>
                  <span className="ml-2 font-medium">{competition.judge_count || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Scores:</span>
                  <span className="ml-2 font-medium">{competition.score_count || 0}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <span className={`ml-2 font-medium ${competition.is_active ? 'text-green-600' : 'text-gray-600'}`}>
                    {competition.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={isLoading}
              >
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !formData.name.trim()}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save Changes
                  </>
                )}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
