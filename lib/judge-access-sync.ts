import { query } from "@/lib/db_config"
import useCompetitionStore from "@/utils/useCompetitionStore"

export async function syncJudgeAccessCodes(competitionId: number) {
  try {
    // Get judges from the store
    const { judges } = useCompetitionStore.getState()

    // For each judge in the store
    for (const judge of judges) {
      // Check if this judge already has an entry in the database
      const existingRecord = await query(
        `
        SELECT id FROM judge_competition_access
        WHERE judge_id = ? AND competition_id = ?
        `,
        [judge.id, competitionId],
      )

      if (existingRecord.length > 0) {
        // Update existing record
        await query(
          `
          UPDATE judge_competition_access
          SET access_code = ?, is_active = TRUE
          WHERE judge_id = ? AND competition_id = ?
          `,
          [judge.accessCode, judge.id, competitionId],
        )
      } else {
        // Insert new record
        await query(
          `
          INSERT INTO judge_competition_access
          (judge_id, competition_id, access_code, is_active)
          VALUES (?, ?, ?, TRUE)
          `,
          [judge.id, competitionId, judge.accessCode],
        )
      }
    }

    return { success: true }
  } catch (error) {
    console.error("Error syncing judge access codes:", error)
    return { success: false, error }
  }
}
