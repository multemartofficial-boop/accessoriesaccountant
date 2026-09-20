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

interface SalesOrder {
  id: number;
  soNo: string;
  orderDate: string;
  status: string;
  approvalStatus: string;
  total: string;
  buyer: { id: number; name: string };
  items: { productId: number; quantity: string; rate: string; total: string }[];
}

interface SalesInvoice {
  id: number;
  invNo: string;
  invoiceDate: string;
  status: string;
  total: string;
  paidAmount: string;
  buyer: { id: number; name: string };
}

interface Named {
  id: number;
  name: string;
  outstanding?: string;
  payable?: string;
  type?: string;
}

export function SalesScreen() {
  const [tab, setTab] = useState("Sales orders");
  const save = useSave();
  const { data: orders } = useData<SalesOrder[]>(["sales-orders"], "/sales/orders");
  const { data: invoices } = useData<SalesInvoice[]>(["sales-invoices"], "/sales/invoices");
  const { data: returns_ } = useData<
    { id: number; returnNo: string; date: string; total: string; buyer: { name: string } }[]
  >(["sales-returns"], "/sales/returns");
  const { data: collections } = useData<
    {
      id: number;
      collectionNo: string;
      date: string;
      amount: string;
      buyer: { name: string };
      account: { name: string };
    }[]
  >(["collections"], "/sales/collections");
  void collections;
  const { data: buyers } = useData<Named[]>(["buyers"], "/buyers");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");
  const { data: warehouses } = useData<Named[]>(["warehouses"], "/warehouses");
  const { data: accounts } = useData<Named[]>(["cash-accounts"], "/cash-bank/accounts");

  const month = new Date().getMonth();
  const salesMonth = (invoices ?? [])
    .filter((i) => new Date(i.invoiceDate).getMonth() === month)
    .reduce((s, i) => s + num(i.total), 0);
  const pendingDelivery = (orders ?? []).filter((o) => ["APPROVED", "PARTIAL"].includes(o.status));
  const receivable = (buyers ?? []).reduce((s, b) => s + num(b.outstanding), 0);
  const returnsTotal = (returns_ ?? []).reduce((s, r) => s + num(r.total), 0);

  const toRow = (o: SalesOrder) => ({
    ref: o.soNo,
    party: o.buyer.name,
    date: fmtDate(o.orderDate),
    status: o.approvalStatus === "AWAITING_APPROVAL" ? "Awaiting approval" : statusLabel(o.status),
    amount: money(o.total),
  });

  return (
    <>
      <PageHeader
        eyebrow="Commercial"
        title="Sales"
        description="Manage customer orders, deliveries, invoices, returns and collections."
        action="New sales order"
        onAction={() => setTab("Order form")}
      />
      <MetricStrip
        items={[
          {
            label: "Sales this month",
            value: money(salesMonth),
            detail: `${invoices?.length ?? 0} invoices`,
            tone: "up",
          },
          {
            label: "Pending delivery",
            value: money(pendingDelivery.reduce((s, o) => s + num(o.total), 0)),
            detail: `${pendingDelivery.length} orders`,
          },
          { label: "Receivable", value: money(receivable), detail: "All buyers", tone: "down" },
          {
            label: "Returns",
            value: money(returnsTotal),
            detail: `${returns_?.length ?? 0} returns`,
          },
        ]}
      />
      <Panel title="Sales workspace">
        <TabsBar
          tabs={[
            "Sales orders",
            "Order form",
            "Delivery chalan",
            "Sales invoice",
            "Sales return",
            "Collection",
            "Sales history",
          ]}
          active={tab}
          onChange={setTab}
        />
        {tab === "Order form" ? (
          <SalesOrderForm
            buyers={buyers ?? []}
            products={products ?? []}
            onDone={() => setTab("Sales orders")}
          />
        ) : tab === "Delivery chalan" ? (
          <ChalanForm
            buyers={buyers ?? []}
            warehouses={warehouses ?? []}
            products={products ?? []}
            orders={pendingDelivery}
            onDone={() => setTab("Sales orders")}
          />
        ) : tab === "Sales invoice" ? (
          <SalesInvoiceForm
            buyers={buyers ?? []}
            products={products ?? []}
            orders={pendingDelivery}
            onDone={() => setTab("Sales history")}
          />
        ) : tab === "Sales return" ? (
          <ReturnForm
            buyers={buyers ?? []}
            warehouses={warehouses ?? []}
            products={products ?? []}
            invoices={invoices ?? []}
            onDone={() => setTab("Sales history")}
          />
        ) : tab === "Collection" ? (
          <CollectionForm
            buyers={buyers ?? []}
            accounts={accounts ?? []}
            onDone={() => setTab("Sales history")}
          />
        ) : tab === "Sales history" ? (
          <DataTable
            columns={[
              { key: "ref", label: "Reference" },
              { key: "party", label: "Party" },
              { key: "date", label: "Date" },
              { key: "status", label: "Status", status: true },
              { key: "amount", label: "Amount", align: "right" },
            ]}
            rows={(invoices ?? []).map((i) => ({
              ref: i.invNo,
              party: i.buyer.name,
              date: fmtDate(i.invoiceDate),
              status: statusLabel(i.status),
              amount: money(i.total),
            }))}
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
            rows={(orders ?? []).map(toRow)}
            onRowClick={() => setTab("Order form")}
            onDelete={(row) =>
              save(
                api.del(`/sales/orders/${(orders ?? []).find((o) => o.soNo === row["ref"])?.id}`),
                "Sales order cancelled",
              )
            }
          />
        )}
      </Panel>
    </>
  );
}

