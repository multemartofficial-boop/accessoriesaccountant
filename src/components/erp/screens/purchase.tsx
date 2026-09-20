import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, Field, MetricStrip, PageHeader, Panel, SelectField, TabsBar } from "../ui";
import { api } from "@/lib/api";
import {
  EntitySelect,
  fmtDate,
  ItemsEditor,
  money,
  num,
  statusLabel,
  useData,
  useSave,
  type LineItem,
  type ProductLite,
} from "./shared";

interface PurchaseOrder {
  id: number;
  poNo: string;
  orderDate: string;
  expectedDate?: string;
  status: string;
  approvalStatus: string;
  total: string;
  supplier: { id: number; name: string };
  items: { productId: number; quantity: string; rate: string; total: string }[];
}

interface PurchaseInvoice {
  id: number;
  invNo: string;
  invoiceDate: string;
  status: string;
  total: string;
  supplier: { name: string };
}

interface SupplierPayment {
  id: number;
  paymentNo: string;
  date: string;
  amount: string;
  method?: string;
  supplier: { name: string };
  account: { name: string };
}

interface Named {
  id: number;
  name: string;
  payable?: string;
  outstanding?: string;
  type?: string;
}

export function PurchaseScreen() {
  const [tab, setTab] = useState("Purchase orders");
  const save = useSave();
  const { data: orders } = useData<PurchaseOrder[]>(["purchase-orders"], "/purchase/orders");
  const { data: pending } = useData<PurchaseOrder[]>(
    ["purchase-pending"],
    "/purchase/orders/pending",
  );
  const { data: invoices } = useData<PurchaseInvoice[]>(
    ["purchase-invoices"],
    "/purchase/invoices",
  );
  const { data: payments } = useData<SupplierPayment[]>(
    ["supplier-payments"],
    "/purchase/payments",
  );
  const { data: suppliers } = useData<Named[]>(["suppliers"], "/suppliers");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");
  const { data: warehouses } = useData<Named[]>(["warehouses"], "/warehouses");
  const { data: accounts } = useData<Named[]>(["cash-accounts"], "/cash-bank/accounts");

  const openPos = (orders ?? []).filter((o) =>
    ["PENDING", "APPROVED", "PARTIAL", "OVERDUE"].includes(o.status),
  );
  const awaiting = (orders ?? []).filter((o) => o.approvalStatus === "AWAITING_APPROVAL");
  const openValue = openPos.reduce((s, o) => s + num(o.total), 0);
  const payable = (suppliers ?? []).reduce((s, sup) => s + num(sup.payable), 0);
  const month = new Date().getMonth();
  const receivedThisMonth = (invoices ?? [])
    .filter((i) => new Date(i.invoiceDate).getMonth() === month)
    .reduce((s, i) => s + num(i.total), 0);

  const toRow = (o: PurchaseOrder) => ({
    ref: o.poNo,
    party: o.supplier.name,
    date: fmtDate(o.orderDate),
    status: o.approvalStatus === "AWAITING_APPROVAL" ? "Awaiting approval" : statusLabel(o.status),
    amount: money(o.total),
  });

  return (
    <>
      <PageHeader
        eyebrow="Procurement"
        title="Purchase"
        description="Create purchase orders, receive supplier invoices and control pending commitments."
        action="New purchase order"
        onAction={() => setTab("PO detail")}
      />
      <MetricStrip
        items={[
          {
            label: "Open PO value",
            value: money(openValue),
            detail: `${openPos.length} purchase orders`,
          },
          {
            label: "Awaiting approval",
            value: money(awaiting.reduce((s, o) => s + num(o.total), 0)),
            detail: `${awaiting.length} orders`,
            tone: "down",
          },
          {
            label: "Due to suppliers",
            value: money(payable),
            detail: "Current payable",
            tone: "neutral",
          },
          {
            label: "Received this month",
            value: money(receivedThisMonth),
            detail: `${(invoices ?? []).length} invoices`,
            tone: "up",
          },
        ]}
      />
      <Panel title="Purchase workspace">
        <TabsBar
          tabs={[
            "Purchase orders",
            "PO detail",
            "Purchase invoice",
            "Supplier payment",
            "Pending PO",
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === "PO detail" ? (
          <OrderForm
            suppliers={suppliers ?? []}
            products={products ?? []}
            onDone={() => setTab("Purchase orders")}
          />
        ) : tab === "Purchase invoice" ? (
          <PurchaseInvoiceForm
            suppliers={suppliers ?? []}
            warehouses={warehouses ?? []}
            products={products ?? []}
            orders={(orders ?? []).filter((o) => ["APPROVED", "PARTIAL"].includes(o.status))}
            onDone={() => setTab("Purchase orders")}
          />
        ) : tab === "Supplier payment" ? (
          <SupplierPaymentForm
            suppliers={suppliers ?? []}
            accounts={accounts ?? []}
            onDone={() => setTab("Purchase orders")}
          />
        ) : (
          <DataTable
            columns={[
              { key: "ref", label: "Reference" },
              { key: "party", label: "Party" },
              { key: "date", label: "Date" },
              { key: "status", label: "Status", status: true },
              { key: "amount", label: "Amount", align: "right" },
            ]}
            rows={(tab === "Pending PO" ? (pending ?? []) : (orders ?? [])).map(toRow)}
            onRowClick={() => setTab("PO detail")}
            onDelete={(row) =>
              save(
                api.del(
                  `/purchase/orders/${(orders ?? []).find((o) => o.poNo === row["ref"])?.id}`,
                ),
                "Purchase order cancelled",
              )
            }
          />
        )}
      </Panel>
    </>
  );
}

function OrderForm({
  suppliers,
  products,
  onDone,
}: {
  suppliers: Named[];
  products: ProductLite[];
  onDone: () => void;
}) {
  const save = useSave();
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: "", rate: "" }]);
  const total = items.reduce((s, i) => s + num(i.quantity) * num(i.rate), 0);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(
          api.post("/purchase/orders", {
            supplierId,
            orderDate: v["Order date"],
            expectedDate: v["Expected / due date"],
            notes: v["Notes"],
            items: items
              .filter((i) => i.productId)
              .map((i) => ({
                productId: i.productId,
                quantity: Number(i.quantity),
                rate: Number(i.rate),
                taxRateId: products.find((p) => p.id === i.productId)?.taxRateId ?? null,
              })),
          }),
          "Purchase order submitted",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-4"
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_290px]">
        <div className="rounded-lg border bg-card shadow-card">
          <div className="grid gap-4 border-b p-5 md:grid-cols-2">
            <EntitySelect
              label="Supplier"
              value={supplierId}
              onChange={setSupplierId}
              options={suppliers}
            />
            <Field
              label="Order date"
              name="Order date"
              type="date"
              defaultValue={new Date().toISOString().slice(0, 10)}
              required
            />
            <Field label="Expected / due date" name="Expected / due date" type="date" required />
            <Field label="Notes" name="Notes" />
          </div>
          <div className="p-4">
            <h3 className="mb-3 text-[13px] font-semibold">Order line items</h3>
            <ItemsEditor
              products={products}
              items={items}
              onChange={setItems}
              priceField="purchasePrice"
            />
          </div>
        </div>
        <aside className="rounded-lg border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold">Order status</span>
            <span className="rounded-full bg-warning-soft px-2 py-1 text-[11px] font-semibold text-warning">
              Draft
            </span>
          </div>
          <dl className="mt-6 space-y-3 text-[13px]">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Order value</dt>
              <dd className="font-semibold tabular-nums">{money(total)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Line items</dt>
              <dd className="font-semibold">{items.filter((i) => i.productId).length}</dd>
            </div>
          </dl>
          <Button type="submit" className="mt-6 w-full" disabled={!supplierId}>
            <Save />
            Submit purchase order
          </Button>
        </aside>
      </div>
    </form>
  );
}

