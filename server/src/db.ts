import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "./generated/prisma/client";
import { env } from "./env";

// Remote Hostinger MySQL. Shared hosting caps connections_per_hour (500) and
// kills idle sockets, so: small pool + one permanently warm connection.
// A new remote TCP+auth handshake takes ~1-3s — that was the login lag, and
// every churned connection counts against the hourly cap.
const adapter = new PrismaMariaDb({
  host: env.dbHost,
  port: env.dbPort,
  user: env.dbUser,
  password: env.dbPassword,
  database: env.dbName,
  connectionLimit: Number(process.env.DB_POOL_LIMIT ?? 4),
  minimumIdle: 1, // keep exactly one conn warm; extras are created on demand
  idleTimeout: 240, // seconds — safety release; the ping below fires first
  keepAliveDelay: 20_000, // ms — TCP keepalive so NAT/firewall doesn't drop warm conns
  connectTimeout: 8_000,
  acquireTimeout: 20_000, // must exceed connectTimeout or acquires die mid-connect
  ...(env.dbSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

export const prisma = new PrismaClient({ adapter });

// A real query every 30s resets MySQL wait_timeout on the warm conn, so it
// never dies of idleness — no handshake on the next request and near-zero
// connections-per-hour consumption.
setInterval(() => {
  void prisma.$queryRaw`SELECT 1`.catch(() => {});
}, 30_000).unref();

export type Tx = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

// Remote DB roundtrips make the default 5s interactive-tx timeout too tight.
export function withTx<T>(fn: (tx: Tx) => Promise<T>) {
  return prisma.$transaction(fn, { timeout: 60_000, maxWait: 30_000 });
}
