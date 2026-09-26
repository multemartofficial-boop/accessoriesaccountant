import { useState } from "react";
import { AlertTriangle, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, PageHeader, Panel, TabsBar } from "../ui";
import { api } from "@/lib/api";
import {
  EntitySelect,
  fmtDate,
  num,
  statusLabel,
  useData,
  useSave,
  type ProductLite,
} from "./shared";

interface StockRow {
  id: number;
  productId: number;
  quantity: string;
  reserved: string;
  status: string;
  product: {
    id: number;
    sku: string;
    name: string;
    minStock: string;
    purchasePrice: string;
    unit: { name: string; code: string };
    category: { name: string };
  };
  warehouse: { id: number; name: string };
}

interface Movement {
  id: number;
  createdAt: string;
  type: string;
  quantity: string;
  qtyAfter?: string;
  refNo?: string;
  reason?: string;
  product: { name: string; sku: string };
  warehouse: { name: string };
}

interface LowStockProduct {
  id: number;
  sku: string;
  name: string;
  minStock: string;
  totalStock: string;
  unit: { code: string };
  balances: { warehouse: { name: string }; quantity: string }[];
}

export function InventoryScreen() {
  const [tab, setTab] = useState("Stock levels");
  const [selected, setSelected] = useState<StockRow | null>(null);
  const { data: stock } = useData<StockRow[]>(["stock"], "/inventory/stock");
  const { data: movements } = useData<Movement[]>(["movements"], "/inventory/movements");
  const { data: lowStock } = useData<LowStockProduct[]>(["low-stock"], "/inventory/low-stock");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");
  const { data: warehouses } = useData<{ id: number; name: string }[]>(
    ["warehouses"],
    "/warehouses",
  );

  const totalSkus = new Set((stock ?? []).map((s) => s.productId)).size;
  const totalWarehouses = new Set((stock ?? []).map((s) => s.warehouse.id)).size;

  const sel = selected ?? (stock ?? [])[0] ?? null;
  const selMoves = (movements ?? []).filter((m) => sel && m.product.sku === sel.product.sku);

  return (
    <>
      <PageHeader
        eyebrow="Inventory control"
        title="Inventory"
        description="Live stock position, movement traceability and replenishment alerts."
        action="Stock adjustment"
        onAction={() => setTab("Manual adjustment")}
      />
      <Panel
        title="Stock levels"
        subtitle="Current position, replenishment alerts and movement history"
        action={
          <div className="flex items-center gap-4">
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums">{totalSkus}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                SKUs
              </div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold tabular-nums">{totalWarehouses}</div>
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Warehouses
              </div>
            </div>
          </div>
        }
      >
        <LowStockWarning lowStock={lowStock ?? []} />
        <TabsBar
          tabs={["Stock levels", "Movement history", "Manual adjustment"]}
          active={tab}
          onChange={setTab}
        />
        {tab === "Manual adjustment" ? (
          <AdjustmentForm
            products={products ?? []}
            warehouses={warehouses ?? []}
            onDone={() => setTab("Movement history")}
          />
        ) : tab === "Stock levels" ? (
          <div className="bg-workspace/40 p-4">
            <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
              <div className="rounded-lg border bg-card shadow-card">
                <div className="border-b p-3">
                  <h3 className="text-[13px] font-semibold">Products</h3>
                  <p className="text-[11px] text-muted-foreground">Choose a SKU to inspect stock</p>
                </div>
                {(stock ?? []).map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className={`block w-full border-b p-2.5 text-left transition-colors last:border-0 ${
                      sel?.id === row.id
                        ? "border-l-2 border-l-primary bg-accent"
                        : "hover:bg-muted"
                    }`}
                  >
                    <div className="text-[13px] font-semibold">{row.product.name}</div>
                    <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                      <span>{row.product.sku}</span>
                      <span>
                        {num(row.quantity).toLocaleString()} · {row.warehouse.name}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
              <div>
                {sel ? (
                  <>
                    <div className="mb-4 rounded-lg border bg-card p-5 shadow-card">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                            {sel.product.sku}
                          </div>
                          <div className="mt-1 text-lg font-bold">{sel.product.name}</div>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {sel.product.category.name}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold tabular-nums">
                            {num(sel.quantity).toLocaleString()}
                          </div>
                          <div className="text-[11px] text-muted-foreground">
                            {sel.product.unit.name} · {sel.warehouse.name}
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-5 shadow-card">
                      <h3 className="mb-4 text-[13px] font-semibold">Movement timeline</h3>
                      <MovementTimeline movements={selMoves} />
                    </div>
                  </>
                ) : (
                  <div className="rounded-lg border bg-card p-8 text-center text-sm text-muted-foreground shadow-card">
                    No stock records available.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-workspace/40 p-4">
            <div className="rounded-lg border bg-card p-5 shadow-card">
              <h3 className="mb-4 text-[13px] font-semibold">All movement history</h3>
              <MovementTimeline movements={movements ?? []} />
            </div>
          </div>
        )}
      </Panel>
    </>
  );
}

function LowStockWarning({ lowStock }: { lowStock: LowStockProduct[] }) {
  return (
    <div className="m-4 rounded-lg border border-warning/25 bg-warning-soft p-4">
      <div className="mb-2 flex items-center gap-2">
        <AlertTriangle className="size-5 text-warning" />
        <h3 className="text-sm font-bold text-warning">Low-stock warning</h3>
      </div>
      {lowStock.length === 0 ? (
        <p className="text-sm text-muted-foreground">All stock levels healthy</p>
      ) : (
        <div className="divide-y">
          {lowStock.map((p) => {
            const current = num(p.totalStock);
            const min = num(p.minStock);
            const gap = min - current;
            const critical = current === 0;
            return (
              <div key={p.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <div className="min-w-0">
                  <div className="font-semibold">{p.sku}</div>
                  <div className="truncate text-xs text-muted-foreground">{p.name}</div>
                </div>
                <div className="flex items-center gap-3 text-xs tabular-nums">
                  <span>
                    {current.toLocaleString()}{" "}
                    <span className="text-muted-foreground">{p.unit.code}</span>
                  </span>
                  <span className="text-muted-foreground">min {min.toLocaleString()}</span>
                  <span className="font-semibold text-destructive">−{gap.toLocaleString()}</span>
                  <Badge
                    variant="outline"
                    className={
                      critical
                        ? "rounded-full px-2 py-0 text-[11px] font-semibold bg-destructive-soft text-destructive border-destructive/20"
                        : "rounded-full px-2 py-0 text-[11px] font-semibold bg-warning-soft text-warning border-warning/25"
                    }
                  >
                    {critical ? statusLabel("out of stock") : statusLabel("low stock")}
                  </Badge>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function MovementTimeline({ movements }: { movements: Movement[] }) {
  if (movements.length === 0) {
    return <p className="text-sm text-muted-foreground">No movements recorded.</p>;
  }

  return (
    <div>
      {movements.map((m, i) => {
        const incoming = num(m.quantity) > 0;
        const sign = incoming ? "+" : "−";
        const qty = Math.abs(num(m.quantity));
        const label = statusLabel(m.type) || (incoming ? "Incoming" : "Outgoing");
        return (
          <div key={m.id} className="flex gap-4 pb-6 last:pb-0">
            <div className="relative flex w-3 flex-col items-center">
              <div
                className={
                  incoming
                    ? "z-10 h-3 w-3 rounded-full border-2 border-background bg-success"
                    : "z-10 h-3 w-3 rounded-full border-2 border-background bg-destructive"
                }
              />
              {i !== movements.length - 1 && <div className="mt-1 h-full w-px bg-border" />}
            </div>
            <div className="-mt-0.5 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-muted-foreground">
                  {fmtDate(m.createdAt)}
                </span>
                <Badge
                  variant="outline"
                  className={
                    incoming
                      ? "rounded-full px-2 py-0 text-[11px] font-semibold bg-success-soft text-success border-success/25"
                      : "rounded-full px-2 py-0 text-[11px] font-semibold bg-destructive-soft text-destructive border-destructive/20"
                  }
                >
                  {label}
                </Badge>
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="text-base font-bold tabular-nums">
                  {sign}
                  {qty.toLocaleString()}
                </span>
                <span className="text-xs text-muted-foreground">
                  {m.product.name} · {m.warehouse.name}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-2 text-xs">
                <span className="truncate text-muted-foreground">
                  Ref: {m.refNo ?? m.reason ?? "—"}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  Balance: {m.qtyAfter != null ? num(m.qtyAfter).toLocaleString() : "—"}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AdjustmentForm({
  products,
  warehouses,
  onDone,
}: {
  products: ProductLite[];
  warehouses: { id: number; name: string }[];
  onDone: () => void;
}) {
  const save = useSave();
  const [productId, setProductId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        const sign = v["Adjustment type"] === "Stock out" ? -1 : 1;
        save(
          api.post("/inventory/adjustments", {
            productId,
            warehouseId,
            quantity: sign * Number(v["Quantity"]),
            unitCost: Number(v["Unit cost"] || 0),
            reason: v["Reason"],
            reference: v["Reference"],
          }),
          "Adjustment submitted",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold">Manual stock adjustment</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EntitySelect
            label="Product / SKU"
            value={productId}
            onChange={setProductId}
            options={products.map((p) => ({ id: p.id, name: `${p.name} · ${p.sku}` }))}
          />
          <EntitySelect
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses}
          />
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>
              Adjustment type<span className="ml-0.5 text-destructive">*</span>
            </span>
            <select
              name="Adjustment type"
              required
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
            >
              <option>Stock in</option>
              <option>Stock out</option>
            </select>
          </label>
          <Field label="Quantity" name="Quantity" type="number" required />
          <Field label="Unit cost" name="Unit cost" type="number" />
          <Field label="Reference" name="Reference" />
          <Field label="Reason" name="Reason" required />
        </div>
        <div className="mobile-action-bar mt-5 flex justify-end gap-2">
          <Button type="reset" variant="outline" size="sm">
            Reset
          </Button>
          <Button type="submit" size="sm" disabled={!productId || !warehouseId}>
            <Save />
            Save record
          </Button>
        </div>
      </div>
    </form>
  );
}
