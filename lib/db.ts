import { query } from "./db_config"

// Update the createCompetition function to accept isActive parameter
export async function createCompetition(name: string, filename: string, createdBy: number, isActive = false) {
  const result = await query("INSERT INTO competitions (name, filename, created_by, is_active) VALUES (?, ?, ?, ?)", [
    name,
    filename,
    createdBy,
    isActive,
  ])
  return result
}

