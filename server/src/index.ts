import { env } from "./env";
import { prisma } from "./db";
import { createApp } from "./app";

async function main() {
  // Verify connectivity before accepting traffic. The remote DB can briefly
  // refuse connections (transient drops / hourly-cap window), so retry a few
  // times instead of dying on the first failure.
  let lastError: unknown;
  for (let attempt = 1; attempt <= 5; attempt++) {
    try {
      await prisma.$queryRaw`SELECT 1`;
      lastError = undefined;
      break;
    } catch (err) {
      lastError = err;
      console.log(`DB connect attempt ${attempt}/5 failed — retrying in 5s`);
      await new Promise((r) => setTimeout(r, 5_000));
    }
  }
  if (lastError) throw lastError;
  console.log("Database connected");

  const app = createApp();
  app.listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
}

main().catch((err) => {
  console.error("Startup failed:", err.message);
  if (/ssl/i.test(String(err.message))) {
    console.error("Hint: set DB_SSL=true in .env and retry.");
  }
  process.exit(1);
});
