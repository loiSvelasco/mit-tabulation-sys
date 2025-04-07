import { initDatabase } from "./db_config"

// Initialize the database when this module is imported
initDatabase()
  .then(() => console.log("Database initialized successfully"))
  .catch((error) => console.error("Failed to initialize database:", error))

