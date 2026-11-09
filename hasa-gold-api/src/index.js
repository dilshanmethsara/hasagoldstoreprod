import { createApp } from "./app.js";
import { getAdminAuth } from "./firebase.js";

const port = Number.parseInt(process.env.PORT || "3000", 10);
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}
if (process.env.NODE_ENV === "production" && !process.env.API_ALLOWED_ORIGINS?.trim()) {
  throw new Error("Set API_ALLOWED_ORIGINS before starting the production API.");
}

// Fail at startup rather than silently serving an API that cannot authenticate
// users. Firebase Authentication is kept; Firestore is no longer used by this API.
getAdminAuth();

const app = createApp();
const server = app.listen(port, "127.0.0.1", () => {
  console.log(`HASA GOLD API listening on 127.0.0.1:${port}`);
});

function shutdown(signal) {
  console.log(`${signal} received; closing the API server.`);
  server.close((error) => {
    if (error) {
      console.error("Could not close the API server cleanly:", error);
      process.exitCode = 1;
    }
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
