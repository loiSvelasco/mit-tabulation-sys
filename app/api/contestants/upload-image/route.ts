import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { query } from "@/lib/db_config"

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File
    const contestantId = formData.get("contestantId") as string
    const oldImageUrl = formData.get("oldImageUrl") as string | null

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 })
    }

    if (!contestantId) {
      return NextResponse.json({ error: "No contestant ID provided" }, { status: 400 })
    }

    // Create uploads directory if it doesn't exist
    const uploadsDir = path.join(process.cwd(), "public", "uploads", "contestants")
    try {
      await fs.access(uploadsDir)
    } catch (error) {
      await fs.mkdir(uploadsDir, { recursive: true })
    }

    // Generate a unique filename
    const fileExtension = file.name.split(".").pop()
    const fileName = `contestant_${contestantId}_${uuidv4()}.${fileExtension}`
    const filePath = path.join(uploadsDir, fileName)

    // Convert file to buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Write file to disk
    await fs.writeFile(filePath, buffer)

    // Generate public URL
    const imageUrl = `/uploads/contestants/${fileName}`

    // If there was an old image, delete it
    if (oldImageUrl) {
      try {
        const oldImagePath = path.join(process.cwd(), "public", oldImageUrl)
        await fs.access(oldImagePath) // Check if file exists
        await fs.unlink(oldImagePath) // Delete the file
      } catch (error) {
        console.error("Error deleting old image:", error)
        // Continue even if old image deletion fails
      }
    }

    // Update the contestant's image URL in the database
    // First, get the competition ID for this contestant
    const competitionId = await getCompetitionIdForContestant(contestantId)

    if (competitionId) {
      // Update the competition data file with the new image URL
      await updateContestantImageInDatabase(competitionId, contestantId, imageUrl)
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("Error uploading image:", error)
    return NextResponse.json({ error: "Failed to upload image" }, { status: 500 })
  }
}

// Helper function to get the competition ID for a contestant
async function getCompetitionIdForContestant(contestantId: string): Promise<number | null> {
  try {
    // Query all competitions
    const competitions = await query("SELECT id, filename FROM competitions")

    // For each competition, check if it contains the contestant
    for (const competition of competitions) {
      const filePath = path.join(process.cwd(), "data", competition.filename)
      try {
        const fileData = await fs.readFile(filePath, "utf8")
        const competitionData = JSON.parse(fileData)

        // Check if this competition has the contestant
        const hasContestant = competitionData.contestants?.some((contestant: any) => contestant.id === contestantId)

        if (hasContestant) {
          return competition.id
        }
      } catch (error) {
        console.error(`Error reading competition file ${competition.filename}:`, error)
        // Continue to next competition
      }
    }

    return null
  } catch (error) {
    console.error("Error finding competition for contestant:", error)
    return null
  }
}

// Helper function to update the contestant's image URL in the database
async function updateContestantImageInDatabase(
  competitionId: number,
  contestantId: string,
  imageUrl: string,
): Promise<void> {
  try {
    // Get the competition data file
    const [competition] = await query("SELECT filename FROM competitions WHERE id = ?", [competitionId])

    if (!competition) {
      throw new Error(`Competition with ID ${competitionId} not found`)
    }

    const filePath = path.join(process.cwd(), "data", competition.filename)
    const fileData = await fs.readFile(filePath, "utf8")
    const competitionData = JSON.parse(fileData)

    // Update the contestant's image URL
    const updatedContestants = competitionData.contestants.map((contestant: any) => {
      if (contestant.id === contestantId) {
        return { ...contestant, imageUrl }
      }
      return contestant
    })

    // Update the competition data
    competitionData.contestants = updatedContestants

    // Write the updated data back to the file
    await fs.writeFile(filePath, JSON.stringify(competitionData, null, 2))

    console.log(`Updated image URL for contestant ${contestantId} in competition ${competitionId}`)
  } catch (error) {
    console.error("Error updating contestant image in database:", error)
    throw error
  }
}
