import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Download, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, Field, PageHeader, Panel, type TableRowData } from "../ui";
import { getToken } from "@/lib/api";
import { fmtDate, money, num, statusLabel, useData } from "./shared";

const reportEndpoints: Record<string, string> = {
  "Sales by buyer": "/analytics/sales-by-buyer",
  "Product profitability": "/analytics/product-profitability",
  "Purchase by supplier": "/analytics/purchase-by-supplier",
  "Inventory valuation": "/analytics/inventory-valuation",
  "Receivable aging": "/reports/aging/receivable",
  "Payable aging": "/reports/aging/payable",
  "VAT summary": "/vat/report",
  "Warehouse movement": "/analytics/warehouse-movement",
  "Sales by user": "/analytics/sales-by-user",
  "Fast / slow / dead stock": "/analytics/stock-movement",
};

const reports = Object.keys(reportEndpoints);

export function AnalyticsScreen() {
  const [report, setReport] = useState(reports[0]!);
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data } = useData<unknown>(
    ["analytics", report, from, to],
    `${reportEndpoints[report]}?from=${from}&to=${to}`,
  );

  const rows = normalize(report, data);
  const columns = columnsFor(report, rows);

  const exportCsv = async () => {
    const res = await fetch(`/api${reportEndpoints[report]}?from=${from}&to=${to}&format=csv`, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!res.ok) {
      toast.error("Export failed");
      return;
    }
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${report.toLowerCase().replaceAll(" ", "-")}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
    toast.success(`${report} export prepared`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Reports"
        title="Reports & analytics center"
        description="Run operational and financial reports with consistent filters and exports."
      />
      <div className="mb-5 grid overflow-hidden rounded-lg border bg-card shadow-card sm:grid-cols-2 lg:grid-cols-4">
        {reports.map((r, i) => (
          <Button
            type="button"
            variant="ghost"
            key={r}
            onClick={() => setReport(r)}
            className={`group h-auto items-start justify-start rounded-none border-b border-r p-4 text-left ${report === r ? "bg-accent" : ""}`}
          >
            <span className="w-full">
              <FileText className="mb-5 size-5 text-primary" />
              <span className="block text-[13px] font-semibold">{r}</span>
              <span className="mt-1 block text-[11px] font-normal text-muted-foreground">
                {i < 3 ? "Live data" : "Filtered"}
              </span>
              <ArrowRight className="ml-auto mt-3 size-3.5 text-muted-foreground group-hover:text-primary" />
            </span>
          </Button>
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1fr_2fr]">
        <Panel title="Report filters">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              toast.success(`${report} generated`);
            }}
            className="grid gap-4 p-4"
          >
            <label className="grid gap-1.5 text-xs font-semibold">
              <span>Report</span>
              <select
                className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
                value={report}
                onChange={(e) => setReport(e.target.value)}
              >
                {reports.map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </label>
            <Field label="From date" type="date" value={from} onChange={setFrom} />
            <Field label="To date" type="date" value={to} onChange={setTo} />
            <Button type="submit" size="sm">
              Generate report
            </Button>
          </form>
        </Panel>
        <Panel
          title={report}
          action={
            <Button variant="outline" size="sm" onClick={exportCsv}>
              <Download />
              Excel / PDF
            </Button>
          }
        >
          {chartFor(report, rows)}
          <DataTable searchable={false} columns={columns} rows={rows} />
        </Panel>
      </div>
    </>
  );
}

function asNum(v: unknown) {
  return Number(String(v ?? "0").replace(/[৳,]/g, ""));
}

function parseAge(v: unknown) {
  return Number(String(v ?? "0").replace(/[^0-9.]/g, ""));
}

function bucketFor(days: number) {
  if (days <= 30) return "0-30";
  if (days <= 60) return "31-60";
  if (days <= 90) return "61-90";
  return "90+";
}

function genericColumns(rows: TableRowData[]) {
  const keys = rows[0] ? Object.keys(rows[0]) : ["value"];
  return keys.map((k) => ({
    key: k,
    label: statusLabel(k),
    align:
      (typeof rows[0]?.[k] === "string" && String(rows[0][k]).startsWith("৳")) ||
      typeof rows[0]?.[k] === "number"
        ? ("right" as const)
        : ("left" as const),
  }));
}

function columnsFor(report: string, rows: TableRowData[]) {
  switch (report) {
    case "Sales by buyer":
    case "Purchase by supplier":
    case "Sales by user":
      return [
        { key: "party", label: "Party" },
        { key: "total", label: "Total", align: "right" as const },
        { key: "percent", label: "%", align: "right" as const },
      ];
    case "Product profitability":
      return [
        { key: "sku", label: "SKU" },
        { key: "product", label: "Product" },
        { key: "revenue", label: "Revenue", align: "right" as const },
        { key: "profit", label: "Profit", align: "right" as const },
        { key: "margin", label: "Margin %", align: "right" as const },
        { key: "marginBar", label: "Margin", align: "left" as const },
      ];
    case "Inventory valuation":
      return [
        { key: "sku", label: "SKU" },
        { key: "product", label: "Product" },
        { key: "warehouse", label: "Warehouse" },
        { key: "quantity", label: "Qty", align: "right" as const },
        { key: "value", label: "Value", align: "right" as const },
      ];
    case "Fast / slow / dead stock":
      return [
        { key: "velocity", label: "Velocity" },
        { key: "sku", label: "SKU" },
        { key: "product", label: "Product" },
        { key: "stock", label: "Stock", align: "right" as const },
        { key: "moved", label: "Moved", align: "right" as const },
      ];
    case "Warehouse movement":
      return [
        { key: "warehouse", label: "Warehouse" },
        { key: "in", label: "In", align: "right" as const },
        { key: "out", label: "Out", align: "right" as const },
        { key: "moves", label: "Moves", align: "right" as const },
      ];
    case "Receivable aging":
    case "Payable aging":
      return [
        { key: "party", label: "Party" },
        { key: "open", label: "Open", align: "right" as const },
        { key: "age", label: "Age", align: "right" as const },
        { key: "bucket", label: "Bucket" },
      ];
    case "VAT summary":
      return [
        { key: "period", label: "Period" },
        { key: "taxableSales", label: "Taxable sales", align: "right" as const },
        { key: "outputVat", label: "Output VAT", align: "right" as const },
        { key: "inputVat", label: "Input VAT", align: "right" as const },
        { key: "net", label: "Net payable", align: "right" as const },
      ];
    default:
      return genericColumns(rows);
  }
}

function chartFor(report: string, rows: TableRowData[]) {
  if (["Sales by buyer", "Purchase by supplier", "Sales by user"].includes(report)) {
    const data = [...rows]
      .map((r) => ({ party: String(r["party"] ?? "—"), total: asNum(r["total"]) }))
      .filter((r) => r["total"] > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
    return (
      <div className="h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ left: 20, right: 20 }}>
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="4 5"
              horizontal={true}
              vertical={false}
            />
            <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} />
            <YAxis
              type="category"
              dataKey="party"
              tick={{ fontSize: 10 }}
              width={120}
              axisLine={false}
            />
            <Tooltip formatter={(v: number) => money(v)} />
            <Bar dataKey="total" fill="var(--primary)" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (report === "Product profitability") {
    const data = [...rows]
      .map((r) => ({
        name: String(r["product"] ?? r["sku"] ?? "—"),
        revenue: asNum(r["revenue"]),
        profit: asNum(r["profit"]),
      }))
      .filter((r) => r["revenue"] > 0 || r["profit"] > 0)
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);
    return (
      <div className="h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart layout="vertical" data={data} margin={{ left: 20, right: 20 }}>
            <CartesianGrid
              stroke="var(--border)"
              strokeDasharray="4 5"
              horizontal={true}
              vertical={false}
            />
            <XAxis type="number" tick={{ fontSize: 10 }} axisLine={false} />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 10 }}
              width={120}
              axisLine={false}
            />
            <Tooltip formatter={(v: number) => money(v)} />
            <Bar dataKey="revenue" fill="#3b82f6" radius={[0, 4, 4, 0]} />
            <Bar dataKey="profit" fill="#10b981" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (report === "Warehouse movement") {
    const data = [...rows]
      .map((r) => ({
        warehouse: String(r["warehouse"] ?? "—"),
        in: asNum(r["in"]),
        out: asNum(r["out"]),
      }))
      .filter((r) => r["in"] > 0 || r["out"] > 0)
      .sort((a, b) => b.in + b.out - a.in - a.out)
      .slice(0, 12);
    return (
      <div className="h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ left: 10, right: 10 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} />
            <XAxis dataKey="warehouse" tick={{ fontSize: 10 }} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} />
            <Tooltip formatter={(v: number) => v.toLocaleString()} />
            <Bar dataKey="in" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            <Bar dataKey="out" fill="#f59e0b" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (report === "VAT summary") {
    const data = [...rows]
      .map((r) => ({ period: String(r["period"] ?? "—"), net: asNum(r["net"]) }))
      .filter((r) => r["period"] !== "—");
    return (
      <div className="h-72 p-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ left: 10, right: 10 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" />
            <XAxis dataKey="period" tick={{ fontSize: 10 }} axisLine={false} />
            <YAxis tick={{ fontSize: 10 }} axisLine={false} />
            <Tooltip formatter={(v: number) => money(v)} />
            <Line
              type="monotone"
              dataKey="net"
              stroke="var(--primary)"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (report === "Inventory valuation") {
    const totals = new Map<string, number>();
    let grand = 0;
    for (const r of rows) {
      const w = String(r["warehouse"] ?? "Other");
      const v = asNum(r["value"]);
      totals.set(w, (totals.get(w) ?? 0) + v);
      grand += v;
    }
    const items = Array.from(totals.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
    const colors = [
      "bg-blue-500",
      "bg-emerald-500",
      "bg-amber-500",
      "bg-purple-500",
      "bg-rose-500",
      "bg-cyan-500",
      "bg-slate-500",
    ];
    return (
      <div className="p-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
          Value by warehouse
        </div>
        <div className="flex h-4 overflow-hidden rounded-full">
          {items.map((item, i) => {
            const pct = grand ? (item.value / grand) * 100 : 0;
            return (
              <div
                key={item.name}
                className={colors[i % colors.length]}
                style={{ width: `${pct}%` }}
                title={`${item.name}: ${money(item.value)}`}
              />
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item, i) => {
            const pct = grand ? ((item.value / grand) * 100).toFixed(1) : "0.0";
            return (
              <div key={item.name} className="flex items-center gap-2 text-xs">
                <span className={`h-3 w-3 rounded-full ${colors[i % colors.length]}`} />
                <span className="truncate text-muted-foreground">{item.name}</span>
                <span className="ml-auto font-semibold tabular-nums">{pct}%</span>
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (report === "Fast / slow / dead stock") {
    const counts = new Map<string, number>();
    for (const r of rows) {
      const v = String(r["velocity"] ?? "—");
      counts.set(v, (counts.get(v) ?? 0) + 1);
    }
    const order = ["Fast", "Slow", "Dead"];
    const colors: Record<string, string> = {
      Fast: "bg-emerald-500",
      Slow: "bg-yellow-400",
      Dead: "bg-red-500",
    };
    return (
      <div className="grid grid-cols-3 gap-3 p-4">
        {order.map((key) => (
          <div key={key} className="rounded-lg border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                {key}
              </span>
              <span className={`h-2.5 w-2.5 rounded-full ${colors[key]}`} />
            </div>
            <div className="mt-2 text-2xl font-bold">{counts.get(key) ?? 0}</div>
            <div className="mt-1 text-[11px] text-muted-foreground">SKUs</div>
          </div>
        ))}
      </div>
    );
  }

  if (report === "Receivable aging" || report === "Payable aging") {
    const buckets: Record<string, number> = { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
    for (const r of rows) {
      const key = bucketFor(parseAge(r["age"]));
      const current = buckets[key] ?? 0;
      buckets[key] = current + asNum(r["open"]);
    }
    const total = Object.values(buckets).reduce((a, b) => a + b, 0);
    const order = ["0-30", "31-60", "61-90", "90+"];
    const colors = ["bg-emerald-500", "bg-yellow-400", "bg-orange-500", "bg-red-500"];
    return (
      <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
        {order.map((key, i) => {
          const amount = buckets[key] ?? 0;
          const pct = total ? ((amount / total) * 100).toFixed(1) : "0.0";
          return (
            <div key={key} className="overflow-hidden rounded-lg border bg-card shadow-card">
              <div className={`h-1.5 ${colors[i]}`} />
              <div className="p-4">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {key} days
                </div>
                <div className="mt-2 break-words text-xl font-bold">{money(amount)}</div>
                <div className="mt-1 text-[11px] text-muted-foreground">{pct}% of open</div>
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  return null;
}

function normalize(report: string, data: unknown): TableRowData[] {
  if (!data) return [];
  const d = data as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (Array.isArray(d) ? d : Array.isArray(d["rows"]) ? d["rows"] : []) as any[];

  switch (report) {
    case "Sales by buyer":
    case "Purchase by supplier":
    case "Sales by user": {
      const parsed = list.map((r) => {
        const out: TableRowData = {};
        for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
          const isNumeric =
            typeof v === "number" || (typeof v === "string" && /^\d+(\.\d+)?$/.test(v));
          out[k] = isNumeric ? money(v) : String(v ?? "—");
        }
        return out;
      });
      const withTotals = parsed.map((r) => {
        const values = Object.values(r);
        const party = String(
          r["party"] ??
            r["buyer"] ??
            r["supplier"] ??
            r["user"] ??
            r["name"] ??
            values.find((v) => typeof v === "string" && !String(v).startsWith("৳")) ??
            "—",
        );
        const totalStr = String(
          values.find((v) => typeof v === "string" && String(v).startsWith("৳")) ?? "0",
        );
        return { party, total: asNum(totalStr) };
      });
      const sum = withTotals.reduce((s, x) => s + x.total, 0);
      return withTotals.map((x) => ({
        party: x.party,
        total: money(x.total),
        percent: sum ? `${((x.total / sum) * 100).toFixed(1)}%` : "0.0%",
      }));
    }
    case "Inventory valuation":
      return list.map((r) => ({
        sku: r["sku"],
        product: r["product"],
        warehouse: r["warehouse"],
        quantity: num(r.quantity).toLocaleString(),
        value: money(r["value"]),
      }));
    case "Fast / slow / dead stock":
      return list.map((r) => ({
        sku: r["sku"],
        product: r["product"],
        stock: num(r.stock).toLocaleString(),
        moved: num(r.movedInPeriod).toLocaleString(),
        velocity: r["velocity"],
      }));
    case "Product profitability":
      return list.map((r) => {
        const marginPct = num(r.marginPct);
        const blocks = Math.max(0, Math.min(20, Math.round(marginPct / 5)));
        return {
          sku: r["sku"],
          product: r["name"],
          qty: num(r.qty).toLocaleString(),
          revenue: money(r["revenue"]),
          profit: money(r["profit"]),
          margin: `${marginPct.toFixed(1)}%`,
          marginBar: blocks ? "█".repeat(blocks) : "—",
        };
      });
    case "Warehouse movement":
      return list.map((r) => ({
        warehouse: r["warehouse"],
        in: num(r.inQty).toLocaleString(),
        out: num(r.outQty).toLocaleString(),
        moves: r.count,
      }));
    case "VAT summary":
      return list.map((r) => ({
        period: r["period"],
        taxableSales: money(r.taxableSales),
        outputVat: money(r.outputVat),
        inputVat: money(r.inputVat),
        net: money(r.netPayable),
      }));
    case "Receivable aging":
    case "Payable aging":
      return list.map((r) => {
        const ageDays = num(r.ageDays);
        return {
          party: r.party,
          date: fmtDate(r.date),
          open: money(r.open),
          age: `${ageDays}d`,
          bucket: bucketFor(ageDays),
        };
      });
    default:
      return list as TableRowData[];
  }
}
