import express from "express";
import cors from "cors";
import { authenticate } from "./middleware/auth";
import { errorHandler, notFound } from "./middleware/error";
import { authRouter } from "./routes/auth";
import { buyersRouter } from "./routes/buyers";
import { suppliersRouter } from "./routes/suppliers";
import { productsRouter } from "./routes/products";
import { warehousesRouter } from "./routes/warehouses";
import { purchaseRouter } from "./routes/purchase";
import { salesRouter } from "./routes/sales";
import { inventoryRouter } from "./routes/inventory";
import { cashBankRouter } from "./routes/cashbank";
import { approvalsRouter } from "./routes/approvals";
import { auditRouter } from "./routes/audit";
import { vatRouter } from "./routes/vat";
import { dashboardRouter } from "./routes/dashboard";
import { reportsRouter } from "./routes/reports";
import { analyticsRouter } from "./routes/analytics";
import { settingsRouter } from "./routes/settings";
import { documentsRouter } from "./routes/documents";
import { systemRouter } from "./routes/system";

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => res.json({ ok: true }));
  app.use("/api/auth", authRouter);

  app.use("/api", authenticate); // everything below requires a token
  app.use("/api/buyers", buyersRouter);
  app.use("/api/suppliers", suppliersRouter);
  app.use("/api", productsRouter); // /products, /categories, /units
  app.use("/api/warehouses", warehousesRouter);
  app.use("/api/purchase", purchaseRouter);
  app.use("/api/sales", salesRouter);
  app.use("/api/inventory", inventoryRouter);
  app.use("/api/cash-bank", cashBankRouter);
  app.use("/api/approvals", approvalsRouter);
  app.use("/api/audit-log", auditRouter);
  app.use("/api/vat", vatRouter);
  app.use("/api/dashboard", dashboardRouter);
  app.use("/api/reports", reportsRouter);
  app.use("/api/analytics", analyticsRouter);
  app.use("/api/settings", settingsRouter);
  app.use("/api/documents", documentsRouter);
  app.use("/api/system", systemRouter);

  app.use(notFound);
  app.use(errorHandler);
  return app;
}
