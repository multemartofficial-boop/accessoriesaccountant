import path from "node:path";
import { config as loadEnv } from "dotenv";

// .env lives in the project root (one level up); server-local .env wins if present.
loadEnv({ path: path.resolve(process.cwd(), "../.env"), quiet: true });
loadEnv({ path: path.resolve(process.cwd(), ".env"), quiet: true });

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

export const env = {
  dbHost: required("DB_HOST"),
  dbPort: Number(process.env.DB_PORT ?? 3306),
  dbName: required("DB_NAME"),
  dbUser: required("DB_USER"),
  dbPassword: required("DB_PASSWORD"),
  dbSsl: process.env.DB_SSL === "true",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  port: Number(process.env.PORT ?? 5000),
};
