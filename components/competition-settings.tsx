"use client"

import type React from "react"
import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { v4 as uuidv4 } from "uuid"
import { Plus, Trash2, Info, EditIcon, SaveIcon, XIcon } from "lucide-react"
import { toast } from "sonner"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { PrejudgedScoresInput } from "@/components/prejudged/PrejudgedScoresInput"
import { CarryForwardConfig } from "@/components/CarryForwardConfig"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"

const CompetitionSettings = () => {
  const { competitionSettings, setCompetitionSettings, addSegment, removeSegment, addCriterion, removeCriterion } =
    useCompetitionStore()

  const [segmentName, setSegmentName] = useState("")
  const [criteriaInput, setCriteriaInput] = useState({
    name: "",
    description: "",
    maxScore: 10,
    segmentId: "",
    isPrejudged: false,
    isCarryForward: false,
  })

  // States for editing segments
  const [editingSegment, setEditingSegment] = useState<{ id: string; name: string } | null>(null)

  // States for editing criteria
  const [editingCriterion, setEditingCriterion] = useState<{
    segmentId: string
    criterionId: string
    name: string
    description: string
    maxScore: number
    isPrejudged: boolean
    isCarryForward: boolean
  } | null>(null)

  // State for delete confirmation
  const [deleteSegment, setDeleteSegment] = useState<{ id: string; name: string } | null>(null)
  const [deleteCriterion, setDeleteCriterion] = useState<{
    segmentId: string
    criterionId: string
    name: string
  } | null>(null)

  const segmentInputRef = useRef<HTMLInputElement>(null)
  const criterionNameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingSegment && segmentInputRef.current) {
      segmentInputRef.current.focus()
    }
  }, [editingSegment])

  useEffect(() => {
    if (editingCriterion && criterionNameInputRef.current) {
      // Only focus if we're just starting to edit (when criterionId changes)
      const timeoutId = setTimeout(() => {
        criterionNameInputRef.current?.focus()
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [editingCriterion?.criterionId]) // Only depend on criterionId, not the entire editingCriterion object

  const handleCompetitionNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCompetitionSettings({ ...competitionSettings, name: e.target.value })
  }

  const handleToggleRankingByGender = () => {
    setCompetitionSettings({
      ...competitionSettings,
      separateRankingByGender: !competitionSettings.separateRankingByGender,
    })
  }

  const handleAddSegment = () => {
    if (segmentName.trim() === "") {
      toast.error("Enter segment name.")
      return
    }
    addSegment(segmentName)
    setSegmentName("")
  }

  const handleAddCriterion = (segmentId: string) => {
    if (!criteriaInput.name.trim()) {
      toast.error("Criterion name cannot be empty")
      return
    }
    addCriterion(segmentId, {
      id: uuidv4(),
      name: criteriaInput.name,
      description: criteriaInput.description,
      maxScore: criteriaInput.maxScore,
      isPrejudged: criteriaInput.isPrejudged,
      isCarryForward: criteriaInput.isCarryForward,
    })
    setCriteriaInput({
      ...criteriaInput,
      name: "",
      description: "",
      maxScore: 10,
      isPrejudged: false,
      isCarryForward: false,
    })
  }

  // Form submission handlers for Enter key
  const handleSegmentFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleAddSegment()
  }

  const handleCriterionFormSubmit = (e: FormEvent, segmentId: string) => {
    e.preventDefault()
    handleAddCriterion(segmentId)
  }

  // Edit segment functions
  const handleEditSegmentClick = (segmentId: string, currentName: string) => {
    setEditingSegment({ id: segmentId, name: currentName })
  }

  const handleSaveSegmentClick = () => {
    if (editingSegment && editingSegment.name.trim()) {
      setCompetitionSettings({
        ...competitionSettings,
        segments: competitionSettings.segments.map((s) =>
          s.id === editingSegment.id ? { ...s, name: editingSegment.name } : s,
        ),
      })
      setEditingSegment(null)
      toast.success("Segment name updated")
    } else {
      toast.error("Segment name cannot be empty")
    }
  }

  const handleCancelSegmentClick = () => {
    setEditingSegment(null)
  }

  // Handle keyboard events for segment editing
  const handleSegmentEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveSegmentClick()
    } else if (e.key === "Escape") {
      handleCancelSegmentClick()
    }
  }

  // Edit criterion functions
  const handleEditCriterionClick = (segmentId: string, criterion: any) => {
    setEditingCriterion({
      segmentId,
      criterionId: criterion.id,
      name: criterion.name,
      description: criterion.description,
      maxScore: criterion.maxScore,
      isPrejudged: criterion.isPrejudged,
      isCarryForward: criterion.isCarryForward,
    })
  }

  const handleSaveCriterionClick = () => {
    if (editingCriterion && editingCriterion.name.trim()) {
      // Update the criterion in the segment
      setCompetitionSettings({
        ...competitionSettings,
        segments: competitionSettings.segments.map((s) =>
          s.id === editingCriterion.segmentId
            ? {
                ...s,
                criteria: s.criteria.map((c) =>
                  c.id === editingCriterion.criterionId
                    ? {
                        ...c,
                        name: editingCriterion.name,
                        description: editingCriterion.description,
                        maxScore: editingCriterion.maxScore,
                        isPrejudged: editingCriterion.isPrejudged,
                        isCarryForward: editingCriterion.isCarryForward,
                      }
                    : c,
                ),
              }
            : s,
        ),
      })
      setEditingCriterion(null)
      toast.success("Criterion updated")
    } else {
      toast.error("Criterion name cannot be empty")
    }
  }

  const handleCancelCriterionClick = () => {
    setEditingCriterion(null)
  }

  // Handle keyboard events for criterion editing
  const handleCriterionEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveCriterionClick()
    } else if (e.key === "Escape") {
      handleCancelCriterionClick()
    }
  }

  // Handle segment deletion with confirmation
  const handleDeleteSegment = (segmentId: string) => {
    removeSegment(segmentId)
    toast.success("Segment deleted successfully")
  }

  // Handle criterion deletion with confirmation
  const handleDeleteCriterion = (segmentId: string, criterionId: string) => {
    removeCriterion(segmentId, criterionId)
    toast.success("Criterion deleted successfully")
  }

  return (
    <div className="space-y-4">
      {/* Competition Details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Competition Name</CardTitle>
          <CardDescription>Set up the basic information about your competition</CardDescription>
        </CardHeader>
        <CardContent>
          <Input
            type="text"
            placeholder="Competition Name"
            value={competitionSettings.name}
            onChange={handleCompetitionNameChange}
            className="mt-2"
          />
          <div className="flex items-center gap-2 mt-4">
            <Checkbox
              checked={competitionSettings.separateRankingByGender}
              onCheckedChange={handleToggleRankingByGender}
            />
            <label>Separate rankings by gender</label>
          </div>
        </CardContent>
      </Card>

      {/* Segments & Criteria */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Competition Segments</CardTitle>
          <CardDescription>Set up the segments that will make up your competition</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSegmentFormSubmit} className="flex gap-2 mt-2">
            <Input
              type="text"
              placeholder="Segment Name"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
            />
            <Button type="submit">
              <Plus /> Add Segment
            </Button>
          </form>

          <Tabs defaultValue={competitionSettings.segments[0]?.id}>
            <TabsList className="mt-4">
              {competitionSettings.segments.map((segment) => (
                <TabsTrigger
                  className="data-[state=active]:font-bold data-[state=active]:bg-white"
                  key={segment.id}
                  value={segment.id}
                >
                  {segment.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {competitionSettings.segments.map((segment) => (
              <TabsContent key={segment.id} value={segment.id}>
                <div className="mt-4">
                  <div className="flex justify-between items-center mb-4">
                    {editingSegment?.id === segment.id ? (
                      <div className="flex items-center gap-2">
                        <Input
                          ref={segmentInputRef}
                          value={editingSegment.name}
                          onChange={(e) => setEditingSegment((prev) => prev && { ...prev, name: e.target.value })}
                          onKeyDown={handleSegmentEditKeyDown}
                          className="max-w-xs"
                        />
                        <Button size="icon" variant="ghost" onClick={handleSaveSegmentClick}>
                          <SaveIcon size={16} />
                        </Button>
                        <Button size="icon" variant="ghost" onClick={handleCancelSegmentClick}>
                          <XIcon size={16} />
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <h3 className="text-lg font-semibold">{segment.name}</h3>
                        <Button
                          size="icon"
                          variant="outline"
                          className="bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700"
                          onClick={() => handleEditSegmentClick(segment.id, segment.name)}
                        >
                          <EditIcon size={16} />
                        </Button>
                      </div>
                    )}
                    <Button
                      onClick={() => setDeleteSegment({ id: segment.id, name: segment.name })}
                      className="float-right bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
                      variant="outline"
                    >
                      <Trash2 /> Remove Segment
                    </Button>
                  </div>

                  <h3 className="text-md font-semibold">Advancing Candidates</h3>
                  <Input
                    type="number"
                    min="0"
                    value={segment.advancingCandidates}
                    onChange={(e) => {
                      setCompetitionSettings({
                        ...competitionSettings,
                        segments: competitionSettings.segments.map((s) =>
                          s.id === segment.id ? { ...s, advancingCandidates: Number(e.target.value) } : s,
                        ),
                      })
                    }}
                    className="mt-2"
                  />
                </div>

                {/* Criteria */}
                <div className="mt-6">
                  <h3 className="text-md font-semibold">Criteria for Judging</h3>
                  <form onSubmit={(e) => handleCriterionFormSubmit(e, segment.id)} className="flex flex-col gap-2 mt-2">
                    <div className="flex gap-2">
                      <Input
                        type="text"
                        placeholder="Criterion Name"
                        value={criteriaInput.name}
                        onChange={(e) =>
                          setCriteriaInput({ ...criteriaInput, name: e.target.value, segmentId: segment.id })
                        }
                      />
                      <Input
                        type="text"
                        placeholder="Description"
                        value={criteriaInput.description}
                        onChange={(e) => setCriteriaInput({ ...criteriaInput, description: e.target.value })}
                      />
                      <Input
                        type="number"
                        min="1"
                        max="100"
                        placeholder="Max Score"
                        value={criteriaInput.maxScore}
                        onChange={(e) => setCriteriaInput({ ...criteriaInput, maxScore: Number(e.target.value) })}
                      />
                    </div>

                    {/* Add Pre-judged Checkbox */}
                    <div className="flex items-center gap-2 ml-1 mb-2">
                      <Checkbox
                        id={`isPrejudged-${segment.id}`}
                        checked={criteriaInput.isPrejudged}
                        onCheckedChange={(checked) => {
                          // If this is a pre-judged criterion, it can't be carry-forward
                          if (checked === true) {
                            setCriteriaInput({
                              ...criteriaInput,
                              isPrejudged: true,
                              isCarryForward: false,
                            })
                          } else {
                            setCriteriaInput({
                              ...criteriaInput,
                              isPrejudged: false,
                            })
                          }
                        }}
                      />
                      <label htmlFor={`isPrejudged-${segment.id}`} className="text-sm font-medium">
                        This is a pre-judged criterion
                      </label>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Pre-judged criteria are scored by administrators before the live event. These scores will
                              be automatically applied to all judges.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    {/* Add Carry-Forward Checkbox */}
                    <div className="flex items-center gap-2 ml-1 mb-2">
                      <Checkbox
                        id={`isCarryForward-${segment.id}`}
                        checked={criteriaInput.isCarryForward}
                        onCheckedChange={(checked) => {
                          // If this is a carry-forward criterion, it can't be prejudged
                          if (checked === true) {
                            setCriteriaInput({
                              ...criteriaInput,
                              isCarryForward: true,
                              isPrejudged: false,
                            })
                          } else {
                            setCriteriaInput({
                              ...criteriaInput,
                              isCarryForward: false,
                            })
                          }
                        }}
                      />
                      <label htmlFor={`isCarryForward-${segment.id}`} className="text-sm font-medium">
                        This is a carry-forward criterion
                      </label>

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              Carry-forward criteria automatically include scores from previous segments. You'll need to
                              configure the source segments after creating this criterion.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>

                    <Button type="submit">Add Criterion</Button>
                  </form>
                  <div className="border rounded-md space-y-2 mt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Criteria</TableHead>
                          <TableHead>Maximum Points</TableHead>
                          <TableHead>Type</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {segment.criteria.map((criterion) => (
                          <TableRow key={criterion.id} className="border-t">
                            <TableCell>
                              {editingCriterion?.criterionId === criterion.id ? (
                                <div className="space-y-2">
                                  <Input
                                    ref={criterionNameInputRef}
                                    value={editingCriterion.name}
                                    onChange={(e) =>
                                      setEditingCriterion((prev) => prev && { ...prev, name: e.target.value })
                                    }
                                    onKeyDown={handleCriterionEditKeyDown}
                                    placeholder="Criterion Name"
                                  />
                                  <Input
                                    value={editingCriterion.description}
                                    onChange={(e) =>
                                      setEditingCriterion((prev) => prev && { ...prev, description: e.target.value })
                                    }
                                    onKeyDown={handleCriterionEditKeyDown}
                                    placeholder="Description"
                                  />
                                </div>
                              ) : (
                                <>
                                  {criterion.name} - {criterion.description}
                                </>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingCriterion?.criterionId === criterion.id ? (
                                <Input
                                  type="number"
                                  min="1"
                                  max="100"
                                  value={editingCriterion.maxScore}
                                  onChange={(e) =>
                                    setEditingCriterion((prev) => prev && { ...prev, maxScore: Number(e.target.value) })
                                  }
                                  onKeyDown={handleCriterionEditKeyDown}
                                />
                              ) : (
                                criterion.maxScore
                              )}
                            </TableCell>
                            <TableCell>
                              {editingCriterion?.criterionId === criterion.id ? (
                                <div className="space-y-2">
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`edit-isPrejudged-${criterion.id}`}
                                      checked={editingCriterion.isPrejudged}
                                      onCheckedChange={(checked) => {
                                        if (checked === true) {
                                          setEditingCriterion(
                                            (prev) => prev && { ...prev, isPrejudged: true, isCarryForward: false },
                                          )
                                        } else {
                                          setEditingCriterion((prev) => prev && { ...prev, isPrejudged: false })
                                        }
                                      }}
                                    />
                                    <label htmlFor={`edit-isPrejudged-${criterion.id}`} className="text-sm">
                                      Pre-judged
                                    </label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Checkbox
                                      id={`edit-isCarryForward-${criterion.id}`}
                                      checked={editingCriterion.isCarryForward}
                                      onCheckedChange={(checked) => {
                                        if (checked === true) {
                                          setEditingCriterion(
                                            (prev) => prev && { ...prev, isCarryForward: true, isPrejudged: false },
                                          )
                                        } else {
                                          setEditingCriterion((prev) => prev && { ...prev, isCarryForward: false })
                                        }
                                      }}
                                    />
                                    <label htmlFor={`edit-isCarryForward-${criterion.id}`} className="text-sm">
                                      Carry-Forward
                                    </label>
                                  </div>
                                </div>
                              ) : (
                                <>
                                  {criterion.isPrejudged ? (
                                    <Badge variant="outline" className="bg-blue-50 text-blue-700">
                                      Pre-judged
                                    </Badge>
                                  ) : criterion.isCarryForward ? (
                                    <Badge variant="outline" className="bg-green-50 text-green-700">
                                      Carry-Forward
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline">Live</Badge>
                                  )}
                                </>
                              )}
                            </TableCell>
                            <TableCell>
                              {editingCriterion?.criterionId === criterion.id ? (
                                <>
                                  <Button size="icon" variant="secondary" onClick={handleSaveCriterionClick}>
                                    <SaveIcon size={16} />
                                  </Button>
                                  <Button size="icon" variant="ghost" onClick={handleCancelCriterionClick}>
                                    <XIcon size={16} />
                                  </Button>
                                </>
                              ) : (
                                <div className="flex space-x-2">
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700"
                                    onClick={() => handleEditCriterionClick(segment.id, criterion)}
                                  >
                                    <EditIcon size={16} />
                                  </Button>
                                  <Button
                                    size="icon"
                                    variant="outline"
                                    className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
                                    onClick={() =>
                                      setDeleteCriterion({
                                        segmentId: segment.id,
                                        criterionId: criterion.id,
                                        name: criterion.name,
                                      })
                                    }
                                  >
                                    <Trash2 size={16} />
                                  </Button>
                                </div>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                        {segment.criteria.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center text-muted-foreground">
                              No criteria added for this segment.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Pre-judged Scores Input Component */}
      <PrejudgedScoresInput />

      {/* Carry-Forward Scores Configuration */}
      <CarryForwardConfig />

      {/* Segment Delete Confirmation Dialog */}
      <AlertDialog open={deleteSegment !== null} onOpenChange={(open) => !open && setDeleteSegment(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete segment <span className="font-semibold">{deleteSegment?.name}</span>? This
              will also delete all criteria associated with this segment. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteSegment) {
                  handleDeleteSegment(deleteSegment.id)
                  setDeleteSegment(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Criterion Delete Confirmation Dialog */}
      <AlertDialog open={deleteCriterion !== null} onOpenChange={(open) => !open && setDeleteCriterion(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete criterion <span className="font-semibold">{deleteCriterion?.name}</span>?
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteCriterion) {
                  handleDeleteCriterion(deleteCriterion.segmentId, deleteCriterion.criterionId)
                  setDeleteCriterion(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default CompetitionSettings
