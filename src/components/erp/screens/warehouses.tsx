import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionDialog, DataTable, Field, MetricStrip, PageHeader, Panel, TabsBar } from "../ui";
import { api } from "@/lib/api";
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

export function WarehousesScreen() {
  const [tab, setTab] = useState("Warehouse stock");
  const dialog = useActionDialog();
  const save = useSave();
  const [editing, setEditing] = useState<Warehouse | null>(null);
  const { data: warehouses } = useData<Warehouse[]>(["warehouses"], "/warehouses");
  const { data: stock } = useData<StockRow[]>(["stock"], "/inventory/stock");
  const { data: transfers } = useData<Transfer[]>(["transfers"], "/warehouses/transfers/list");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");

  const whValue = (name: string) =>
    (stock ?? []).filter((s) => s.warehouse.name === name).reduce((s, b) => s + num(b.quantity), 0);
  const inTransfer = (transfers ?? []).filter(
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
      <MetricStrip
        items={[
          { label: "Warehouses", value: String(warehouses?.length ?? 0), detail: "All locations" },
          ...(warehouses ?? []).slice(0, 2).map((w) => ({
            label: `${w.name} units`,
            value: whValue(w.name).toLocaleString(),
            detail: `${w._count?.stockBalances ?? 0} SKUs`,
          })),
          { label: "In transfer", value: String(inTransfer.length), detail: "Open transfers" },
        ].slice(0, 4)}
      />
      <Panel title="Warehouse operations">
        <TabsBar
          tabs={["Warehouse stock", "Warehouse list", "Stock transfer"]}
          active={tab}
          onChange={setTab}
        />
        {tab === "Stock transfer" ? (
          <TransferForm
            warehouses={warehouses ?? []}
            products={products ?? []}
            onDone={() => setTab("Warehouse stock")}
          />
        ) : tab === "Warehouse list" ? (
          <DataTable
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: "Warehouse" },
              { key: "manager", label: "Manager" },
              { key: "location", label: "Location" },
              { key: "skus", label: "SKUs", align: "right" },
              { key: "status", label: "Status", status: true },
            ]}
            rows={(warehouses ?? []).map((w) => ({
              id: w.id,
              code: w.code,
              name: w.name,
              manager: w.manager ?? "—",
              location: w.location ?? "—",
              skus: w._count?.stockBalances ?? 0,
              status: statusLabel(w.status),
            }))}
            onEdit={(row) => {
              setEditing(warehouses?.find((w) => w.id === Number(row["id"])) ?? null);
              dialog.setOpen(true);
            }}
          />
        ) : (
          <DataTable
            columns={[
              { key: "sku", label: "SKU" },
              { key: "product", label: "Product" },
              { key: "warehouse", label: "Warehouse" },
              { key: "available", label: "Available", align: "right" },
              { key: "reserved", label: "Reserved", align: "right" },
              { key: "status", label: "Status", status: true },
            ]}
            rows={(stock ?? []).map((b) => ({
              sku: b.product.sku,
              product: b.product.name,
              warehouse: b.warehouse.name,
              available: num(b.quantity).toLocaleString(),
              reserved: num(b.reserved).toLocaleString(),
              status: statusLabel(b.status),
            }))}
          />
        )}
      </Panel>
      {tab === "Stock transfer" && (
        <div className="mt-5">
          <Panel title="Open transfers" subtitle={`${transfers?.length ?? 0} total`}>
            <DataTable
              columns={[
                { key: "ref", label: "Transfer" },
                { key: "product", label: "Product" },
                { key: "from", label: "From" },
                { key: "to", label: "To" },
                { key: "qty", label: "Qty", align: "right" },
                { key: "status", label: "Status", status: true },
              ]}
              rows={(transfers ?? []).map((t) => ({
                ref: t.transferNo,
                product: t.product.name,
                from: t.fromWarehouse.name,
                to: t.toWarehouse.name,
                qty: num(t.quantity).toLocaleString(),
                status: statusLabel(t.status),
              }))}
            />
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