function PurchaseInvoiceForm({
  suppliers,
  warehouses,
  products,
  orders,
  onDone,
}: {
  suppliers: Named[];
  warehouses: Named[];
  products: ProductLite[];
  orders: PurchaseOrder[];
  onDone: () => void;
}) {
  const save = useSave();
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [orderId, setOrderId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: "", rate: "" }]);

  // Picking a PO prefills supplier + lines from the order.
  const pickOrder = (id: number) => {
    setOrderId(id);
    const order = orders.find((o) => o.id === id);
    if (order) {
      setSupplierId(order.supplier.id);
      setItems(
        order.items.map((i) => ({
          productId: i.productId,
          quantity: String(i.quantity),
          rate: String(i.rate),
        })),
      );
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(
          api.post("/purchase/invoices", {
            orderId: orderId || null,
            supplierId,
            warehouseId,
            invoiceDate: v["Transaction date"],
            notes: v["Reference"],
            items: items
              .filter((i) => i.productId)
              .map((i) => ({
                productId: i.productId,
                quantity: Number(i.quantity),
                rate: Number(i.rate),
                taxRateId: products.find((p) => p.id === i.productId)?.taxRateId ?? null,
              })),
          }),
          "Purchase invoice posted — stock updated",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EntitySelect
            label="Supplier"
            value={supplierId}
            onChange={setSupplierId}
            options={suppliers}
          />
          <EntitySelect
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses}
          />
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Source PO (optional)</span>
            <select
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
              value={orderId}
              onChange={(e) => pickOrder(Number(e.target.value))}
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.poNo} · {o.supplier.name}
                </option>
              ))}
            </select>
          </label>
          <Field
            label="Transaction date"
            name="Transaction date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          <Field label="Reference" name="Reference" placeholder="Supplier bill no." />
        </div>
        <div className="mt-5">
          <ItemsEditor
            products={products}
            items={items}
            onChange={setItems}
            priceField="purchasePrice"
          />
        </div>
        <div className="mobile-action-bar mt-5 flex justify-end gap-2">
          <Button type="submit" size="sm" disabled={!supplierId || !warehouseId}>
            <Save />
            Post invoice
          </Button>
        </div>
      </div>
    </form>
  );
}

