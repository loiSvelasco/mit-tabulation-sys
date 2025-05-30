"use client"

import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent } from "react"
import useCompetitionStore from "@/utils/useCompetitionStore"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import {
  EyeIcon,
  EyeOffIcon,
  RefreshCcwIcon,
  Trash2Icon,
  EditIcon,
  UserPlus,
  Plus,
  SaveIcon,
  XIcon,
} from "lucide-react"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table"
import { SyncJudgesButton } from "@/components/judge/sync-judges-button"
import { toast } from "sonner"
import { ImageUpload } from "./image-upload"
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

const EnhancedJudgeScoring = () => {
  const {
    competitionSettings,
    contestants,
    judges,
    addContestant,
    updateContestantName,
    removeContestant,
    addJudge,
    removeJudge,
    updateJudgeAccessCode,
    updateJudgeName,
    updateContestantSegment,
    selectedCompetitionId,
    updateContestantImage,
  } = useCompetitionStore()

  const [contestantName, setContestantName] = useState("")
  const [contestantGender, setContestantGender] = useState<"Male" | "Female">("Female")
  const [editingContestant, setEditingContestant] = useState<{ contestantId: string; name: string } | null>(null)
  const [localJudges, setLocalJudges] = useState(judges)

  // States for delete confirmations with both ID and name
  const [deleteContestant, setDeleteContestant] = useState<{ id: string; name: string } | null>(null)
  const [deleteJudge, setDeleteJudge] = useState<{ id: string; name: string } | null>(null)

  // Add these refs after the state declarations
  const contestantInputRef = useRef<HTMLInputElement>(null)
  const judgeInputRef = useRef<HTMLInputElement>(null)

  const [judgeName, setJudgeName] = useState("")
  const [showAccessCodes, setShowAccessCodes] = useState<{ [key: string]: boolean }>({})
  const [editingJudge, setEditingJudge] = useState<{ id: string; name: string } | null>(null)
  const [needsSync, setNeedsSync] = useState(false)

  // Add this effect to focus the contestant input when editing
  useEffect(() => {
    if (editingContestant && contestantInputRef.current) {
      contestantInputRef.current.focus()
    }
  }, [editingContestant])

  // Add this effect to focus the judge input when editing
  useEffect(() => {
    if (editingJudge && judgeInputRef.current) {
      judgeInputRef.current.focus()
    }
  }, [editingJudge])

  // Keep local judges in sync with store judges
  useEffect(() => {
    setLocalJudges(judges)
  }, [judges])

  const handleEditClickContestant = (contestantId: string, currentName: string) => {
    setEditingContestant({ contestantId: contestantId, name: currentName })
  }

  const handleSaveClickContestant = () => {
    if (editingContestant) {
      updateContestantName(editingContestant.contestantId, editingContestant.name)
      setEditingContestant(null)
    }
  }

  const handleCancelClickContestant = () => {
    setEditingContestant(null)
  }

  // Handle keyboard events for contestant editing
  const handleContestantEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveClickContestant()
    } else if (e.key === "Escape") {
      handleCancelClickContestant()
    }
  }

  const handleEditClickJudge = (judgeId: string, currentName: string) => {
    setEditingJudge({ id: judgeId, name: currentName })
  }

  const handleSaveClickJudge = () => {
    if (editingJudge) {
      updateJudgeName(editingJudge.id, editingJudge.name)
      setEditingJudge(null)
      setNeedsSync(true)
      toast.info("Judge name updated. Don't forget to sync to save changes to the database.")
    }
  }

  const handleCancelClickJudge = () => {
    setEditingJudge(null)
  }

  // Handle keyboard events for judge editing
  const handleJudgeEditKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveClickJudge()
    } else if (e.key === "Escape") {
      handleCancelClickJudge()
    }
  }

  const handleAddContestant = () => {
    if (!contestantName.trim()) return

    addContestant(contestantName, contestantGender)
    setContestantName("")
  }

  const handleAddJudge = () => {
    if (!judgeName.trim()) return
    setNeedsSync(true)
    addJudge(judgeName)
    setJudgeName("")
  }

  // Form submission handlers for Enter key
  const handleContestantFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleAddContestant()
  }

  const handleJudgeFormSubmit = (e: FormEvent) => {
    e.preventDefault()
    handleAddJudge()
  }

  const generateAccessCode = () => {
    const characters = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789" // Removed similar looking characters
    let result = ""
    for (let i = 0; i < 6; i++) {
      result += characters.charAt(Math.floor(Math.random() * characters.length))
    }
    return result
  }

  const handleRegenerateAccessCode = (judgeId: string) => {
    const newCode = generateAccessCode()
    console.log(`Regenerating access code for judge ${judgeId}: ${newCode}`)
    updateJudgeAccessCode(judgeId, newCode)
    setNeedsSync(true)
    toast.info("Access code regenerated. Don't forget to sync to save changes to the database.")
  }

  const toggleAccessCodeVisibility = (id: string) => {
    setShowAccessCodes((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  function capitalizeFirstLetter(s: string) {
    const result = s.replace(/([A-Z])/g, " $1")
    return result.charAt(0).toUpperCase() + result.slice(1)
  }

  // Handle image upload for a contestant
  const handleImageUpload = async (contestantId: string, file: File) => {
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("contestantId", contestantId)

      // Get the current image URL if it exists
      const contestant = contestants.find((c) => c.id === contestantId)
      if (contestant?.imageUrl) {
        formData.append("oldImageUrl", contestant.imageUrl)
      }

      const response = await fetch("/api/contestants/upload-image", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Failed to upload image")
      }

      const { imageUrl } = await response.json()
      console.log("Image uploaded successfully:", imageUrl)

      // Update the contestant with the new image URL
      updateContestantImage(contestantId, imageUrl)

      return imageUrl
    } catch (error) {
      console.error("Error uploading image:", error)
      toast.error(`Failed to upload image: ${error.message}`)
      throw error
    }
  }

  // Handle image removal for a contestant
  const handleImageRemove = (contestantId: string) => {
    updateContestantImage(contestantId, null)
  }

  // Handle contestant deletion with confirmation
  const handleDeleteContestant = (contestantId: string) => {
    removeContestant(contestantId)
    toast.success("Contestant deleted successfully")
  }

  // Handle judge deletion with confirmation
  const handleDeleteJudge = (judgeId: string) => {
    removeJudge(judgeId)
    setNeedsSync(true)
    toast.success("Judge deleted successfully")
    toast.info("Don't forget to sync to save changes to the database.")
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {/* Contestants Management */}
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Contestants</CardTitle>
          <CardDescription>Add and manage contestants</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleContestantFormSubmit} className="flex gap-2">
            <Input
              type="text"
              placeholder="Contestant Name"
              value={contestantName}
              onChange={(e) => setContestantName(e.target.value)}
            />
            {competitionSettings.separateRankingByGender && (
              <Select
                value={contestantGender}
                onValueChange={(value) => setContestantGender(value as "Male" | "Female")}
              >
                <SelectTrigger className="w-28">
                  <SelectValue placeholder="Select Gender" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Female">Female</SelectItem>
                  <SelectItem value="Male">Male</SelectItem>
                </SelectContent>
              </Select>
            )}
            <Button type="submit">
              <Plus /> Add
            </Button>
          </form>

          {/* Contestants Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Image</TableHead>
                  <TableHead>Name</TableHead>
                  {competitionSettings.separateRankingByGender && <TableHead>Gender</TableHead>}
                  <TableHead>Segment</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contestants.map((contestant) => (
                  <TableRow key={contestant.id} className="border-t">
                    <TableCell>{contestant.id}</TableCell>
                    <TableCell>
                      <ImageUpload
                        imageUrl={contestant.imageUrl}
                        onImageUpload={(file) => handleImageUpload(contestant.id, file)}
                        onImageRemove={() => handleImageRemove(contestant.id)}
                      />
                    </TableCell>
                    <TableCell>
                      {editingContestant?.contestantId === contestant.id ? (
                        <Input
                          ref={contestantInputRef}
                          value={editingContestant.name}
                          onChange={(e) => setEditingContestant((prev) => prev && { ...prev, name: e.target.value })}
                          onKeyDown={handleContestantEditKeyDown}
                        />
                      ) : (
                        contestant.name
                      )}
                    </TableCell>
                    {competitionSettings.separateRankingByGender && (
                      <TableCell>{capitalizeFirstLetter(contestant.gender)}</TableCell>
                    )}

                    {/* Segment Selection Dropdown */}
                    <TableCell>
                      <Select
                        value={contestant.currentSegmentId}
                        onValueChange={(segmentId) => updateContestantSegment(contestant.id, segmentId)}
                      >
                        <SelectTrigger className="w-48">
                          <SelectValue placeholder="Select Segment" />
                        </SelectTrigger>
                        <SelectContent>
                          {competitionSettings.segments.map((segment) => (
                            <SelectItem key={segment.id} value={segment.id}>
                              {segment.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>

                    <TableCell>
                      {editingContestant?.contestantId === contestant.id ? (
                        <>
                          <Button size="icon" variant="secondary" onClick={handleSaveClickContestant}>
                            <SaveIcon size={16} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={handleCancelClickContestant}>
                            <XIcon size={16} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700"
                            onClick={() => handleEditClickContestant(contestant.id, contestant.name)}
                          >
                            <EditIcon size={16} />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700 ml-2"
                        onClick={() => setDeleteContestant({ id: contestant.id, name: contestant.name })}
                      >
                        <Trash2Icon size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {contestants.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No contestants added.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Judges Management */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-2xl">Judges</CardTitle>
            <CardDescription>Add and manage judges</CardDescription>
          </div>
          {selectedCompetitionId && (
            <div className="flex items-center">
              {needsSync && (
                <div className="mr-2 text-sm text-yellow-600 dark:text-yellow-400">Changes need to be synced</div>
              )}
              <SyncJudgesButton competitionId={selectedCompetitionId} onSuccess={() => setNeedsSync(false)} />
            </div>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleJudgeFormSubmit} className="flex gap-2">
            <Input
              type="text"
              placeholder="Judge Name"
              value={judgeName}
              onChange={(e) => setJudgeName(e.target.value)}
            />
            <Button type="submit">
              <UserPlus /> Add
            </Button>
          </form>

          {/* Judges Table */}
          <div className="border rounded-md">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Access Code</TableCell>
                  <TableCell>Actions</TableCell>
                </TableRow>
              </TableHeader>
              <TableBody>
                {localJudges.map((judge) => (
                  <TableRow key={judge.id} className="border-t">
                    <TableCell>
                      {editingJudge?.id === judge.id ? (
                        <Input
                          ref={judgeInputRef}
                          value={editingJudge.name}
                          onChange={(e) => setEditingJudge((prev) => prev && { ...prev, name: e.target.value })}
                          onKeyDown={handleJudgeEditKeyDown}
                        />
                      ) : (
                        judge.name
                      )}
                    </TableCell>
                    <TableCell className="flex items-center gap-2">
                      <span className="font-mono">{showAccessCodes[judge.id] ? judge.accessCode : "••••••"}</span>
                      <Button size="icon" variant="ghost" onClick={() => toggleAccessCodeVisibility(judge.id)}>
                        {showAccessCodes[judge.id] ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => handleRegenerateAccessCode(judge.id)}
                        title="Regenerate access code"
                      >
                        <RefreshCcwIcon size={16} />
                      </Button>
                    </TableCell>
                    <TableCell>
                      {editingJudge?.id === judge.id ? (
                        <>
                          <Button size="icon" variant="secondary" onClick={handleSaveClickJudge}>
                            <SaveIcon size={16} />
                          </Button>
                          <Button size="icon" variant="ghost" onClick={handleCancelClickJudge}>
                            <XIcon size={16} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="icon"
                            variant="outline"
                            className="bg-yellow-50 border-yellow-200 text-yellow-600 hover:bg-yellow-100 hover:text-yellow-700 mr-2"
                            onClick={() => handleEditClickJudge(judge.id, judge.name)}
                          >
                            <EditIcon size={16} />
                          </Button>
                        </>
                      )}
                      <Button
                        size="icon"
                        variant="outline"
                        className="bg-red-50 border-red-200 text-red-600 hover:bg-red-100 hover:text-red-700"
                        onClick={() => setDeleteJudge({ id: judge.id, name: judge.name })}
                      >
                        <Trash2Icon size={16} />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
                {judges.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      No judges added.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Contestant Delete Confirmation Dialog */}
      <AlertDialog open={deleteContestant !== null} onOpenChange={(open) => !open && setDeleteContestant(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete contestant <span className="font-semibold">{deleteContestant?.name}</span>
              ? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteContestant) {
                  handleDeleteContestant(deleteContestant.id)
                  setDeleteContestant(null)
                }
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Judge Delete Confirmation Dialog */}
      <AlertDialog open={deleteJudge !== null} onOpenChange={(open) => !open && setDeleteJudge(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Deletion</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete judge <span className="font-semibold">{deleteJudge?.name}</span>? This
              action cannot be undone.
              {needsSync ? " Remember to sync changes to save to the database." : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteJudge) {
                  handleDeleteJudge(deleteJudge.id)
                  setDeleteJudge(null)
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

export default EnhancedJudgeScoring
