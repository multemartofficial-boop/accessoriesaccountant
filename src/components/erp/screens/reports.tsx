import { useState } from "react";
import { FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DataTable, Field, MiniStats, PageHeader, Panel, type TableRowData } from "../ui";
import { fmtDate, money, num, statusLabel, useData } from "./shared";

const reportTabs = [
  "Profit & Loss",
  "Balance Sheet",
  "Trial Balance",
  "General Ledger",
  "Aging Report",
] as const;

const endpoints: Record<(typeof reportTabs)[number], string> = {
  "Profit & Loss": "/reports/pnl",
  "Balance Sheet": "/reports/balance-sheet",
  "Trial Balance": "/reports/trial-balance",
  "General Ledger": "/reports/general-ledger",
  "Aging Report": "/reports/aging/receivable",
};

export function FinancialReportsScreen() {
  const [tab, setTab] = useState<(typeof reportTabs)[number]>("Profit & Loss");
  const [from, setFrom] = useState(
    new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const { data } = useData<unknown>(
    ["report", tab, from, to],
    `${endpoints[tab]}?from=${from}&to=${to}`,
  );

  const { rows, stats } = render(tab, data);

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Financial reports"
        description="Standard financial statements and account-level analysis."
        action="Export report"
        onAction={() => toast.success(`${tab} export prepared`)}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {reportTabs.map((report) => (
          <button
            key={report}
            onClick={() => setTab(report)}
            className={`rounded-lg border p-4 text-left shadow-card transition-colors ${
              tab === report
                ? "border-primary bg-primary text-primary-foreground"
                : "bg-card hover:border-primary/30 hover:bg-accent"
            }`}
          >
            <FileText className="mb-4 size-4" />
            <div className="text-[13px] font-semibold">{report}</div>
            <div
              className={`mt-1 text-[11px] ${tab === report ? "text-primary-foreground/70" : "text-muted-foreground"}`}
            >
              {new Date().toLocaleString("en-GB", { month: "long", year: "numeric" })}
            </div>
          </button>
        ))}
      </div>
      <Panel title={tab} subtitle={`Financial year ${new Date().getFullYear()} · amounts in BDT`}>
        <div className="flex flex-wrap items-end gap-3 border-b bg-surface-subtle p-3">
          <Field label="From" type="date" value={from} onChange={setFrom} />
          <Field label="To" type="date" value={to} onChange={setTo} />
          <Button size="sm" className="h-9" onClick={() => toast.success("Report refreshed")}>
            Run report
          </Button>
        </div>
        <div className="p-4">
          <MiniStats items={stats} />
        </div>
        <DataTable
          columns={[
            { key: "account", label: "Account" },
            { key: "debit", label: "Debit", align: "right" },
            { key: "credit", label: "Credit", align: "right" },
            { key: "balance", label: "Balance", align: "right" },
            { key: "period", label: "Period" },
          ]}
          rows={rows}
        />
      </Panel>
    </>
  );
}

function render(
  tab: (typeof reportTabs)[number],
  data: unknown,
): { rows: TableRowData[]; stats: { label: string; value: string; tone?: "up" | "down" }[] } {
  if (!data) return { rows: [], stats: [] };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const d = data as any;

  if (tab === "Profit & Loss") {
    const rows = (
      d["rows"] as {
        account: string;
        debit: string;
        credit: string;
        net: string;
        category: string;
      }[]
    ).map((r) => ({
      account: r.account,
      debit: num(r.debit) ? money(r.debit) : "—",
      credit: num(r.credit) ? money(r.credit) : "—",
      balance: money(r.net),
      period: r.category === "INCOME" ? "Income" : "Expense",
    }));
    return {
      rows,
      stats: [
        { label: "Revenue", value: money(d.revenue), tone: "up" },
        { label: "COGS", value: money(d.cogs) },
        { label: "Gross profit", value: money(d.grossProfit), tone: "up" },
        {
          label: "Net profit",
          value: money(d.netProfit),
          tone: num(d.netProfit) >= 0 ? "up" : "down",
        },
      ],
    };
  }
  if (tab === "Balance Sheet") {
    const rows = [
      ...(d.assets as { account: string; balance: string }[]).map((r) => ({
        account: r.account,
        debit: money(r.balance),
        credit: "—",
        balance: money(r.balance),
        period: "Asset",
      })),
      ...(d.liabilities as { account: string; balance: string }[]).map((r) => ({
        account: r.account,
        debit: "—",
        credit: money(r.balance),
        balance: money(r.balance),
        period: "Liability",
      })),
      ...(d.equity as { account: string; balance: string }[]).map((r) => ({
        account: r.account,
        debit: "—",
        credit: money(r.balance),
        balance: money(r.balance),
        period: "Equity",
      })),
    ];
    return {
      rows,
      stats: [
        { label: "Total assets", value: money(d.totalAssets), tone: "up" },
        { label: "Liabilities + equity", value: money(d.totalLiabilitiesEquity) },
        { label: "Retained profit", value: money(d.netProfit) },
      ],
    };
  }
  if (tab === "Trial Balance") {
    const rows = (
      d.rows as {
        account: string;
        debit: string;
        credit: string;
        balance: string;
        category: string;
      }[]
    ).map((r) => ({
      account: r.account,
      debit: money(r.debit),
      credit: money(r.credit),
      balance: money(r.balance),
      period: statusLabel(r.category),
    }));
    return {
      rows,
      stats: [
        { label: "Total debit", value: money(d.totalDebit) },
        { label: "Total credit", value: money(d.totalCredit) },
        { label: "Accounts", value: String(rows.length) },
      ],
    };
  }
  if (tab === "General Ledger") {
    const rows = (
      d as unknown as {
        id: number;
        debit: string;
        credit: string;
        account: { name: string };
        entry: { entryNo: string; date: string; memo?: string };
      }[]
    ).map((l) => ({
      account: `${l.entry.entryNo} · ${l.account.name}`,
      debit: num(l.debit) ? money(l.debit) : "—",
      credit: num(l.credit) ? money(l.credit) : "—",
      balance: l.entry.memo ?? "—",
      period: fmtDate(l.entry.date),
    }));
    return { rows, stats: [{ label: "Journal lines", value: String(rows.length) }] };
  }
  // Aging
  const aging = d as unknown as {
    rows: { party: string; open: string; ageDays: number; bucket: string }[];
    buckets: Record<string, string>;
  };
  const rows = aging.rows.map((r) => ({
    account: r.party,
    debit: money(r.open),
    credit: "—",
    balance: money(r.open),
    period:
      r.bucket === "current"
        ? "0–30 days"
        : r.bucket === "d30"
          ? "31–60 days"
          : r.bucket === "d60"
            ? "61–90 days"
            : "90+ days",
  }));
  return {
    rows,
    stats: [
      { label: "0–30 days", value: money(aging.buckets?.["current"]) },
      { label: "31–60 days", value: money(aging.buckets?.["d30"]) },
      { label: "61–90 days", value: money(aging.buckets?.["d60"]) },
      { label: "90+ days", value: money(aging.buckets?.["d90plus"]), tone: "down" },
    ],
  };
}
