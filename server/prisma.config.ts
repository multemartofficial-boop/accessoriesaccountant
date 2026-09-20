import path from "node:path";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// .env lives in the project root, one level above /server.
loadEnv({ path: path.resolve(process.cwd(), "../.env"), quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

// Build the connection URL from discrete vars — credentials are
// URL-encoded so special characters (@, #, etc.) in the password are safe.
const { DB_HOST, DB_PORT = "3306", DB_NAME, DB_USER, DB_PASSWORD, DB_SSL } = process.env;
const auth = `${encodeURIComponent(DB_USER ?? "")}:${encodeURIComponent(DB_PASSWORD ?? "")}`;
const url = `mysql://${auth}@${DB_HOST}:${DB_PORT}/${DB_NAME}${DB_SSL === "true" ? "?sslaccept=accept_invalid_certs" : ""}`;

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "tsx prisma/seed.ts",
  },
  datasource: { url },
});
