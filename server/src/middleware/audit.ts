import type { Request } from "express";
import { prisma, type Tx } from "../db";

interface AuditInput {
  action: "CREATE" | "UPDATE" | "DELETE" | "APPROVE" | "DECLINE" | "LOGIN";
  module: string;
  recordId?: string | number;
  before?: unknown;
  after?: unknown;
  req?: Request;
}

// Writes to the audit trail. Pass a transaction client to keep the log
// atomic with the change it describes.
export async function logAudit(input: AuditInput, tx?: Tx) {
  const client = tx ?? prisma;
  await client.auditLog.create({
    data: {
      userId: input.req?.user?.id ?? null,
      action: input.action,
      module: input.module,
      recordId: input.recordId != null ? String(input.recordId) : null,
      before: input.before === undefined ? undefined : (input.before as object),
      after: input.after === undefined ? undefined : (input.after as object),
      ipAddress: input.req?.ip ?? null,
    },
  });
}
