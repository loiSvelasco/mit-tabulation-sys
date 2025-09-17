"use client"

import { useState } from "react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Loader2, Plus, X } from "lucide-react"
import { toast } from "sonner"

interface Competition {
  id: number
  name: string
  is_active: boolean
  created_at: string
}

interface CreateCompetitionModalProps {
  isOpen: boolean
  onClose: () => void
  onCompetitionCreated: (competition: Competition) => void
}

export function CreateCompetitionModal({ 
  isOpen, 
  onClose, 
  onCompetitionCreated 
}: CreateCompetitionModalProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    isActive: false
  })
  const [isLoading, setIsLoading] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

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
    
    if (!validateForm()) {
      return
    }

    setIsLoading(true)
    try {
      // Create the competition with minimal data
      const competitionData = {
        competitionSettings: {
          name: formData.name.trim(),
          description: formData.description.trim() || "",
          // Add default settings
          segments: [],
          rankingMethod: "avg",
          separateRankingByGender: false,
          carryForwardScores: false,
          carryForwardPercentage: 0
        },
        contestants: [],
        judges: [],
        scores: {},
        activeCriteria: []
      }

      const response = await fetch("/api/competitions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          competitionData,
          name: formData.name.trim(),
          isActive: formData.isActive
        }),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.message || "Failed to create competition")
      }

      const result = await response.json()
      
      // Create the competition object for the callback
      const newCompetition: Competition = {
        id: result.id,
        name: result.name,
        is_active: formData.isActive,
        created_at: new Date().toISOString()
      }

      onCompetitionCreated(newCompetition)
      
      // Reset form
      setFormData({
        name: "",
        description: "",
        isActive: false
      })
      setErrors({})
      
      onClose()
      
    } catch (error) {
      console.error("Error creating competition:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create competition")
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
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

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            Create New Competition
          </DialogTitle>
          <DialogDescription>
            Create a new competition and configure its basic settings. You can add contestants, judges, and scoring criteria later.
          </DialogDescription>
        </DialogHeader>

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
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Competition
                </>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
