import { useState } from "react";
import { Mail, MapPin, Phone, UserRound } from "lucide-react";
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
  const { data: payments } = useData<
    { id: number; paymentNo: string; date: string; amount: string; method?: string }[]
  >(
    [kind, active?.id, "payments"],
    `${config.base}/${active?.id}/payments`,
    Boolean(active?.id) && kind === "supplier",
  );

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
        ) : tab === "Profile" && active ? (
          <PartyProfile
            kind={kind}
            party={{ ...active, ...(detail ?? {}) }}
            onEdit={() => {
              setEditing(active);
              setOpen(true);
            }}
          />
        ) : (
          <div className="p-4">
            <MiniStats
              items={[
                {
                  label: kind === "buyer" ? "Outstanding" : "Payable",
                  value: money(kind === "buyer" ? active?.outstanding : active?.payable),
                  tone: "down",
                },
                {
                  label: "Open documents",
                  value: String(detail?.openInvoices ?? 0),
                  detail: "Across current account",
                },
                {
                  label: "Last payment",
                  value: money(detail?.lastPayment?.amount),
                  detail: fmtDate(detail?.lastPayment?.date),
                  tone: "up",
                },
              ]}
            />
            <div className="mt-4">
              <DataTable
                columns={[
                  { key: "ref", label: "Reference" },
                  { key: "details", label: "Details" },
                  { key: "date", label: "Date" },
                  { key: "debit", label: "Debit", align: "right" },
                  { key: "credit", label: "Credit", align: "right" },
                  { key: "balance", label: "Balance", align: "right" },
                ]}
                rows={
                  (tab === "Ledger" || tab === "Statement"
                    ? (ledger ?? []).map((e) => ({
                        ref: e.refNo ?? e.refType,
                        details: e.description ?? statusLabel(e.refType),
                        date: fmtDate(e.date),
                        debit: num(e.debit) ? money(e.debit) : "—",
                        credit: num(e.credit) ? money(e.credit) : "—",
                        balance: money(e.balanceAfter),
                      }))
                    : tab === "Payments"
                      ? (payments ?? []).map((p) => ({
                          ref: p.paymentNo,
                          details: p.method ?? "Payment",
                          date: fmtDate(p.date),
                          debit: money(p.amount),
                          credit: "—",
                          balance: "—",
                        }))
                      : (history ?? []).map((h) => ({
                          ref: h.invNo,
                          details: `Invoice · ${statusLabel(h.status)}`,
                          date: fmtDate(h.invoiceDate),
                          debit: money(h.total),
                          credit: num(h.paidAmount) ? money(h.paidAmount) : "—",
                          balance: money(num(h.total) - num(h.paidAmount)),
                        }))) as TableRowData[]
                }
              />
            </div>
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
              label: kind === "buyer" ? "Outstanding" : "Payable",
              value: money(kind === "buyer" ? party.outstanding : party.payable),
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
