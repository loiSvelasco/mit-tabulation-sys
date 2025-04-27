import { EventEmitter } from "events"

// Create a global event emitter instance
export const globalEventEmitter = new EventEmitter()

// Set a higher limit for event listeners to avoid warnings
globalEventEmitter.setMaxListeners(50)

// Event types
export const SCORE_UPDATED = "score-updated"
export const SCORES_DELETED = "scores-deleted"

// Debug logging for events
if (process.env.NODE_ENV === "development") {
  const originalEmit = globalEventEmitter.emit
  globalEventEmitter.emit = function (event, ...args) {
    // console.log(`[EventEmitter] Emitting event: ${event}`, args[0] || {})
    return originalEmit.apply(this, [event, ...args])
  }
}
