import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
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
  const chartRows = rows.slice(0, 8).map((r) => ({
    name: String(Object.values(r)[0] ?? ""),
    value: num(
      Object.values(r).find((v) => typeof v === "string" && String(v).startsWith("৳")) ?? 0,
    ),
  }));

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
        action="Saved reports"
        onAction={() => toast.success("Saved reports opened")}
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
          <div className="h-72 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows}>
                <CartesianGrid stroke="var(--border)" strokeDasharray="4 5" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} axisLine={false} />
                <YAxis tick={{ fontSize: 10 }} axisLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="var(--primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <DataTable searchable={false} columns={columnFor(rows)} rows={rows} />
        </Panel>
      </div>
    </>
  );
}

function columnFor(rows: TableRowData[]) {
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

function normalize(report: string, data: unknown): TableRowData[] {
  if (!data) return [];
  const d = data as Record<string, unknown>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const list = (Array.isArray(d) ? d : Array.isArray(d["rows"]) ? d["rows"] : []) as any[];

  switch (report) {
    case "Sales by buyer":
    case "Purchase by supplier":
    case "Sales by user":
      return list.map((r) => {
        const out: TableRowData = {};
        for (const [k, v] of Object.entries(r as Record<string, unknown>)) {
          out[k] = typeof v === "string" && /^\d+(\.\d+)?$/.test(v) ? money(v) : String(v ?? "—");
        }
        return out;
      });
    case "Inventory valuation":
      return list.map((r) => ({
        sku: r.sku,
        product: r.product,
        warehouse: r.warehouse,
        quantity: num(r.quantity).toLocaleString(),
        value: money(r.value),
      }));
    case "Fast / slow / dead stock":
      return list.map((r) => ({
        sku: r.sku,
        product: r.product,
        stock: num(r.stock).toLocaleString(),
        moved: num(r.movedInPeriod).toLocaleString(),
        velocity: r.velocity,
      }));
    case "Product profitability":
      return list.map((r) => ({
        sku: r.sku,
        product: r.name,
        qty: num(r.qty).toLocaleString(),
        revenue: money(r.revenue),
        profit: money(r.profit),
        margin: `${num(r.marginPct).toFixed(1)}%`,
      }));
    case "Warehouse movement":
      return list.map((r) => ({
        warehouse: r.warehouse,
        in: num(r.inQty).toLocaleString(),
        out: num(r.outQty).toLocaleString(),
        moves: r.count,
      }));
    case "VAT summary":
      return list.map((r) => ({
        period: r.period,
        taxableSales: money(r.taxableSales),
        outputVat: money(r.outputVat),
        inputVat: money(r.inputVat),
        net: money(r.netPayable),
      }));
    case "Receivable aging":
    case "Payable aging":
      return list.map((r) => ({
        party: r.party,
        date: fmtDate(r.date),
        open: money(r.open),
        age: `${r.ageDays}d`,
      }));
    default:
      return list as TableRowData[];
  }
}