function SalesOrderForm({
  buyers,
  products,
  onDone,
}: {
  buyers: Named[];
  products: ProductLite[];
  onDone: () => void;
}) {
  const save = useSave();
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: "", rate: "" }]);
  const [discount, setDiscount] = useState("0");
  const total = items.reduce((s, i) => s + num(i.quantity) * num(i.rate), 0) - num(discount);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(
          api.post("/sales/orders", {
            buyerId,
            orderDate: v["Order date"],
            dueDate: v["Expected / due date"],
            discount: num(discount),
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
          "Sales order submitted",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-4"
    >
      <div className="grid gap-4 xl:grid-cols-[1fr_290px]">
        <div className="rounded-lg border bg-card shadow-card">
          <div className="grid gap-4 border-b p-5 md:grid-cols-2">
            <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
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
              priceField="salesPrice"
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
              <dt className="text-muted-foreground">Discount</dt>
              <dd>
                <input
                  type="number"
                  min="0"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                  className="h-7 w-24 rounded-md border border-input bg-card px-2 text-right text-xs"
                />
              </dd>
            </div>
          </dl>
          <Button type="submit" className="mt-6 w-full" disabled={!buyerId}>
            <Save />
            Submit sales order
          </Button>
        </aside>
      </div>
    </form>
  );
}

function ChalanForm({
  buyers,
  warehouses,
  products,
  orders,
  onDone,
}: {
  buyers: Named[];
  warehouses: Named[];
  products: ProductLite[];
  orders: SalesOrder[];
  onDone: () => void;
}) {
  const save = useSave();
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [orderId, setOrderId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: "", rate: "" }]);

  const pickOrder = (id: number) => {
    setOrderId(id);
    const order = orders.find((o) => o.id === id);
    if (order) {
      setBuyerId(order.buyer.id);
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
          api.post("/sales/chalans", {
            salesOrderId: orderId || null,
            buyerId,
            warehouseId,
            date: v["Transaction date"],
            driverName: v["Driver name"],
            vehicleNo: v["Vehicle no."],
            notes: v["Reference"],
            items: items
              .filter((i) => i.productId)
              .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
          }),
          "Delivery chalan posted — stock reduced",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
          <EntitySelect
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses}
          />
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Sales order (optional)</span>
            <select
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
              value={orderId}
              onChange={(e) => pickOrder(Number(e.target.value))}
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.soNo} · {o.buyer.name}
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
          <Field label="Driver name" name="Driver name" />
          <Field label="Vehicle no." name="Vehicle no." />
          <Field label="Reference" name="Reference" />
        </div>
        <div className="mt-5">
          <ItemsEditor
            products={products}
            items={items}
            onChange={setItems}
            priceField="salesPrice"
          />
        </div>
        <div className="mobile-action-bar mt-5 flex justify-end gap-2">
          <Button type="submit" size="sm" disabled={!buyerId || !warehouseId}>
            <Save />
            Post chalan
          </Button>
        </div>
      </div>
    </form>
  );
}

