import { useState } from "react";
import { ArrowRight, MapPin, Package, Pencil, Save, Truck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionDialog, Field, PageHeader, Panel, TabsBar } from "../ui";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  EntitySelect,
  fmtDate,
  money,
  num,
  statusLabel,
  useActionDialog,
  useData,
  useSave,
  type ProductLite,
} from "./shared";

interface Warehouse {
  id: number;
  code: string;
  name: string;
  location?: string;
  manager?: string;
  status: string;
  _count?: { stockBalances: number };
}

interface Transfer {
  id: number;
  transferNo: string;
  quantity: string;
  transferDate: string;
  status: string;
  product: { name: string; sku: string };
  fromWarehouse: { name: string };
  toWarehouse: { name: string };
}

interface StockRow {
  id: number;
  quantity: string;
  reserved: string;
  status: string;
  product: { sku: string; name: string; unit: { code: string } };
  warehouse: { name: string };
}

function statusTone(value: string) {
  const v = value.toLowerCase();
  if (
    ["paid", "approved", "active", "received", "completed", "in stock"].some((s) => v.includes(s))
  )
    return "border-success/25 bg-success-soft text-success";
  if (["pending", "partial", "low", "review", "awaiting"].some((s) => v.includes(s)))
    return "border-warning/25 bg-warning-soft text-warning";
  if (["overdue", "declined", "cancelled", "out of stock"].some((s) => v.includes(s)))
    return "border-destructive/20 bg-destructive-soft text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

function StatusBadge({ status }: { status: string }) {
  const label = statusLabel(status);
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-none",
        statusTone(label),
      )}
    >
      {label}
    </Badge>
  );
}

