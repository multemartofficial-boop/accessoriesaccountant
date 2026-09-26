import { useState } from "react";
import { Mail, MapPin, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ActionDialog,
  DataTable,
  MiniStats,
  PageHeader,
  Panel,
  TabsBar,
  type TableRowData,
} from "../ui";
import { api } from "@/lib/api";
import { fmtDate, money, num, statusLabel, useData, useSave } from "./shared";

interface Party {
  id: number;
  code: string;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  paymentTerms?: string;
  creditLimit?: string;
  status: string;
  outstanding?: string;
  payable?: string;
  openInvoices?: number;
  lastPayment?: { date: string; amount: string } | null;
  netSales?: string;
  netPurchases?: string;
}

interface LedgerEntry {
  id: number;
  date: string;
  refType: string;
  refNo?: string;
  description?: string;
  debit: string;
  credit: string;
  balanceAfter: string;
}

interface HistoryInvoice {
  id: number;
  invNo: string;
  invoiceDate: string;
  status: string;
  total: string;
  paidAmount: string;
}

interface Payment {
  id: number;
  paymentNo: string;
  date: string;
  amount: string;
  method?: string;
}

const partyConfig = {
  buyer: {
    title: "Buyer management",
    entity: "Buyer",
    base: "/buyers",
    description: "Credit control, sales history and account statements for garment manufacturers.",
    tabs: ["Buyer list", "Profile", "Sales history", "Outstanding", "Ledger", "Statement"],
  },
  supplier: {
    title: "Supplier management",
    entity: "Supplier",
    base: "/suppliers",
    description: "Purchase relationships, payable positions and payment histories.",
    tabs: ["Supplier list", "Profile", "Purchase history", "Payable", "Ledger", "Payments"],
  },
};

export function PartyScreen({ kind }: { kind: "buyer" | "supplier" }) {
  const config = partyConfig[kind];
  const [tab, setTab] = useState(config.tabs[0] ?? "Profile");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Party | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const save = useSave();

  const { data: parties } = useData<Party[]>([kind + "s"], config.base);
  const rows = (parties ?? []).map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    contact: p.contactPerson ?? "—",
    terms: p.paymentTerms ?? "—",
    limit: money(p.creditLimit),
    balance: money(kind === "buyer" ? p.outstanding : p.payable),
    status: statusLabel(p.status),
  }));
  const active = (parties ?? []).find((p) => p.id === selectedId) ?? (parties ?? [])[0];
  const { data: detail } = useData<Party>(
    [kind, active?.id, "detail"],
    `${config.base}/${active?.id}`,
    Boolean(active?.id),
  );
  const { data: ledger } = useData<LedgerEntry[]>(
    [kind, active?.id, "ledger"],
    `${config.base}/${active?.id}/ledger`,
    Boolean(active?.id),
  );
  const { data: history } = useData<HistoryInvoice[]>(
    [kind, active?.id, "history"],
    `${config.base}/${active?.id}/history`,
    Boolean(active?.id),
  );
  const { data: payments } = useData<Payment[]>(
    [kind, active?.id, "payments"],
    `${config.base}/${active?.id}/payments`,
    Boolean(active?.id) && kind === "supplier",
  );

  const party = active ? { ...active, ...(detail ?? {}) } : undefined;

  const fields = [
    { label: "Name", name: "name", required: true },
    { label: "Contact person", name: "contactPerson", required: true },
    { label: "Phone", name: "phone", required: true },
    { label: "Email", name: "email", type: "email" },
    { label: "Address", name: "address" },
    {
      label: "Payment terms",
      name: "paymentTerms",
      options: ["Cash", "15 days", "30 days", "45 days"],
    },
    ...(kind === "buyer" ? [{ label: "Credit limit", name: "creditLimit", type: "number" }] : []),
  ];

  return (
    <>
      <PageHeader
        eyebrow={`Partners / ${kind === "buyer" ? "Receivables" : "Payables"}`}
        title={config.title}
        description={config.description}
        action={`Add ${config.entity.toLowerCase()}`}
        onAction={() => {
          setEditing(null);
          setOpen(true);
        }}
      />
      <Panel
        title={`${config.entity} workspace`}
        subtitle="Select a record to inspect its complete account"
      >
        <TabsBar tabs={config.tabs} active={tab} onChange={setTab} />
        {tab.includes("list") ? (
          <DataTable
            columns={[
              { key: "code", label: "Code" },
              { key: "name", label: config.entity },
              { key: "contact", label: "Contact" },
              { key: "terms", label: "Payment terms" },
              { key: "limit", label: "Credit limit", align: "right" },
              {
                key: "balance",
                label: kind === "buyer" ? "Outstanding" : "Payable",
                align: "right",
              },
              { key: "status", label: "Status", status: true },
            ]}
            rows={rows}
            onRowClick={(row) => {
              setSelectedId(Number(row["id"]));
              setTab("Profile");
            }}
            onEdit={(row: TableRowData) => {
              setEditing(parties?.find((p) => p.id === Number(row["id"])) ?? null);
              setOpen(true);
            }}
            onDelete={(row) =>
              save(api.del(`${config.base}/${row["id"]}`), `${config.entity} removed`)
            }
          />
        ) : tab === "Profile" && party ? (
          <PartyProfile
            kind={kind}
            party={party}
            onEdit={() => {
              setEditing(active ?? null);
              setOpen(true);
            }}
          />
        ) : tab === "Sales history" || tab === "Purchase history" ? (
          <HistoryTable kind={kind} history={history} />
        ) : tab === "Ledger" ? (
          <LedgerTable ledger={ledger} />
        ) : tab === "Statement" ? (
          <StatementCard party={party} ledger={ledger} />
        ) : tab === "Payments" ? (
          <PaymentsCard party={party} payments={payments} />
        ) : tab === "Outstanding" || tab === "Payable" ? (
          <OutstandingCard kind={kind} party={party} history={history} />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">
            Select a party from the list to view this section.
          </div>
        )}
      </Panel>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title={`${editing ? "Edit" : "Add"} ${config.entity.toLowerCase()}`}
        description={`Maintain ${config.entity.toLowerCase()} contact and commercial terms.`}
        fields={fields}
        initialValues={
          editing
            ? {
                name: editing.name,
                contactPerson: editing.contactPerson ?? "",
                phone: editing.phone ?? "",
                email: editing.email ?? "",
                address: editing.address ?? "",
                paymentTerms: editing.paymentTerms ?? "",
                creditLimit: String(editing.creditLimit ?? ""),
              }
            : undefined
        }
        onSubmit={(values) =>
          save(
            editing
              ? api.put(`${config.base}/${editing.id}`, {
                  ...values,
                  creditLimit: num(values["creditLimit"]),
                })
              : api.post(config.base, { ...values, creditLimit: num(values["creditLimit"]) }),
            `${config.entity} saved`,
          )
        }
      />
    </>
  );
}

