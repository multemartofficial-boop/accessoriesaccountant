/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronRight, FileText } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { Field, MiniStats, PageHeader, Panel } from "../ui";
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
  const { data, refetch } = useData<unknown>(
    ["report", tab, from, to],
    `${endpoints[tab]}?from=${from}&to=${to}`,
  );

  const stats = reportStats(tab, data);
  const content = reportContent(tab, data);

  const exportCsv = () => {
    const d = data as Record<string, unknown> | unknown[] | undefined;
    let rows: Record<string, unknown>[] = [];
    if (tab === "Balance Sheet" && d && !Array.isArray(d)) {
      for (const [section, list] of [
        ["Asset", (d as any).assets],
        ["Liability", (d as any).liabilities],
        ["Equity", (d as any).equity],
      ] as const) {
        for (const r of arr(list)) {
          rows.push({ section, code: r.code, account: r.account, balance: num(r.balance) });
        }
      }
    } else if (tab === "General Ledger" && Array.isArray(d)) {
      rows = d.map((l: any) => ({
        date: l.entry?.date ? new Date(l.entry.date).toISOString().slice(0, 10) : "",
        entry: l.entry?.entryNo ?? "",
        account: l.account?.name ?? "",
        debit: num(l.debit),
        credit: num(l.credit),
        memo: l.entry?.memo ?? "",
      }));
    } else {
      const list = Array.isArray(d) ? d : arr((d as any)?.rows ?? []);
      rows = list.map((r: any) =>
        Object.fromEntries(
          Object.entries(r).map(([k, v]) => [
            k,
            v && typeof v === "object" ? JSON.stringify(v) : v,
          ]),
        ),
      );
    }
    if (!rows.length) {
      toast.error("Nothing to export for this report");
      return;
    }
    const keys = [...new Set(rows.flatMap((r) => Object.keys(r)))];
    const csv = [keys, ...rows.map((r) => keys.map((k) => String(r[k] ?? "")))]
      .map((line) => line.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${tab.toLowerCase().replaceAll(" ", "-")}-${from}-to-${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${tab} exported (${rows.length} rows)`);
  };

  return (
    <>
      <PageHeader
        eyebrow="Accounting"
        title="Financial reports"
        description="Standard financial statements and account-level analysis."
        action="Export report"
        onAction={exportCsv}
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
          <Button size="sm" className="h-9" onClick={() => refetch()}>
            Run report
          </Button>
        </div>
        <div className="p-4">
          <MiniStats items={stats} />
        </div>
        {content}
      </Panel>
    </>
  );
}

const arr = (v: unknown) => (Array.isArray(v) ? (v as any[]) : []);
const sumOf = (rows: any[], key: string) => rows.reduce((s, r) => s + num(r[key]), 0);
// Compare money amounts at cent precision — float sums are never exactly equal.
const sameAmount = (a: number, b: number) => Math.abs(a - b) < 0.005;
const codeNum = (r: any) => Number(r.code ?? 0);

// P&L grouping: 5100 is COGS, every other expense account is operating.
function pnlGroups(d: any) {
  const rows = arr(d.rows);
  const income = rows.filter((r) => r.category === "INCOME");
  const cogs = rows.filter((r) => r.category === "EXPENSE" && String(r.code) === "5100");
  const opex = rows.filter((r) => r.category === "EXPENSE" && String(r.code) !== "5100");
  const totalIncome = sumOf(income, "net");
  const totalCogs = sumOf(cogs, "net");
  const totalOpex = sumOf(opex, "net");
  const grossProfit = totalIncome - totalCogs;
  return {
    income,
    cogs,
    opex,
    totalIncome,
    totalCogs,
    totalOpex,
    grossProfit,
    netProfit: grossProfit - totalOpex,
  };
}

function balanceSheetGroups(d: any) {
  const assets = arr(d.assets);
  const liabilities = arr(d.liabilities);
  const equity = arr(d.equity);
  // Chart of accounts: x000–x499 current, x500+ non-current.
  const currentAssets = assets.filter((r) => codeNum(r) < 1500);
  const nonCurrentAssets = assets.filter((r) => codeNum(r) >= 1500);
  const currentLiabilities = liabilities.filter((r) => codeNum(r) < 2500);
  const nonCurrentLiabilities = liabilities.filter((r) => codeNum(r) >= 2500);
  const totalAssets = sumOf(assets, "balance");
  const totalLiabilities = sumOf(liabilities, "balance");
  const totalEquity = sumOf(equity, "balance");
  return {
    currentAssets,
    nonCurrentAssets,
    currentLiabilities,
    nonCurrentLiabilities,
    equity,
    totalAssets,
    totalLiabilities,
    totalEquity,
  };
}

function reportStats(
  tab: (typeof reportTabs)[number],
  data: unknown,
): {
  label: string;
  value: string;
  detail?: string;
  tone?: "up" | "down" | "neutral" | "cash" | "stock";
}[] {
  if (!data) return [];
  const d = data as any;

  if (tab === "Profit & Loss") {
    const g = pnlGroups(d);
    return [
      { label: "Revenue", value: money(g.totalIncome), tone: "up" },
      { label: "COGS", value: money(g.totalCogs) },
      {
        label: "Gross profit",
        value: money(g.grossProfit),
        tone: g.grossProfit >= 0 ? "up" : "down",
      },
      { label: "Net profit", value: money(g.netProfit), tone: g.netProfit >= 0 ? "up" : "down" },
    ];
  }

  if (tab === "Balance Sheet") {
    const g = balanceSheetGroups(d);
    return [
      { label: "Total assets", value: money(g.totalAssets), tone: "up" },
      { label: "Liabilities + equity", value: money(g.totalLiabilities + g.totalEquity) },
      {
        label: "Current period earnings",
        value: money(d.netProfit),
        tone: num(d.netProfit) >= 0 ? "up" : "down",
      },
    ];
  }

  if (tab === "Trial Balance") {
    const balanced = sameAmount(num(d.totalDebit), num(d.totalCredit));
    return [
      { label: "Total debit", value: money(d.totalDebit) },
      { label: "Total credit", value: money(d.totalCredit) },
      {
        label: "Accounts",
        value: String(arr(d.rows).length),
        detail: balanced ? "Debits equal credits" : "Debits ≠ credits",
        tone: balanced ? "up" : "down",
      },
    ];
  }

  if (tab === "General Ledger") {
    const lines = arr(d);
    return [
      { label: "Accounts", value: String(new Set(lines.map((l) => l.account?.code)).size) },
      { label: "Journal lines", value: String(lines.length) },
      { label: "Total debit", value: money(sumOf(lines, "debit")) },
      { label: "Total credit", value: money(sumOf(lines, "credit")) },
    ];
  }

  const aging = d as { buckets?: Record<string, string | number> };
  return [
    { label: "0–30 days", value: money(aging.buckets?.["current"]) },
    { label: "31–60 days", value: money(aging.buckets?.["d30"]) },
    { label: "61–90 days", value: money(aging.buckets?.["d60"]) },
    { label: "90+ days", value: money(aging.buckets?.["d90plus"]), tone: "down" },
  ];
}

function reportContent(tab: (typeof reportTabs)[number], data: unknown): ReactNode {
  if (!data) {
    return <div className="p-4 text-sm text-muted-foreground">No data available.</div>;
  }
  const d = data as any;

  switch (tab) {
    case "Profit & Loss":
      return <ProfitAndLoss d={d} />;
    case "Balance Sheet":
      return <BalanceSheet d={d} />;
    case "Trial Balance":
      return <TrialBalance d={d} />;
    case "General Ledger":
      return <GeneralLedger lines={arr(d)} />;
    case "Aging Report":
      return <Aging d={d} />;
    default:
      return null;
  }
}

/* ───────────────────────── Shared statement building blocks ───────────────────────── */

const thClass =
  "h-9 whitespace-nowrap px-4 text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground";

function StatementShell({ children }: { children: ReactNode }) {
  return (
    <div className="p-4 pt-0">
      <div className="overflow-hidden rounded-lg border bg-card shadow-card">{children}</div>
    </div>
  );
}

function StatementHead({
  label = "Account",
  amount = "Amount",
}: {
  label?: string;
  amount?: string;
}) {
  return (
    <div className="flex items-center justify-between border-b bg-table-head">
      <span className={cn(thClass, "flex items-center")}>{label}</span>
      <span className={cn(thClass, "flex items-center")}>{amount}</span>
    </div>
  );
}

function LineRow({ label, amount, level = 1 }: { label: string; amount: number; level?: 1 | 2 }) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b py-2 pr-4 text-sm last:border-b-0",
        level === 1 ? "pl-10" : "pl-14",
      )}
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{money(amount)}</span>
    </div>
  );
}

function SubtotalRow({
  label,
  amount,
  indent = false,
}: {
  label: string;
  amount: number;
  indent?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between border-b border-t bg-surface-subtle py-2 pr-4 text-sm font-semibold",
        indent ? "pl-10" : "pl-4",
      )}
    >
      <span>{label}</span>
      <span className="border-t border-foreground/40 pt-0.5 tabular-nums">{money(amount)}</span>
    </div>
  );
}

function EmphasisRow({ label, amount, tone }: { label: string; amount: number; tone?: "signed" }) {
  return (
    <div className="flex items-center justify-between border-b bg-accent/40 px-4 py-3 text-base font-bold">
      <span>{label}</span>
      <span
        className={cn(
          "tabular-nums",
          tone === "signed" && (amount >= 0 ? "text-success" : "text-destructive"),
        )}
      >
        {money(amount)}
      </span>
    </div>
  );
}

function Group({
  title,
  total,
  children,
  level = 0,
}: {
  title: string;
  total: number;
  children: ReactNode;
  level?: 0 | 1;
}) {
  const [open, setOpen] = useState(true);
  const Icon = open ? ChevronDown : ChevronRight;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "flex w-full items-center justify-between border-b py-2.5 pr-4 text-left text-sm transition-colors hover:bg-accent/55",
          level === 0 ? "pl-4 font-semibold" : "pl-8 font-medium",
        )}
      >
        <span className="flex items-center gap-1.5">
          <Icon className="size-4 text-muted-foreground" />
          {title}
        </span>
        {!open && <span className="tabular-nums text-muted-foreground">{money(total)}</span>}
      </button>
      {open && children}
    </div>
  );
}

function EmptyLine({ text, level = 1 }: { text: string; level?: 1 | 2 }) {
  return (
    <div
      className={cn(
        "border-b py-2 pr-4 text-xs text-muted-foreground",
        level === 1 ? "pl-10" : "pl-14",
      )}
    >
      {text}
    </div>
  );
}

/* ───────────────────────── Profit & Loss ───────────────────────── */

function ProfitAndLoss({ d }: { d: any }) {
  const g = pnlGroups(d);
  const lines = (rows: any[], empty: string) =>
    rows.length === 0 ? (
      <EmptyLine text={empty} />
    ) : (
      rows.map((r) => <LineRow key={r.code} label={r.account} amount={num(r.net)} />)
    );

  return (
    <StatementShell>
      <StatementHead />
      <Group title="Income" total={g.totalIncome}>
        {lines(g.income, "No income recorded in this period.")}
        <SubtotalRow label="Total Income" amount={g.totalIncome} />
      </Group>
      <Group title="Cost of Goods Sold" total={g.totalCogs}>
        {lines(g.cogs, "No cost of goods sold in this period.")}
        <SubtotalRow label="Total COGS" amount={g.totalCogs} />
      </Group>
      <EmphasisRow label="Gross Profit" amount={g.grossProfit} />
      <Group title="Operating Expenses" total={g.totalOpex}>
        {lines(g.opex, "No operating expenses in this period.")}
        <SubtotalRow label="Total Operating Expenses" amount={g.totalOpex} />
      </Group>
      <EmphasisRow label="Net Profit" amount={g.netProfit} tone="signed" />
    </StatementShell>
  );
}

/* ───────────────────────── Balance Sheet ───────────────────────── */

function BalanceSheet({ d }: { d: any }) {
  const g = balanceSheetGroups(d);
  const totalLE = g.totalLiabilities + g.totalEquity;
  const diff = g.totalAssets - totalLE;
  const balanced = sameAmount(g.totalAssets, totalLE);
  const lines = (rows: any[], empty: string) =>
    rows.length === 0 ? (
      <EmptyLine text={empty} level={2} />
    ) : (
      rows.map((r) => <LineRow key={r.code} label={r.account} amount={num(r.balance)} level={2} />)
    );
  const subSum = (rows: any[]) => sumOf(rows, "balance");

  return (
    <StatementShell>
      <StatementHead amount="Balance" />
      <Group title="Assets" total={g.totalAssets}>
        <Group title="Current Assets" total={subSum(g.currentAssets)} level={1}>
          {lines(g.currentAssets, "No current assets.")}
          <SubtotalRow label="Total Current Assets" amount={subSum(g.currentAssets)} indent />
        </Group>
        <Group title="Non-Current Assets" total={subSum(g.nonCurrentAssets)} level={1}>
          {lines(g.nonCurrentAssets, "No fixed / non-current assets.")}
          <SubtotalRow
            label="Total Non-Current Assets"
            amount={subSum(g.nonCurrentAssets)}
            indent
          />
        </Group>
        <EmphasisRow label="Total Assets" amount={g.totalAssets} />
      </Group>
      <Group title="Liabilities" total={g.totalLiabilities}>
        <Group title="Current Liabilities" total={subSum(g.currentLiabilities)} level={1}>
          {lines(g.currentLiabilities, "No current liabilities.")}
          <SubtotalRow
            label="Total Current Liabilities"
            amount={subSum(g.currentLiabilities)}
            indent
          />
        </Group>
        <Group title="Non-Current Liabilities" total={subSum(g.nonCurrentLiabilities)} level={1}>
          {lines(g.nonCurrentLiabilities, "No long-term liabilities.")}
          <SubtotalRow
            label="Total Non-Current Liabilities"
            amount={subSum(g.nonCurrentLiabilities)}
            indent
          />
        </Group>
        <SubtotalRow label="Total Liabilities" amount={g.totalLiabilities} />
      </Group>
      <Group title="Equity" total={g.totalEquity}>
        {g.equity.length === 0 ? (
          <EmptyLine text="No equity accounts." />
        ) : (
          g.equity.map((r) => <LineRow key={r.code} label={r.account} amount={num(r.balance)} />)
        )}
        <SubtotalRow label="Total Equity" amount={g.totalEquity} />
      </Group>
      <EmphasisRow label="Total Liabilities + Equity" amount={totalLE} />
      <div
        className={cn(
          "flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm font-semibold",
          balanced ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive",
        )}
      >
        <span>
          {balanced ? "Books are balanced" : "Books are out of balance"} — Total Assets{" "}
          {money(g.totalAssets)} vs Liabilities + Equity {money(totalLE)}
        </span>
        {!balanced && <span className="tabular-nums">Mismatch: {money(Math.abs(diff))}</span>}
      </div>
    </StatementShell>
  );
}

/* ───────────────────────── Trial Balance ───────────────────────── */

function TrialBalance({ d }: { d: any }) {
  const rows = [...arr(d.rows)].sort((a, b) => codeNum(a) - codeNum(b));
  const totalDebit = num(d.totalDebit);
  const totalCredit = num(d.totalCredit);
  const balanced = sameAmount(totalDebit, totalCredit);

  return (
    <StatementShell>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-table-head">
              <th className={cn(thClass, "text-left")}>Account</th>
              <th className={cn(thClass, "w-36 border-l text-right")}>Debit</th>
              <th className={cn(thClass, "w-36 border-l text-right")}>Credit</th>
              <th className={cn(thClass, "w-36 border-l text-right")}>Balance</th>
              <th className={cn(thClass, "w-28 text-right")}>Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.code} className="border-b last:border-b-0">
                <td className="h-10 px-4">
                  <span className="mr-2 font-mono text-[11px] text-muted-foreground">{r.code}</span>
                  {r.account}
                </td>
                <td className="h-10 border-l px-4 text-right tabular-nums">
                  {num(r.debit) ? money(r.debit) : "—"}
                </td>
                <td className="h-10 border-l px-4 text-right tabular-nums">
                  {num(r.credit) ? money(r.credit) : "—"}
                </td>
                <td className="h-10 border-l px-4 text-right font-semibold tabular-nums">
                  {money(r.balance)}
                </td>
                <td className="h-10 px-4 text-right">
                  <span className="inline-flex rounded-full border border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                    {statusLabel(r.category)}
                  </span>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No journal activity in this period.
                </td>
              </tr>
            )}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-foreground/30 bg-surface-subtle font-bold">
              <td className="h-11 px-4">Total</td>
              <td className="h-11 border-l px-4 text-right tabular-nums">{money(totalDebit)}</td>
              <td className="h-11 border-l px-4 text-right tabular-nums">{money(totalCredit)}</td>
              <td className="h-11 border-l px-4 text-right tabular-nums">
                {money(totalDebit - totalCredit)}
              </td>
              <td className="h-11 px-4 text-right">
                <span
                  className={cn(
                    "inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold",
                    balanced
                      ? "border-success/25 bg-success-soft text-success"
                      : "border-destructive/20 bg-destructive-soft text-destructive",
                  )}
                >
                  {balanced ? "Balanced" : "Unbalanced"}
                </span>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </StatementShell>
  );
}

/* ───────────────────────── General Ledger ───────────────────────── */

const refTypeLabels: Record<string, string> = {
  purchase_invoice: "Purchase invoice",
  sales_invoice: "Sales invoice",
  sales_return: "Sales return",
  supplier_payment: "Supplier payment",
  collection: "Collection",
  cash_transaction: "Cash transaction",
};

function GeneralLedger({ lines }: { lines: any[] }) {
  // Group by account (primary), entries nested chronologically underneath.
  const accounts = new Map<string, { account: any; lines: any[] }>();
  for (const l of lines) {
    const code = String(l.account?.code ?? "—");
    const bucket = accounts.get(code) ?? { account: l.account, lines: [] };
    bucket.lines.push(l);
    accounts.set(code, bucket);
  }
  const sorted = [...accounts.entries()].sort(([a], [b]) => Number(a) - Number(b));

  if (sorted.length === 0) {
    return (
      <div className="p-4 pt-0 text-sm text-muted-foreground">No journal lines in this period.</div>
    );
  }

  return (
    <div className="space-y-4 p-4 pt-0">
      {sorted.map(([code, { account, lines: acctLines }]) => {
        // Liability/equity/income accounts are credit-normal.
        const creditNormal = ["LIABILITY", "EQUITY", "INCOME"].includes(account?.category);
        const ordered = [...acctLines].sort(
          (a, b) =>
            new Date(a.entry?.date).getTime() - new Date(b.entry?.date).getTime() || a.id - b.id,
        );
        let running = 0;
        const totalDebit = sumOf(ordered, "debit");
        const totalCredit = sumOf(ordered, "credit");
        return (
          <section key={code} className="overflow-hidden rounded-lg border bg-card shadow-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11px] text-muted-foreground">{code}</span>
                <h3 className="text-sm font-semibold">{account?.name ?? "Unknown account"}</h3>
                <span className="inline-flex rounded-full border border-border bg-muted px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
                  {statusLabel(account?.category)}
                </span>
              </div>
              <span className="text-[11px] text-muted-foreground">
                {creditNormal ? "Credit-normal" : "Debit-normal"} · {ordered.length} lines
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead>
                  <tr className="border-b bg-table-head">
                    <th className={cn(thClass, "w-28 text-left")}>Date</th>
                    <th className={cn(thClass, "w-28 text-left")}>Entry</th>
                    <th className={cn(thClass, "text-left")}>Source document</th>
                    <th className={cn(thClass, "w-32 border-l text-right")}>Debit</th>
                    <th className={cn(thClass, "w-32 border-l text-right")}>Credit</th>
                    <th className={cn(thClass, "w-36 border-l text-right")}>Running balance</th>
                  </tr>
                </thead>
                <tbody>
                  {ordered.map((l) => {
                    const delta = num(l.debit) - num(l.credit);
                    running += creditNormal ? -delta : delta;
                    return (
                      <tr key={l.id} className="border-b last:border-b-0">
                        <td className="h-10 whitespace-nowrap px-4 tabular-nums">
                          {fmtDate(l.entry?.date)}
                        </td>
                        <td className="h-10 whitespace-nowrap px-4 font-mono text-[11px] text-muted-foreground">
                          {l.entry?.entryNo ?? "—"}
                        </td>
                        <td className="h-10 px-4">
                          <span className="font-medium">{l.entry?.memo ?? "—"}</span>
                          {l.entry?.refType && (
                            <span className="ml-2 text-[11px] text-muted-foreground">
                              {refTypeLabels[l.entry.refType] ?? statusLabel(l.entry.refType)}
                            </span>
                          )}
                        </td>
                        <td className="h-10 border-l px-4 text-right tabular-nums">
                          {num(l.debit) ? money(l.debit) : "—"}
                        </td>
                        <td className="h-10 border-l px-4 text-right tabular-nums">
                          {num(l.credit) ? money(l.credit) : "—"}
                        </td>
                        <td className="h-10 border-l px-4 text-right font-semibold tabular-nums">
                          {money(running)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t bg-surface-subtle font-semibold">
                    <td colSpan={3} className="h-10 px-4">
                      Closing balance — {account?.name}
                    </td>
                    <td className="h-10 border-l px-4 text-right tabular-nums">
                      {money(totalDebit)}
                    </td>
                    <td className="h-10 border-l px-4 text-right tabular-nums">
                      {money(totalCredit)}
                    </td>
                    <td className="h-10 border-l px-4 text-right font-bold tabular-nums">
                      {money(running)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}

/* ───────────────────────── Aging ───────────────────────── */

const bucketDefs = [
  { key: "current", label: "0–30 days", color: "bg-success" },
  { key: "d30", label: "31–60 days", color: "bg-warning" },
  { key: "d60", label: "61–90 days", color: "bg-warning" },
  { key: "d90plus", label: "90+ days", color: "bg-destructive" },
] as const;

function Aging({ d }: { d: any }) {
  const rows = arr(d.rows);
  const buckets: Record<string, string | number> = d.buckets ?? {};
  const total = bucketDefs.reduce((sum, b) => sum + num(buckets[b.key]), 0);

  // Pivot invoice rows into a party × bucket matrix.
  const matrix = new Map<string, Record<string, number>>();
  for (const r of rows) {
    const party = String(r.party);
    const entry = matrix.get(party) ?? { current: 0, d30: 0, d60: 0, d90plus: 0 };
    entry[r.bucket] = (entry[r.bucket] ?? 0) + num(r.open);
    matrix.set(party, entry);
  }
  const parties = [...matrix.entries()]
    .map(([party, b]) => ({ party, b, total: bucketDefs.reduce((s, x) => s + (b[x.key] ?? 0), 0) }))
    .sort((a, b) => b.total - a.total);

  return (
    <div>
      <div className="p-4 pt-0">
        <div className="space-y-4">
          {bucketDefs.map((b) => {
            const amount = num(buckets[b.key]);
            const pct = total > 0 ? (amount / total) * 100 : 0;
            return (
              <div key={b.key} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium">{b.label}</span>
                  <span className="font-semibold tabular-nums">
                    {money(amount)}{" "}
                    <span className="font-normal text-muted-foreground">({pct.toFixed(1)}%)</span>
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                  <div className={`h-full ${b.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
      <StatementShell>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b bg-table-head">
                <th className={cn(thClass, "text-left")}>Party</th>
                {bucketDefs.map((b) => (
                  <th key={b.key} className={cn(thClass, "w-32 border-l text-right")}>
                    {b.label}
                  </th>
                ))}
                <th className={cn(thClass, "w-40 border-l text-right")}>Total Outstanding</th>
              </tr>
            </thead>
            <tbody>
              {parties.map((p) => (
                <tr key={p.party} className="border-b last:border-b-0">
                  <td className="h-10 px-4 font-medium">{p.party}</td>
                  {bucketDefs.map((b) => (
                    <td
                      key={b.key}
                      className={cn(
                        "h-10 border-l px-4 text-right tabular-nums",
                        !p.b[b.key] && "text-muted-foreground",
                        b.key === "d90plus" && p.b[b.key] ? "font-semibold text-destructive" : "",
                      )}
                    >
                      {p.b[b.key] ? money(p.b[b.key]) : "—"}
                    </td>
                  ))}
                  <td className="h-10 border-l px-4 text-right font-bold tabular-nums">
                    {money(p.total)}
                  </td>
                </tr>
              ))}
              {parties.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No outstanding invoices.
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-foreground/30 bg-surface-subtle font-bold">
                <td className="h-11 px-4">Total</td>
                {bucketDefs.map((b) => (
                  <td key={b.key} className="h-11 border-l px-4 text-right tabular-nums">
                    {money(buckets[b.key])}
                  </td>
                ))}
                <td className="h-11 border-l px-4 text-right tabular-nums">{money(total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </StatementShell>
    </div>
  );
}
