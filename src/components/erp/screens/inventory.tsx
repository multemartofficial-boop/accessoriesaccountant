import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DataTable,
  Field,
  MetricStrip,
  PageHeader,
  Panel,
  TabsBar,
  type TableRowData,
} from "../ui";
import { api } from "@/lib/api";
import {
  EntitySelect,
  fmtDate,
  money,
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
  const [tab, setTab] = useState("Stock overview");
  const [selected, setSelected] = useState<StockRow | null>(null);
  const { data: stock } = useData<StockRow[]>(["stock"], "/inventory/stock");
  const { data: movements } = useData<Movement[]>(["movements"], "/inventory/movements");
  const { data: lowStock } = useData<LowStockProduct[]>(["low-stock"], "/inventory/low-stock");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");
  const { data: warehouses } = useData<{ id: number; name: string }[]>(
    ["warehouses"],
    "/warehouses",
  );

  const stockValue = (stock ?? []).reduce(
    (s, b) => s + num(b.quantity) * num(b.product.purchasePrice),
    0,
  );
  const today = new Date().toDateString();
  const todayMoves = (movements ?? []).filter(
    (m) => new Date(m.createdAt).toDateString() === today,
  );
  const whSet = new Set((stock ?? []).map((s) => s.warehouse.id));

  const stockRows = (stock ?? []).map((b) => ({
    sku: b.product.sku,
    product: b.product.name,
    category: b.product.category.name,
    warehouse: b.warehouse.name,
    available: `${num(b.quantity).toLocaleString()} ${b.product.unit.code.toLowerCase()}`,
    reserved: num(b.reserved).toLocaleString(),
    status: statusLabel(b.status),
  }));

  const moveRows = (movements ?? []).map((m) => ({
    date: fmtDate(m.createdAt),
    product: m.product.name,
    type: statusLabel(m.type),
    qty: `${num(m.quantity) > 0 ? "+" : ""}${num(m.quantity).toLocaleString()}`,
    warehouse: m.warehouse.name,
    ref: m.refNo ?? m.reason ?? "—",
    after: m.qtyAfter != null ? num(m.qtyAfter).toLocaleString() : "—",
  }));

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
      <MetricStrip
        items={[
          {
            label: "Stock value",
            value: money(stockValue),
            detail: `Across ${whSet.size} warehouses`,
          },
          {
            label: "Available SKUs",
            value: String(stock?.length ?? 0),
            detail: "Active stock lines",
          },
          {
            label: "Low stock",
            value: String(lowStock?.length ?? 0),
            detail: "Requires action",
            tone: "down",
          },
          {
            label: "Today's movements",
            value: String(todayMoves.length),
            detail: `${todayMoves.filter((m) => num(m.quantity) > 0).length} in · ${todayMoves.filter((m) => num(m.quantity) < 0).length} out`,
          },
        ]}
      />
      <Panel title="Product stock detail" subtitle="Warehouse and transaction-level visibility">
        <TabsBar
          tabs={[
            "Stock overview",
            "Stock in / out",
            "Manual adjustment",
            "Low-stock alert",
            "Movement history",
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === "Manual adjustment" ? (
          <AdjustmentForm
            products={products ?? []}
            warehouses={warehouses ?? []}
            onDone={() => setTab("Movement history")}
          />
        ) : tab === "Stock overview" ? (
          <div className="bg-workspace/40 p-4">
            <div className="grid gap-4 xl:grid-cols-[310px_1fr]">
              <div className="rounded-lg border bg-card shadow-card">
                <div className="border-b p-4">
                  <h3 className="text-[13px] font-semibold">Products</h3>
                  <p className="text-[11px] text-muted-foreground">Choose a SKU to inspect stock</p>
                </div>
                {(stock ?? []).map((row) => (
                  <button
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className={`block w-full border-b p-3 text-left transition-colors last:border-0 ${
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
                {sel && (
                  <div className="mb-4 rounded-lg border bg-card p-5 shadow-card">
                    <div className="flex justify-between">
                      <div>
                        <div className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                          {sel.product.sku}
                        </div>
                        <div className="mt-1 text-lg font-bold">{sel.product.name}</div>
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
                )}
                <DataTable
                  searchable={false}
                  columns={[
                    { key: "date", label: "Date" },
                    { key: "type", label: "Type" },
                    { key: "qty", label: "Qty", align: "right" },
                    { key: "ref", label: "Reference" },
                    { key: "after", label: "After", align: "right" },
                  ]}
                  rows={selMoves.map((m) => ({
                    date: fmtDate(m.createdAt),
                    type: statusLabel(m.type),
                    qty: `${num(m.quantity) > 0 ? "+" : ""}${num(m.quantity).toLocaleString()}`,
                    ref: m.refNo ?? "—",
                    after: m.qtyAfter != null ? num(m.qtyAfter).toLocaleString() : "—",
                  }))}
                />
              </div>
            </div>
          </div>
        ) : tab === "Low-stock alert" ? (
          <DataTable
            columns={[
              { key: "sku", label: "SKU" },
              { key: "product", label: "Product" },
              { key: "stock", label: "Current", align: "right" },
              { key: "min", label: "Minimum", align: "right" },
              { key: "gap", label: "Gap", align: "right" },
            ]}
            rows={(lowStock ?? []).map((p) => ({
              sku: p.sku,
              product: p.name,
              stock: num(p.totalStock).toLocaleString(),
              min: num(p.minStock).toLocaleString(),
              gap: num(p.minStock) - num(p.totalStock),
            }))}
          />
        ) : (
          <DataTable
            columns={[
              { key: "date", label: "Date" },
              { key: "product", label: "Product" },
              { key: "type", label: "Type" },
              { key: "qty", label: "Qty", align: "right" },
              { key: "warehouse", label: "Warehouse" },
              { key: "ref", label: "Reference" },
              { key: "after", label: "After", align: "right" },
            ]}
            rows={moveRows}
          />
        )}
      </Panel>
    </>
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