function PartyProfile({
  kind,
  party,
  onEdit,
}: {
  kind: "buyer" | "supplier";
  party: Party;
  onEdit: () => void;
}) {
  const initials = party.name
    .split(" ")
    .slice(0, 2)
    .map((p) => p[0])
    .join("");
  const balanceLabel = kind === "buyer" ? "Outstanding" : "Payable";
  const balanceValue = money(kind === "buyer" ? party.outstanding : party.payable);
  return (
    <div className="bg-workspace/40 p-4 sm:p-5">
      <div className="rounded-lg border bg-card p-5 shadow-card">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
          <div className="flex items-center gap-4">
            <div className="grid size-14 place-items-center rounded-lg bg-primary text-base font-bold text-primary-foreground">
              {initials}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-bold">{party.name}</h2>
                <span className="rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success">
                  {statusLabel(party.status)}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="rounded-full border-destructive/20 bg-destructive-soft px-2.5 py-0.5 text-[11px] font-semibold text-destructive"
                >
                  {balanceLabel}: {balanceValue}
                </Badge>
                <Badge
                  variant="outline"
                  className="rounded-full border-chart-2/25 bg-chart-2/10 px-2.5 py-0.5 text-[11px] font-semibold text-chart-2"
                >
                  Credit limit: {money(party.creditLimit)}
                </Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <UserRound className="size-3.5" />
                  {party.contactPerson ?? "—"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Phone className="size-3.5" />
                  {party.phone ?? "—"}
                </span>
                <span className="flex items-center gap-1.5">
                  <Mail className="size-3.5" />
                  {party.email ?? "—"}
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {party.address ?? "—"}
                </span>
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">
                Payment terms: {party.paymentTerms ?? "—"} · Credit limit:{" "}
                {money(party.creditLimit)}
              </div>
            </div>
          </div>
          <Button variant="outline" size="sm" className="rounded-lg" onClick={onEdit}>
            Edit profile
          </Button>
        </div>
      </div>
      <div className="mt-4">
        <MiniStats
          items={[
            {
              label: balanceLabel,
              value: balanceValue,
              detail: `${party.openInvoices ?? 0} open invoices`,
              tone: "down",
            },
            {
              label: "Credit limit",
              value: money(party.creditLimit),
              detail: `${party.paymentTerms ?? "—"} payment terms`,
            },
            {
              label: kind === "buyer" ? "Net sales" : "Net purchases",
              value: money(kind === "buyer" ? party.netSales : party.netPurchases),
              detail: "All time",
              tone: "up",
            },
          ]}
        />
      </div>
    </div>
  );
}

function HistoryTable({
  kind,
  history,
}: {
  kind: "buyer" | "supplier";
  history: HistoryInvoice[] | undefined;
}) {
  const rows: TableRowData[] = (history ?? []).map((h) => ({
    id: h.id,
    date: fmtDate(h.invoiceDate),
    document: h.invNo,
    status: statusLabel(h.status),
    amount: money(h.total),
    paidBalance: `${money(h.paidAmount)} / ${money(num(h.total) - num(h.paidAmount))}`,
  }));
  return (
    <div className="p-4">
      <DataTable
        searchable
        columns={[
          { key: "date", label: "Date" },
          { key: "document", label: "Document #" },
          { key: "status", label: "Status", status: true },
          { key: "amount", label: "Amount", align: "right" },
          { key: "paidBalance", label: "Paid / Balance", align: "right" },
        ]}
        rows={rows}
      />
    </div>
  );
}

function LedgerTable({ ledger }: { ledger: LedgerEntry[] | undefined }) {
  const entries = ledger ?? [];
  return (
    <div className="p-4">
      <div className="overflow-x-auto rounded-lg border bg-card shadow-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b bg-table-head text-muted-foreground">
              <th className="h-9 whitespace-nowrap px-4 text-left text-[11px] font-bold uppercase tracking-[0.08em]">
                Date
              </th>
              <th className="h-9 whitespace-nowrap px-4 text-left text-[11px] font-bold uppercase tracking-[0.08em]">
                Reference
              </th>
              <th className="h-9 whitespace-nowrap px-4 text-left text-[11px] font-bold uppercase tracking-[0.08em]">
                Description
              </th>
              <th className="h-9 whitespace-nowrap px-4 text-right text-[11px] font-bold uppercase tracking-[0.08em]">
                Debit
              </th>
              <th className="h-9 whitespace-nowrap px-4 text-right text-[11px] font-bold uppercase tracking-[0.08em]">
                Credit
              </th>
              <th className="h-9 whitespace-nowrap border-l-2 border-primary bg-muted/40 px-4 text-right text-[11px] font-bold uppercase tracking-[0.08em]">
                Balance
              </th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-b last:border-b-0">
                <td className="h-11 whitespace-nowrap px-4 tabular-nums">{fmtDate(e.date)}</td>
                <td className="h-11 whitespace-nowrap px-4">{e.refNo ?? e.refType}</td>
                <td className="h-11 whitespace-nowrap px-4">
                  {e.description ?? statusLabel(e.refType)}
                </td>
                <td className="h-11 whitespace-nowrap px-4 text-right tabular-nums">
                  {num(e.debit) ? money(e.debit) : "—"}
                </td>
                <td className="h-11 whitespace-nowrap px-4 text-right tabular-nums">
                  {num(e.credit) ? money(e.credit) : "—"}
                </td>
                <td className="h-11 whitespace-nowrap border-l-2 border-primary bg-muted/40 px-4 text-right text-base font-bold tabular-nums">
                  {money(e.balanceAfter)}
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No ledger entries found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatementCard({
  party,
  ledger,
}: {
  party: Party | undefined;
  ledger: LedgerEntry[] | undefined;
}) {
  // Ledger arrives newest-first; show the statement in chronological order.
  const chronological = [...(ledger ?? [])].reverse();
  const rows = chronological.map((e) => ({
    id: e.id,
    date: fmtDate(e.date),
    reference: e.refNo ?? e.refType,
    debit: num(e.debit) ? money(e.debit) : "—",
    credit: num(e.credit) ? money(e.credit) : "—",
    balance: money(e.balanceAfter),
  }));
  const first = chronological[0];
  const opening = first ? num(first.balanceAfter) - num(first.debit) + num(first.credit) : 0;
  const closing = chronological.length ? num(chronological.at(-1)?.balanceAfter) : opening;
  return (
    <div className="p-4">
      <div className="mx-auto max-w-3xl overflow-hidden rounded-lg border bg-card p-6 shadow-card">
        <div className="border-b pb-4">
          <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
            Account statement
          </div>
          <div className="mt-1 text-lg font-bold">{party?.name ?? "—"}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            Period: All transactions · Generated {fmtDate(new Date())}
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Opening balance</span>
          <span className="font-semibold">{money(opening)}</span>
        </div>
        <div className="mt-4 overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-table-head text-muted-foreground">
                <th className="h-9 whitespace-nowrap px-4 text-left text-[11px] font-bold uppercase tracking-[0.08em]">
                  Date
                </th>
                <th className="h-9 whitespace-nowrap px-4 text-left text-[11px] font-bold uppercase tracking-[0.08em]">
                  Reference
                </th>
                <th className="h-9 whitespace-nowrap px-4 text-right text-[11px] font-bold uppercase tracking-[0.08em]">
                  Debit
                </th>
                <th className="h-9 whitespace-nowrap px-4 text-right text-[11px] font-bold uppercase tracking-[0.08em]">
                  Credit
                </th>
                <th className="h-9 whitespace-nowrap px-4 text-right text-[11px] font-bold uppercase tracking-[0.08em]">
                  Balance
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b last:border-b-0">
                  <td className="h-11 whitespace-nowrap px-4 tabular-nums">{r.date}</td>
                  <td className="h-11 whitespace-nowrap px-4">{r.reference}</td>
                  <td className="h-11 whitespace-nowrap px-4 text-right tabular-nums">{r.debit}</td>
                  <td className="h-11 whitespace-nowrap px-4 text-right tabular-nums">
                    {r.credit}
                  </td>
                  <td className="h-11 whitespace-nowrap px-4 text-right font-semibold tabular-nums">
                    {r.balance}
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-sm text-muted-foreground">
                    No statement rows.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="mt-4 flex items-center justify-between border-t pt-4">
          <span className="font-bold">Closing balance</span>
          <span className="text-lg font-bold text-foreground">{money(closing)}</span>
        </div>
      </div>
    </div>
  );
}

function PaymentsCard({
  party,
  payments,
}: {
  party: Party | undefined;
  payments: Payment[] | undefined;
}) {
  const list = payments ?? [];
  return (
    <div className="p-4">
      {list.length === 0 ? (
        <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
          No payments recorded for this supplier.
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {list.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-lg border bg-card p-4 shadow-card">
              <div className="flex items-center justify-between">
                <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  Payment receipt
                </div>
                <Badge
                  variant="outline"
                  className="rounded-full border-border bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground"
                >
                  {p.method ?? "Payment"}
                </Badge>
              </div>
              <div className="mt-2 text-2xl font-bold">{money(p.amount)}</div>
              <div className="mt-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Date</span>
                  <span className="font-medium">{fmtDate(p.date)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Reference</span>
                  <span className="font-medium">{p.paymentNo}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Party</span>
                  <span className="font-medium">{party?.name ?? "—"}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OutstandingCard({
  kind,
  party,
  history,
}: {
  kind: "buyer" | "supplier";
  party: Party | undefined;
  history: HistoryInvoice[] | undefined;
}) {
  const label = kind === "buyer" ? "Outstanding" : "Payable";
  const total = money(kind === "buyer" ? party?.outstanding : party?.payable);
  const openStatuses = ["UNPAID", "PARTIAL", "OVERDUE"];
  const openRows: TableRowData[] = (history ?? [])
    .filter((h) => openStatuses.includes(h.status.toUpperCase()))
    .map((h) => ({
      id: h.id,
      date: fmtDate(h.invoiceDate),
      document: h.invNo,
      status: statusLabel(h.status),
      balance: money(num(h.total) - num(h.paidAmount)),
    }));

  return (
    <div className="p-4">
      <MiniStats
        items={[
          {
            label,
            value: total,
            detail: `${party?.openInvoices ?? 0} open invoices`,
            tone: "down",
          },
          {
            label: "Open documents",
            value: String(openRows.length),
            detail: "Unpaid / partial / overdue",
          },
          {
            label: "Last payment",
            value: money(party?.lastPayment?.amount),
            detail: fmtDate(party?.lastPayment?.date),
            tone: "up",
          },
        ]}
      />
      <div className="mt-4">
        <h4 className="mb-2 text-sm font-semibold">Open invoices</h4>
        {openRows.length > 0 ? (
          <DataTable
            searchable={false}
            columns={[
              { key: "date", label: "Date" },
              { key: "document", label: "Document #" },
              { key: "status", label: "Status", status: true },
              { key: "balance", label: "Balance", align: "right" },
            ]}
            rows={openRows}
          />
        ) : (
          <div className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
            No open invoices match the selected status filter.
          </div>
        )}
      </div>
    </div>
  );
}
