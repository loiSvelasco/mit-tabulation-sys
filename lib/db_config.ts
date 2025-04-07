import mysql from "mysql2/promise"

// Create a connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
})

// Helper function to execute SQL queries
export async function query(sql: string, params: any[] = []) {
  try {
    const [results] = await pool.execute(sql, params)
    return results
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

// Helper function to get a single row
export async function getRow(sql: string, params: any[] = []) {
  const results = (await query(sql, params)) as any[]
  return results.length > 0 ? results[0] : null
}

// Helper function to check if a table exists
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = (await query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = ?`,
      [process.env.MYSQL_DATABASE, tableName],
    )) as any[]

    return result[0].count > 0
  } catch (error) {
    console.error("Error checking if table exists:", error)
    return false
  }
}

// Initialize database tables if they don't exist
export async function initDatabase() {
  try {
    // Check if competitions table exists
    const competitionsExists = await tableExists("competitions")

    if (!competitionsExists) {
      // Create competitions table
      await query(`
        CREATE TABLE competitions (
          id INT AUTO_INCREMENT PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          filename VARCHAR(255) NOT NULL,
          created_by INT NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          is_active BOOLEAN DEFAULT FALSE
        )
      `)

      console.log("Created competitions table")
    }

    // Check if judge_competition_access table exists
    const judgeAccessExists = await tableExists("judge_competition_access")

    if (!judgeAccessExists) {
      // Create judge_competition_access table
      await query(`
        CREATE TABLE judge_competition_access (
          id INT AUTO_INCREMENT PRIMARY KEY,
          judge_id INT NOT NULL,
          competition_id INT NOT NULL,
          access_code VARCHAR(10) NOT NULL,
          is_active BOOLEAN DEFAULT TRUE,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
      `)

      console.log("Created judge_competition_access table")
    }

    console.log("Database initialization complete")
  } catch (error) {
    console.error("Error initializing database:", error)
    throw error
  }
}

