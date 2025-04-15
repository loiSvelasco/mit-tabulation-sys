import { type NextRequest, NextResponse } from "next/server"
import { query } from "@/lib/db_config"
import { adminMiddleware } from "@/lib/auth"

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  // Check if user is admin
  const authCheck = await adminMiddleware(request)
  if (authCheck) {
    return authCheck // Return the unauthorized response if not admin
  }

  try {
    // Fix: Properly await the params object
    const resolvedParams = await params
    const competitionId = resolvedParams.id

    console.log(`Syncing judges for competition ID: ${competitionId}`)

    // Get judges from the request body instead of the store
    const { judges } = await request.json()
    console.log(`Found ${judges.length} judges in the request:`, judges)

    // Create an array to store results
    const results = []

    // For each judge in the request
    for (const judge of judges) {
      try {
        console.log(`Processing judge: ${judge.id} (${judge.name}) with access code: ${judge.accessCode}`)

        // Check if this judge already has an entry in the database
        const existingResult = await query(
          `
          SELECT id, access_code, judge_name FROM judge_competition_access 
          WHERE competition_id = ? AND judge_id = ?
          `,
          [competitionId, judge.id],
        )

        console.log(`Database check result:`, existingResult)

        if (existingResult.length > 0) {
          const currentAccessCode = existingResult[0].access_code
          const currentJudgeName = existingResult[0].judge_name
          console.log(`Existing access code in DB: ${currentAccessCode}, New code: ${judge.accessCode}`)
          console.log(`Existing judge name in DB: ${currentJudgeName}, New name: ${judge.name}`)

          const needsUpdate = currentAccessCode !== judge.accessCode || currentJudgeName !== judge.name

          if (needsUpdate) {
            // Update existing record with new access code and judge name
            const updateResult = await query(
              `
              UPDATE judge_competition_access 
              SET access_code = ?, judge_name = ?, is_active = TRUE
              WHERE competition_id = ? AND judge_id = ?
              `,
              [judge.accessCode, judge.name, competitionId, judge.id],
            )

            console.log(`Update result:`, updateResult)

            results.push({
              id: judge.id,
              name: judge.name,
              status: "updated",
              oldCode: currentAccessCode,
              newCode: judge.accessCode,
              oldName: currentJudgeName,
              newName: judge.name,
            })
          } else {
            // Access code and name haven't changed, just ensure it's active
            await query(
              `
              UPDATE judge_competition_access 
              SET is_active = TRUE
              WHERE competition_id = ? AND judge_id = ?
              `,
              [competitionId, judge.id],
            )

            results.push({
              id: judge.id,
              name: judge.name,
              status: "unchanged",
              code: judge.accessCode,
            })
          }
        } else {
          // Insert new record with judge name
          const insertResult = await query(
            `
            INSERT INTO judge_competition_access 
            (judge_id, competition_id, access_code, judge_name, is_active) 
            VALUES (?, ?, ?, ?, TRUE)
            `,
            [judge.id, competitionId, judge.accessCode, judge.name],
          )

          console.log(`Insert result:`, insertResult)

          results.push({
            id: judge.id,
            name: judge.name,
            status: "created",
            code: judge.accessCode,
          })
        }
      } catch (error) {
        console.error(`Error syncing judge ${judge.id}:`, error)
        results.push({
          id: judge.id,
          name: judge.name,
          status: "error",
          error: String(error),
        })
      }
    }

    // Verify the updates by fetching the current state from the database
    const verificationResult = await query(
      `
      SELECT judge_id, access_code, judge_name FROM judge_competition_access 
      WHERE competition_id = ?
      `,
      [competitionId],
    )

    console.log(`Verification result:`, verificationResult)

    return NextResponse.json({
      message: "Judges synced successfully",
      results,
      verification: verificationResult,
    })
  } catch (error) {
    console.error("Error syncing judges:", error)
    return NextResponse.json({ message: "Failed to sync judges", error: String(error) }, { status: 500 })
  }
}
