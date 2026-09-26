import { Router } from "express";
import { prisma } from "../db";
import { asyncHandler } from "../middleware/error";
import { requireRole } from "../middleware/auth";
import { runIntegrityChecks } from "../services/integrity";
import { resyncSequences } from "../../prisma/resync-sequences";

export const systemRouter = Router();

// Cross-checks maintained balances (cash, stock, ledgers, invoice paid,
// journal balance) against transaction history. Admin-only.
systemRouter.get(
  "/integrity",
  requireRole("ADMIN", "MANAGER"),
  asyncHandler(async (_req, res) => {
    res.json(await runIntegrityChecks(prisma));
  }),
);

systemRouter.post(
  "/resync-sequences",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    await resyncSequences();
    res.json({ ok: true });
  }),
);

// Full JSON export of every table — downloaded from Settings → Backup & export.
systemRouter.get(
  "/backup",
  requireRole("ADMIN"),
  asyncHandler(async (_req, res) => {
    const [
      company, settings, sequences, users, accounts,
      units, taxRates, categories, warehouses, cashAccounts,
      buyers, buyerLedger, suppliers, supplierLedger, products,
      purchaseOrders, purchaseInvoices, supplierPayments,
      salesOrders, deliveryChalans, salesInvoices, salesReturns, collections,
      stockBalances, stockMovements, stockAdjustments, stockTransfers,
      cashTransactions, journalEntries, journalLines, approvalRequests, auditLogs,
    ] = await Promise.all([
      prisma.companyProfile.findFirst(),
      prisma.setting.findMany(),
      prisma.documentSequence.findMany(),
      prisma.user.findMany({ select: { id: true, name: true, email: true, role: true, location: true, status: true, createdAt: true } }),
      prisma.account.findMany(),
      prisma.unit.findMany(),
      prisma.taxRate.findMany(),
      prisma.category.findMany(),
      prisma.warehouse.findMany(),
      prisma.cashAccount.findMany(),
      prisma.buyer.findMany(),
      prisma.buyerLedgerEntry.findMany(),
      prisma.supplier.findMany(),
      prisma.supplierLedgerEntry.findMany(),
      prisma.product.findMany(),
      prisma.purchaseOrder.findMany({ include: { items: true } }),
      prisma.purchaseInvoice.findMany({ include: { items: true } }),
      prisma.supplierPayment.findMany(),
      prisma.salesOrder.findMany({ include: { items: true } }),
      prisma.deliveryChalan.findMany({ include: { items: true } }),
      prisma.salesInvoice.findMany({ include: { items: true } }),
      prisma.salesReturn.findMany({ include: { items: true } }),
      prisma.paymentCollection.findMany(),
      prisma.stockBalance.findMany(),
      prisma.stockMovement.findMany(),
      prisma.stockAdjustment.findMany(),
      prisma.stockTransfer.findMany(),
      prisma.cashTransaction.findMany(),
      prisma.journalEntry.findMany(),
      prisma.journalLine.findMany(),
      prisma.approvalRequest.findMany(),
      prisma.auditLog.findMany(),
    ]);
    const payload = {
      exportedAt: new Date().toISOString(),
      company, settings, sequences, users, accounts,
      units, taxRates, categories, warehouses, cashAccounts,
      buyers, buyerLedger, suppliers, supplierLedger, products,
      purchaseOrders, purchaseInvoices, supplierPayments,
      salesOrders, deliveryChalans, salesInvoices, salesReturns, collections,
      stockBalances, stockMovements, stockAdjustments, stockTransfers,
      cashTransactions, journalEntries, journalLines, approvalRequests, auditLogs,
    };
    res.setHeader("content-type", "application/json");
    res.setHeader(
      "content-disposition",
      `attachment; filename="garmenttrade-backup-${new Date().toISOString().slice(0, 10)}.json"`,
    );
    res.send(JSON.stringify(payload, null, 2));
  }),
);
