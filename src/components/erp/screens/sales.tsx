import { useState } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Field, MetricStrip, PageHeader, Panel, SelectField, TabsBar } from "../ui";
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
    {
      id: number;
      returnNo: string;
      date: string;
      total: string;
      reason?: string;
      buyer: { name: string };
    }[]
  >(["sales-returns"], "/sales/returns");
  const { data: collections } = useData<
    {
      id: number;
      collectionNo: string;
      date: string;
      amount: string;
      method?: string;
      buyer: { name: string };
      account: { name: string };
    }[]
  >(["collections"], "/sales/collections");
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

  function statusClass(value: string) {
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
          <div className="bg-workspace/40 p-4">
            <div className="space-y-3">
              {(invoices ?? []).map((i) => (
                <div key={i.id} className="rounded-lg border bg-card p-4 shadow-card">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{i.invNo}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {i.buyer.name} · {fmtDate(i.invoiceDate)}
                      </div>
                    </div>
                    <Badge
                      variant="outline"
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-none ${statusClass(i.status)}`}
                    >
                      {statusLabel(i.status)}
                    </Badge>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg border bg-surface-subtle p-3 text-sm">
                    <div>
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Total
                      </div>
                      <div className="font-semibold tabular-nums">{money(i.total)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Paid
                      </div>
                      <div className="font-semibold tabular-nums">{money(i.paidAmount)}</div>
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase text-muted-foreground">
                        Balance
                      </div>
                      <div className="font-semibold tabular-nums">
                        {money(num(i.total) - num(i.paidAmount))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-3 text-right text-[13px] font-semibold tabular-nums">
                    Net total: {money(i.total)}
                  </div>
                </div>
              ))}
              {(invoices ?? []).length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No records match your search.
                </div>
              )}
            </div>
            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="overflow-hidden rounded-lg border bg-card shadow-card">
                <div className="border-b px-4 py-2.5 text-[13px] font-semibold">
                  Collections <span className="text-muted-foreground">({(collections ?? []).length})</span>
                </div>
                <div className="divide-y">
                  {(collections ?? []).map((c) => (
                    <div key={c.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold">{c.collectionNo}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {c.buyer?.name ?? ""} · {fmtDate(c.date)}
                          {c.method ? ` · ${c.method}` : ""}
                        </div>
                      </div>
                      <div className="font-semibold tabular-nums text-success">{money(c.amount)}</div>
                    </div>
                  ))}
                  {(collections ?? []).length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No collections recorded.
                    </div>
                  )}
                </div>
              </div>
              <div className="overflow-hidden rounded-lg border bg-card shadow-card">
                <div className="border-b px-4 py-2.5 text-[13px] font-semibold">
                  Sales returns <span className="text-muted-foreground">({(returns_ ?? []).length})</span>
                </div>
                <div className="divide-y">
                  {(returns_ ?? []).map((r) => (
                    <div key={r.id} className="flex items-center justify-between px-4 py-3 text-sm">
                      <div className="min-w-0">
                        <div className="font-semibold">{r.returnNo}</div>
                        <div className="truncate text-[11px] text-muted-foreground">
                          {r.buyer?.name ?? ""} · {fmtDate(r.date)}
                          {r.reason ? ` · ${r.reason}` : ""}
                        </div>
                      </div>
                      <div className="font-semibold tabular-nums text-destructive">
                        {money(r.total)}
                      </div>
                    </div>
                  ))}
                  {(returns_ ?? []).length === 0 && (
                    <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                      No sales returns.
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-workspace/40 p-4">
            <div className="space-y-3">
              {(orders ?? []).map((o) => (
                <div
                  key={o.id}
                  className="rounded-lg border bg-card p-4 shadow-card"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold">{o.soNo}</div>
                      <div className="mt-0.5 truncate text-xs text-muted-foreground">
                        {o.buyer.name} · {fmtDate(o.orderDate)}
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-1.5">
                      <Badge
                        variant="outline"
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-none ${statusClass(o.approvalStatus === "AWAITING_APPROVAL" ? "awaiting" : o.status)}`}
                      >
                        {o.approvalStatus === "AWAITING_APPROVAL"
                          ? "Awaiting approval"
                          : statusLabel(o.status)}
                      </Badge>
                    </div>
                  </div>
                  <div className="mt-3 overflow-hidden rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-table-head text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                          <th className="px-3 py-2">Item</th>
                          <th className="w-24 px-3 py-2 text-right">Qty</th>
                          <th className="w-24 px-3 py-2 text-right">Rate</th>
                          <th className="w-28 px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {o.items.map((item, idx) => {
                          const p = products?.find((x) => x.id === item.productId);
                          return (
                            <tr key={idx} className="border-b last:border-0">
                              <td className="px-3 py-1.5">
                                {p?.name ?? `Product #${item.productId}`}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {item.quantity}
                              </td>
                              <td className="px-3 py-1.5 text-right tabular-nums">
                                {money(item.rate)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-semibold tabular-nums">
                                {money(num(item.quantity) * num(item.rate))}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 flex items-center justify-between">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      title="Cancel order"
                      className="h-7 w-7 text-destructive"
                      onClick={(e) => {
                        e.stopPropagation();
                        save(api.del(`/sales/orders/${o.id}`), "Sales order cancelled");
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                    <div className="text-[13px] font-semibold tabular-nums">
                      Total: {money(o.total)}
                    </div>
                  </div>
                </div>
              ))}
              {(orders ?? []).length === 0 && (
                <div className="py-12 text-center text-sm text-muted-foreground">
                  No records match your search.
                </div>
              )}
            </div>
          </div>
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
