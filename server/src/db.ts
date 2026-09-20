import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client";
import { env } from "./env";

// Remote Hostinger MySQL — pooled, with timeouts so dropped connections
// get recycled instead of hanging requests.
const adapter = new PrismaMariaDb({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  connectionLimit: 10,
  connectTimeout: 15000,
  ...(env.dbSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const prisma = new PrismaClient({ adapter });

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Remote DB roundtrips make the default 5s interactive-tx timeout too tight.
export function withTx<T>(fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(fn, { timeout: 60_000, maxWait: 30_000 });
}
