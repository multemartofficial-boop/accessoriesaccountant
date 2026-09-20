// Vercel serverless entry: wraps the Express app so the whole API runs as a
// single function. Requests to /api/* are routed here by vercel.json rewrites.
import { createApp } from "../src/app";

export const maxDuration = 60; // remote DB transactions can be slow

const app = createApp();
export default app;