export function WarehousesScreen() {
  const [tab, setTab] = useState("Warehouse stock");
  const [selectedWarehouse, setSelectedWarehouse] = useState<number | "all">("all");
  const dialog = useActionDialog();
  const save = useSave();
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const { data: warehouses } = useData<Warehouse[]>(["warehouses"], "/warehouses");
  const { data: stock } = useData<StockRow[]>(["stock"], "/inventory/stock");
  const { data: transfers } = useData<Transfer[]>(["transfers"], "/warehouses/transfers/list");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");

  const selectedName =
    selectedWarehouse === "all"
      ? null
      : (warehouses ?? []).find((w) => w.id === selectedWarehouse)?.name;

  const filteredStock = (stock ?? []).filter(
    (s) => selectedWarehouse === "all" || s.warehouse.name === selectedName,
  );

  const openTransfers = (transfers ?? []).filter(
    (t) => t.status === "PENDING" || t.status === "APPROVED",
  );

  return (
    <>
      <PageHeader
        eyebrow="Locations"
        title="Multi-warehouse"
        description="Track storage locations, warehouse-level stock and internal transfers."
        action="Add warehouse"
        onAction={() => {
          setEditing(null);
          dialog.create();
        }}
      />

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <button
          type="button"
          onClick={() => {
            setSelectedWarehouse("all");
            setTab("Warehouse stock");
          }}
          className={cn(
            "rounded-lg border bg-card p-4 text-left shadow-card transition hover:bg-accent/55",
            selectedWarehouse === "all" && "border-primary ring-2 ring-primary",
          )}
        >
          <div className="text-sm font-semibold">All warehouses</div>
          <div className="text-xs text-muted-foreground">{(warehouses ?? []).length} locations</div>
        </button>
        {(warehouses ?? []).map((w) => (
          <button
            key={w.id}
            type="button"
            onClick={() => {
              setSelectedWarehouse(w.id);
              setTab("Warehouse stock");
            }}
            className={cn(
              "rounded-lg border bg-card p-4 text-left shadow-card transition hover:bg-accent/55",
              selectedWarehouse === w.id && "border-primary ring-2 ring-primary",
            )}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{w.name}</div>
                <div className="text-xs text-muted-foreground">{w.code}</div>
              </div>
              <StatusBadge status={w.status} />
            </div>
            <div className="mt-3 space-y-1 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <MapPin className="size-3.5 shrink-0" />
                <span className="truncate">{w.location ?? "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <User className="size-3.5 shrink-0" />
                <span className="truncate">{w.manager ?? "—"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Package className="size-3.5 shrink-0" />
                <span>{w._count?.stockBalances ?? 0} SKUs</span>
              </div>
            </div>
          </button>
        ))}
      </div>

      <Panel title="Warehouse operations">
        <TabsBar
          tabs={["Warehouse stock", "Warehouse list", "Stock transfer"]}
          active={tab}
          onChange={setTab}
        />

        {tab === "Warehouse stock" && (
          <div className="p-3">
            <div className="mb-3 text-xs font-medium text-muted-foreground">
              {selectedWarehouse === "all"
                ? "Showing stock across all warehouses."
                : `Showing stock for ${selectedName}. Click another warehouse card above to filter.`}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-sm">
                <thead>
                  <tr className="border-b bg-table-head text-muted-foreground">
                    <th className="h-9 px-3 text-left text-[11px] font-bold uppercase tracking-[0.08em]">
                      SKU
                    </th>
                    <th className="h-9 px-3 text-left text-[11px] font-bold uppercase tracking-[0.08em]">
                      Product
                    </th>
                    <th className="h-9 px-3 text-right text-[11px] font-bold uppercase tracking-[0.08em]">
                      Available
                    </th>
                    <th className="h-9 px-3 text-right text-[11px] font-bold uppercase tracking-[0.08em]">
                      Reserved
                    </th>
                    <th className="h-9 px-3 text-left text-[11px] font-bold uppercase tracking-[0.08em]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStock.map((b) => (
                    <tr
                      key={b.id}
                      className="border-b last:border-b-0 transition-colors hover:bg-accent/55"
                    >
                      <td className="h-10 whitespace-nowrap px-3 font-medium">{b.product.sku}</td>
                      <td className="h-10 px-3">{b.product.name}</td>
                      <td className="h-10 whitespace-nowrap px-3 text-right tabular-nums font-semibold">
                        {num(b.quantity).toLocaleString()} {b.product.unit?.code ?? ""}
                      </td>
                      <td className="h-10 whitespace-nowrap px-3 text-right tabular-nums">
                        {num(b.reserved).toLocaleString()}
                      </td>
                      <td className="h-10 px-3">
                        <StatusBadge status={b.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {filteredStock.length === 0 && (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                No stock records match the selected warehouse.
              </div>
            )}
          </div>
        )}

        {tab === "Warehouse list" && (
          <div className="grid gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {(warehouses ?? []).map((w) => (
              <div key={w.id} className="relative rounded-lg border bg-card p-4 shadow-card">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold">{w.name}</div>
                    <div className="text-xs text-muted-foreground">{w.code}</div>
                  </div>
                  <StatusBadge status={w.status} />
                </div>
                <div className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="size-3.5 shrink-0" />
                    <span className="truncate">{w.location ?? "—"}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <User className="size-3.5 shrink-0" />
                    <span className="truncate">{w.manager ?? "—"}</span>
                  </div>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setEditing(w);
                      dialog.setOpen(true);
                    }}
                  >
                    <Pencil className="mr-1 size-3.5" />
                    Edit
                  </Button>
                </div>
              </div>
            ))}
            {(warehouses ?? []).length === 0 && (
              <div className="col-span-full py-12 text-center text-sm text-muted-foreground">
                No warehouses found.
              </div>
            )}
          </div>
        )}

        {tab === "Stock transfer" && (
          <TransferForm
            warehouses={warehouses ?? []}
            products={products ?? []}
            onDone={() => setTab("Warehouse stock")}
          />
        )}
      </Panel>

      {tab === "Stock transfer" && (
        <div className="mt-5">
          <Panel title="Open transfers" subtitle={`${openTransfers.length} open`}>
            <div className="grid gap-3 p-3">
              {openTransfers.map((t) => (
                <div
                  key={t.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3 shadow-card"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border bg-surface-subtle">
                    <Truck className="size-4 text-muted-foreground" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-muted-foreground">
                      {t.transferNo}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm">
                      <span className="font-medium">{t.fromWarehouse.name}</span>
                      <ArrowRight className="size-4 text-muted-foreground" />
                      <span className="font-medium">{t.toWarehouse.name}</span>
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {t.product.name} · {t.product.sku}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-sm font-semibold tabular-nums">
                      {num(t.quantity).toLocaleString()} pcs
                    </div>
                    <div className="mt-1">
                      <StatusBadge status={t.status} />
                    </div>
                  </div>
                </div>
              ))}
              {openTransfers.length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No open transfers.
                </div>
              )}
            </div>
          </Panel>
        </div>
      )}

      <ActionDialog
        open={dialog.open}
        onOpenChange={dialog.setOpen}
        title={`${editing ? "Edit" : "Add"} warehouse`}
        description="Maintain storage location and manager information."
        fields={[
          { label: "Name", name: "name", required: true },
          { label: "Location", name: "location" },
          { label: "Manager", name: "manager" },
        ]}
        initialValues={
          editing
            ? {
                name: editing.name,
                location: editing.location ?? "",
                manager: editing.manager ?? "",
              }
            : undefined
        }
        onSubmit={(values) =>
          save(
            editing
              ? api.put(`/warehouses/${editing.id}`, values)
              : api.post("/warehouses", values),
            "Warehouse saved",
          )
        }
      />
    </>
  );
}

function TransferForm({
  warehouses,
  products,
  onDone,
}: {
  warehouses: Warehouse[];
  products: ProductLite[];
  onDone: () => void;
}) {
  const save = useSave();
  const [from, setFrom] = useState<number | "">("");
  const [to, setTo] = useState<number | "">("");
  const [productId, setProductId] = useState<number | "">("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(
          api.post("/warehouses/transfers", {
            fromWarehouseId: from,
            toWarehouseId: to,
            productId,
            quantity: Number(v["Quantity"]),
            transferDate: v["Transfer date"],
            notes: v["Notes"],
          }),
          "Transfer submitted for approval",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <h3 className="mb-4 text-sm font-semibold">Create stock transfer</h3>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EntitySelect
            label="From warehouse"
            value={from}
            onChange={setFrom}
            options={warehouses}
          />
          <EntitySelect label="To warehouse" value={to} onChange={setTo} options={warehouses} />
          <EntitySelect
            label="Product / SKU"
            value={productId}
            onChange={setProductId}
            options={products.map((p) => ({ id: p.id, name: `${p.name} · ${p.sku}` }))}
          />
          <Field label="Quantity" name="Quantity" type="number" required />
          <Field
            label="Transfer date"
            name="Transfer date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          <Field label="Notes" name="Notes" />
        </div>
        <div className="mobile-action-bar mt-5 flex justify-end gap-2">
          <Button type="reset" variant="outline" size="sm">
            Reset
          </Button>
          <Button type="submit" size="sm" disabled={!from || !to || !productId}>
            <Save />
            Save record
          </Button>
        </div>
      </div>
    </form>
  );
}
