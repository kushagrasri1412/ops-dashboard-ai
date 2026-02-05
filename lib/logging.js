import { insertApiLog } from "./storage";

export function logApiRequest(entry) {
  try {
    insertApiLog(entry);
  } catch (error) {
    // Logging must never take down the API route.
    console.error("Failed to write API log", error);
  }
}
