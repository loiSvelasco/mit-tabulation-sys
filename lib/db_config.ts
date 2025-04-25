import mysql from "mysql2/promise"

// Create a connection pool using environment variables
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST,
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PASSWORD,
  database: process.env.MYSQL_DATABASE,
  port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306, // Ensure port is a number
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Add connection timeout and retry settings for better reliability in serverless
  connectTimeout: 10000, // 10 seconds
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000, // 10 seconds
})

// Helper function to execute SQL queries with improved error handling
export async function query(sql: string, params: any[] = []) {
  try {
    // console.log(`Executing query: ${sql.substring(0, 100)}${sql.length > 100 ? "..." : ""}`)

    // Add retry logic for transient connection issues
    let retries = 3
    let lastError

    while (retries > 0) {
      try {
        const [results] = await pool.execute(sql, params)
        return results as any[]
      } catch (error: any) {
        lastError = error

        // Only retry on connection errors, not on SQL errors
        if (error.code && ["ECONNREFUSED", "ETIMEDOUT", "PROTOCOL_CONNECTION_LOST"].includes(error.code)) {
          console.warn(`Database connection error (${error.code}), retrying... (${retries} attempts left)`)
          retries--
          // Wait before retrying
          await new Promise((resolve) => setTimeout(resolve, 1000))
        } else {
          // SQL error or other non-connection error, don't retry
          throw error
        }
      }
    }

    // If we've exhausted retries
    console.error("Database query failed after retries:", lastError)
    throw lastError
  } catch (error) {
    console.error("Database query error:", error)
    throw error
  }
}

// Helper function to get a single row
export async function getRow(sql: string, params: any[] = []) {
  const results = await query(sql, params)
  return Array.isArray(results) && results.length > 0 ? results[0] : null
}

// Helper function to check if a table exists
export async function tableExists(tableName: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT COUNT(*) as count FROM information_schema.tables 
       WHERE table_schema = ? AND table_name = ?`,
      [process.env.MYSQL_DATABASE, tableName],
    )

    return Array.isArray(result) && result[0] && result[0].count > 0
  } catch (error) {
    console.error("Error checking if table exists:", error)
    return false
  }
}

// Helper function to check database connection
export async function checkConnection(): Promise<boolean> {
  try {
    await pool.execute("SELECT 1")
    return true
  } catch (error) {
    console.error("Database connection check failed:", error)
    return false
  }
}

// Export the pool for direct access if needed
export { pool }
