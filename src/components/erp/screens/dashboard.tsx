import { useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { AlertTriangle } from "lucide-react";
import { ActionDialog, DataTable, MetricStrip, PageHeader, Panel } from "../ui";
import { api } from "@/lib/api";
import { money, num, useActionDialog, useData, useSave } from "./shared";

interface DashboardData {
  sales: string;
  purchase: string;
  receivable: string;
  payable: string;
  cashAndBank: string;
  stockValue: string;
  grossMarginPct: string;
  overdueReceivable: string;
  lowStock: {
    id: number;
    sku: string;
    name: string;
    totalStock: string;
    minStock: string;
    unit: { name: string; code: string };
    balances: { warehouse: { name: string } }[];
  }[];
  topBuyers: { name: string; orders: number; sales: string }[];
  topProducts: { sku: string; product: string; qty: string }[];
  chart: { month: string; sales: string; purchase: string }[];
}

interface CashAccount {
  id: number;
  name: string;
  type: string;
}

export function DashboardScreen() {
  const [period, setPeriod] = useState("Month");
  const dialog = useActionDialog();
  const save = useSave();
  const { data } = useData<DashboardData>(
    ["dashboard", period],
    `/dashboard?period=${period.toLowerCase()}`,
  );
  const { data: accounts } = useData<CashAccount[]>(["cash-accounts"], "/cash-bank/accounts");

  const chartData = (data?.chart ?? []).map((c) => ({
    month: c.month,
    sales: num(c.sales) / 100000,
    purchase: num(c.purchase) / 100000,
  }));

  return (
    <>
      <PageHeader
        eyebrow={`Overview / ${new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}`}
        title="Trading dashboard"
        description="Commercial, inventory and cash position across all operating units."
        action="Record transaction"
        onAction={dialog.create}
      />
      <div className="mb-4 flex w-fit rounded-lg border bg-card p-1 shadow-card">
        {["Day", "Month", "Year"].map((p) => (
          <button
            type="button"
            key={p}
            onClick={() => setPeriod(p)}
            className={`h-7 rounded-md px-3 text-[11px] font-semibold transition-colors ${
              period === p
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:bg-muted"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
      <MetricStrip
        items={[
          {
            label: `Sales · ${period}`,
            value: money(data?.sales),
            detail: "Posted invoices",
            tone: "up",
          },
          {
            label: `Purchase · ${period}`,
            value: money(data?.purchase),
            detail: "Supplier invoices",
            tone: "up",
          },
          {
            label: "Trade receivable",
            value: money(data?.receivable),
            detail: `${money(data?.overdueReceivable)} overdue`,
            tone: "down",
          },
          {
            label: "Trade payable",
            value: money(data?.payable),
            detail: "Owed to suppliers",
            tone: "neutral",
          },
        ]}
      />
      <div className="mb-4 grid border-l border-t bg-card sm:grid-cols-3">
        <div className="border-b border-r p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Cash & bank</div>
          <div className="mt-1 text-base font-semibold">{money(data?.cashAndBank)}</div>
        </div>
        <div className="border-b border-r p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Stock value</div>
          <div className="mt-1 text-base font-semibold">{money(data?.stockValue)}</div>
        </div>
        <div className="border-b border-r p-3">
          <div className="text-[11px] uppercase text-muted-foreground">Gross margin</div>
          <div className="mt-1 text-base font-semibold">
            {num(data?.grossMarginPct).toFixed(2)}%
          </div>
        </div>
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.65fr_1fr]">
        <Panel
          title="Monthly sales vs purchase"
          subtitle="Amounts in lakh BDT"
          action={
            <div className="flex gap-4 text-[11px] font-medium">
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-primary" />
                Sales
              </span>
              <span className="flex items-center gap-1.5">
                <i className="size-2 rounded-full bg-chart-2" />
                Purchase
              </span>
            </div>
          }
        >
          <div className="overflow-x-auto">
            <div className="h-64 min-w-[520px] p-4 sm:min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="salesFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.25} />
                      <stop offset="100%" stopColor="var(--primary)" stopOpacity={0.01} />
                    </linearGradient>
                    <linearGradient id="purchaseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.18} />
                      <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0.01} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} />
                  <YAxis tick={{ fontSize: 11 }} axisLine={false} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="sales"
                    stroke="var(--primary)"
                    fill="url(#salesFill)"
                    strokeWidth={2.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="purchase"
                    stroke="var(--chart-2)"
                    fill="url(#purchaseFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </Panel>
        <Panel
          title="Low stock alerts"
          subtitle={`${data?.lowStock.length ?? 0} products below minimum`}
        >
          <div className="divide-y">
            {(data?.lowStock ?? []).map((p) => (
              <div key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <AlertTriangle className="size-5 shrink-0 text-warning" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {p.sku} · {p.balances[0]?.warehouse.name ?? "No stock"}
                  </div>
                </div>
                <div className="text-right text-[11px] font-semibold tabular-nums">
                  {num(p.totalStock).toLocaleString()} {p.unit.code.toLowerCase()}
                </div>
              </div>
            ))}
            {data?.lowStock.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                All stock levels healthy.
              </div>
            )}
          </div>
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Top buyers" subtitle="By net sales">
          <DataTable
            searchable={false}
            columns={[
              { key: "name", label: "Buyer" },
              { key: "orders", label: "Orders", align: "right" },
              { key: "sales", label: "Net sales", align: "right" },
            ]}
            rows={(data?.topBuyers ?? []).map((b) => ({
              name: b.name,
              orders: b.orders,
              sales: money(b.sales),
            }))}
          />
        </Panel>
        <Panel title="Top-selling products" subtitle="By issued quantity">
          <DataTable
            searchable={false}
            columns={[
              { key: "sku", label: "SKU" },
              { key: "product", label: "Product" },
              { key: "qty", label: "Quantity", align: "right" },
            ]}
            rows={(data?.topProducts ?? []).map((p) => ({
              sku: p.sku,
              product: p.product,
              qty: num(p.qty).toLocaleString(),
            }))}
          />
        </Panel>
      </div>
      <ActionDialog
        open={dialog.open}
        onOpenChange={dialog.setOpen}
        title="Record transaction"
        description="Add a cash or bank receipt / payment."
        fields={[
          {
            label: "Transaction type",
            name: "type",
            options: ["Receipt", "Payment"],
            required: true,
          },
          {
            label: "Account",
            name: "account",
            options: (accounts ?? []).map((a) => a.name),
            required: true,
          },
          { label: "Amount", name: "amount", type: "number", required: true },
          { label: "Date", name: "date", type: "date", required: true },
          { label: "Reference", name: "reference" },
          { label: "Notes", name: "particulars" },
        ]}
        onSubmit={(values) =>
          save(
            api.post("/cash-bank/transactions", {
              type: values["type"]?.toUpperCase(),
              accountId: accounts?.find((a) => a.name === values["account"])?.id,
              amount: Number(values["amount"]),
              date: values["date"],
              reference: values["reference"],
              particulars: values["particulars"],
            }),
            "Transaction recorded",
          )
        }
      />
    </>
  );
}
