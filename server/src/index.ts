import { env } from "./env";
import { prisma } from "./db";
import { createApp } from "./app";

async function main() {
  // Verify connectivity before accepting traffic.
  await prisma.$queryRaw`SELECT 1`;
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