function SupplierPaymentForm({
  suppliers,
  accounts,
  onDone,
}: {
  suppliers: Named[];
  accounts: Named[];
  onDone: () => void;
}) {
  const save = useSave();
  const [supplierId, setSupplierId] = useState<number | "">("");
  const [accountId, setAccountId] = useState<number | "">("");

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(
          api.post("/purchase/payments", {
            supplierId,
            accountId,
            amount: Number(v["Amount"]),
            date: v["Transaction date"],
            method: v["Method"],
            reference: v["Reference"],
            notes: v["Notes"],
          }),
          "Supplier payment recorded",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EntitySelect
            label="Supplier"
            value={supplierId}
            onChange={setSupplierId}
            options={suppliers}
          />
          <EntitySelect
            label="Account"
            value={accountId}
            onChange={setAccountId}
            options={accounts}
          />
          <Field label="Amount" name="Amount" type="number" required />
          <Field
            label="Transaction date"
            name="Transaction date"
            type="date"
            defaultValue={new Date().toISOString().slice(0, 10)}
            required
          />
          <SelectField
            label="Method"
            name="Method"
            options={["Bank transfer", "Cheque", "Cash", "bKash"]}
          />
          <Field label="Reference" name="Reference" placeholder="Cheque / txn no." />
        </div>
        <div className="mobile-action-bar mt-5 flex justify-end gap-2">
          <Button type="submit" size="sm" disabled={!supplierId || !accountId}>
            <Save />
            Save & submit
          </Button>
        </div>
      </div>
    </form>
  );
}