function SalesInvoiceForm({
  buyers,
  products,
  orders,
  onDone,
}: {
  buyers: Named[];
  products: ProductLite[];
  orders: SalesOrder[];
  onDone: () => void;
}) {
  const save = useSave();
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [orderId, setOrderId] = useState<number | "">("");
  const [discount, setDiscount] = useState("0");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: "", rate: "" }]);

  const pickOrder = (id: number) => {
    setOrderId(id);
    const order = orders.find((o) => o.id === id);
    if (order) {
      setBuyerId(order.buyer.id);
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
          api.post("/sales/invoices", {
            salesOrderId: orderId || null,
            buyerId,
            invoiceDate: v["Transaction date"],
            dueDate: v["Due date"],
            vatMode: v["VAT mode"],
            discount: num(discount),
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
          "Sales invoice posted",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Sales order (optional)</span>
            <select
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
              value={orderId}
              onChange={(e) => pickOrder(Number(e.target.value))}
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.soNo} · {o.buyer.name}
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
          <Field label="Due date" name="Due date" type="date" />
          <SelectField
            label="VAT mode"
            name="VAT mode"
            options={["EXCLUSIVE", "INCLUSIVE"]}
            defaultValue="EXCLUSIVE"
          />
          <Field
            label="Discount"
            name="Discount"
            type="number"
            value={discount}
            onChange={setDiscount}
          />
          <Field label="Reference" name="Reference" />
        </div>
        <div className="mt-5">
          <ItemsEditor
            products={products}
            items={items}
            onChange={setItems}
            priceField="salesPrice"
          />
        </div>
        <div className="mobile-action-bar mt-5 flex justify-end gap-2">
          <Button type="submit" size="sm" disabled={!buyerId}>
            <Save />
            Post invoice
          </Button>
        </div>
      </div>
    </form>
  );
}

function ReturnForm({
  buyers,
  warehouses,
  products,
  invoices,
  onDone,
}: {
  buyers: Named[];
  warehouses: Named[];
  products: ProductLite[];
  invoices: SalesInvoice[];
  onDone: () => void;
}) {
  const save = useSave();
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [invoiceId, setInvoiceId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: "", rate: "" }]);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(
          api.post("/sales/returns", {
            invoiceId,
            buyerId,
            warehouseId,
            date: v["Transaction date"],
            reason: v["Reason"],
            items: items
              .filter((i) => i.productId)
              .map((i) => ({
                productId: i.productId,
                quantity: Number(i.quantity),
                rate: Number(i.rate),
              })),
          }),
          "Sales return posted — stock restored",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
          <EntitySelect
            label="Warehouse"
            value={warehouseId}
            onChange={setWarehouseId}
            options={warehouses}
          />
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>
              Invoice<span className="ml-0.5 text-destructive">*</span>
            </span>
            <select
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
              value={invoiceId}
              required
              onChange={(e) => {
                const id = Number(e.target.value);
                setInvoiceId(id);
                const inv = invoices.find((i) => i.id === id);
                if (inv) setBuyerId(inv.buyer.id);
              }}
            >
              <option value="" disabled>
                Select invoice
              </option>
              {invoices.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.invNo} · {i.buyer.name}
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
          <Field label="Reason" name="Reason" required />
        </div>
        <div className="mt-5">
          <ItemsEditor
            products={products}
            items={items}
            onChange={setItems}
            priceField="salesPrice"
          />
        </div>
        <div className="mobile-action-bar mt-5 flex justify-end gap-2">
          <Button type="submit" size="sm" disabled={!buyerId || !warehouseId || !invoiceId}>
            <Save />
            Post return
          </Button>
        </div>
      </div>
    </form>
  );
}

function CollectionForm({
  buyers,
  accounts,
  onDone,
}: {
  buyers: Named[];
  accounts: Named[];
  onDone: () => void;
}) {
  const save = useSave();
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [accountId, setAccountId] = useState<number | "">("");
  const buyer = buyers.find((b) => b.id === buyerId);

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(
          api.post("/sales/collections", {
            buyerId,
            accountId,
            amount: Number(v["Amount"]),
            date: v["Transaction date"],
            method: v["Method"],
            reference: v["Reference"],
            notes: v["Notes"],
          }),
          "Collection recorded",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
          {buyer && (
            <div className="rounded-lg border bg-surface-subtle px-3 py-2 text-xs">
              Outstanding: <strong>{money(buyer.outstanding)}</strong>
            </div>
          )}
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
          <Field label="Reference" name="Reference" />
        </div>
        <div className="mobile-action-bar mt-5 flex justify-end gap-2">
          <Button type="submit" size="sm" disabled={!buyerId || !accountId}>
            <Save />
            Save & submit
          </Button>
        </div>
      </div>
    </form>
  );
}
