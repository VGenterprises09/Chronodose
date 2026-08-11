import { createApp } from "./app.js";

const PORT = Number(process.env.PORT) || 3001;
createApp().listen(PORT, () => console.log(`ChronoDose API listening on http://localhost:${PORT}`));

process.on("unhandledRejection", (e) => console.error("[proc] unhandled rejection:", e));
process.on("uncaughtException", (e) => console.error("[proc] uncaught exception:", e));
