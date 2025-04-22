import { NextResponse } from "next/server"
import { promises as fs } from "fs"
import path from "path"
import { v4 as uuidv4 } from "uuid"
import { query } from "@/lib/db_config"
import { put } from "@vercel/blob"

// Environment variable to control storage method
const useLocalStorage = process.env.USE_LOCAL_STORAGE === "true"

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

    // Generate a unique filename
    const fileExtension = file.name.split(".").pop()
    const fileName = `contestant_${contestantId}_${uuidv4()}.${fileExtension}`

    let imageUrl: string

    if (useLocalStorage) {
      // Local storage approach
      const uploadsDir = path.join(process.cwd(), "public", "uploads", "contestants")

      try {
        await fs.mkdir(uploadsDir, { recursive: true })
      } catch (error) {
        console.error("Error creating directory:", error)
        // If directory creation fails, try using the tmp directory
        if (error.code === "EACCES" || error.code === "EPERM") {
          console.log("Falling back to /tmp directory")
          const tmpDir = path.join("/tmp", "uploads", "contestants")
          await fs.mkdir(tmpDir, { recursive: true })

          // Convert file to buffer
          const buffer = Buffer.from(await file.arrayBuffer())

          // Write file to tmp directory
          await fs.writeFile(path.join(tmpDir, fileName), buffer)

          // Note: Files in /tmp won't be accessible via URL, so this is just for testing
          imageUrl = `/tmp/uploads/contestants/${fileName}`

          return NextResponse.json({
            imageUrl,
            warning: "File saved to temporary directory. This is not accessible via URL in production.",
          })
        }
        throw error
      }

      // Convert file to buffer
      const buffer = Buffer.from(await file.arrayBuffer())

      // Write file to disk
      await fs.writeFile(path.join(uploadsDir, fileName), buffer)

      // Generate public URL
      imageUrl = `/uploads/contestants/${fileName}`

      // Delete old image if it exists
      if (oldImageUrl && oldImageUrl.startsWith("/uploads/")) {
        try {
          const oldImagePath = path.join(process.cwd(), "public", oldImageUrl)
          await fs.access(oldImagePath) // Check if file exists
          await fs.unlink(oldImagePath) // Delete the file
        } catch (error) {
          console.error("Error deleting old image:", error)
          // Continue even if old image deletion fails
        }
      }
    } else {
      // Vercel Blob Storage approach
      const blob = await put(fileName, file, {
        access: "public",
      })

      // Get the URL of the uploaded file
      imageUrl = blob.url

      // Note: We can't easily delete old blobs without the blob ID
    }

    // Update the contestant's image URL in the database
    const competitionId = await getCompetitionIdForContestant(contestantId)

    if (competitionId) {
      // Update the competition data with the new image URL
      await updateContestantImageInDatabase(competitionId, contestantId, imageUrl)
    }

    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error("Error uploading image:", error)
    return NextResponse.json({ error: `Failed to upload image: ${error.message}` }, { status: 500 })
  }
}

// Helper function to get the competition ID for a contestant
async function getCompetitionIdForContestant(contestantId: string): Promise<number | null> {
  try {
    // Query all competitions
    const competitions = await query("SELECT id, competition_data FROM competitions")

    // For each competition, check if it contains the contestant
    for (const competition of competitions) {
      try {
        // Parse the competition data from the database
        const competitionData = JSON.parse(competition.competition_data || "{}")

        // Check if this competition has the contestant
        const hasContestant = competitionData.contestants?.some((contestant: any) => contestant.id === contestantId)

        if (hasContestant) {
          return competition.id
        }
      } catch (error) {
        console.error(`Error parsing competition data for ID ${competition.id}:`, error)
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
    // Get the competition data from the database
    const [competition] = await query("SELECT competition_data FROM competitions WHERE id = ?", [competitionId])

    if (!competition) {
      throw new Error(`Competition with ID ${competitionId} not found`)
    }

    // Parse the competition data
    const competitionData = JSON.parse(competition.competition_data || "{}")

    // Update the contestant's image URL
    const updatedContestants = competitionData.contestants.map((contestant: any) => {
      if (contestant.id === contestantId) {
        return { ...contestant, imageUrl }
      }
      return contestant
    })

    // Update the competition data
    competitionData.contestants = updatedContestants

    // Write the updated data back to the database
    await query("UPDATE competitions SET competition_data = ? WHERE id = ?", [
      JSON.stringify(competitionData),
      competitionId,
    ])

    console.log(`Updated image URL for contestant ${contestantId} in competition ${competitionId}`)
  } catch (error) {
    console.error("Error updating contestant image in database:", error)
    throw error
  }
}
