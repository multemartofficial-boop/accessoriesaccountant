import { useState } from "react";
import { Landmark, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ActionDialog, DataTable, PageHeader, Panel } from "../ui";
import { api } from "@/lib/api";
import { fmtDate, money, num, statusLabel, useData, useSave } from "./shared";

interface Account {
  id: number;
  name: string;
  type: "CASH" | "BANK";
  bankName?: string | null;
  accountNo?: string | null;
  balance: string;
  status: string;
}

const ACCOUNT_FIELDS = [
  { label: "Account name", name: "name", required: true },
  { label: "Type", name: "type", options: ["BANK", "CASH"], required: true },
  { label: "Bank name", name: "bankName" },
  { label: "Account no.", name: "accountNo" },
];

interface Txn {
  id: number;
  txnNo: string;
  type: string;
  amount: string;
  date: string;
  particulars?: string;
  reference?: string;
  balanceAfter?: string;
  account: { name: string };
}

export function CashBankScreen() {
  const [open, setOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const save = useSave();
  const { data: accounts } = useData<Account[]>(["cash-accounts"], "/cash-bank/accounts");
  const { data: txns } = useData<Txn[]>(["cash-txns"], "/cash-bank/transactions");

  const openAccount = (a: Account | null) => {
    setEditing(a);
    setAccountOpen(true);
  };
  const removeAccount = (a: Account) => {
    if (!window.confirm(`Remove "${a.name}"? Accounts with transactions are deactivated instead.`))
      return;
    save(api.del(`/cash-bank/accounts/${a.id}`), "Account removed");
  };

  return (
    <>
      <PageHeader
        eyebrow="Treasury"
        title="Cash & bank"
        description="Daily liquidity, manual entries and reconciled account statements."
        action="Add transaction"
        onAction={() => setOpen(true)}
      />
      <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {(accounts ?? []).map((a) => (
          <div
            key={a.id}
            className="rounded-lg border border-l-[3px] border-l-primary bg-card p-4 shadow-card"
          >
            <div className="flex justify-between">
              <div className="text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                {a.type === "CASH" ? "Cash" : "Bank"} account
              </div>
              <Landmark className="size-4 text-primary/60" />
            </div>
            <div className="mt-3 text-xl font-bold">{money(a.balance)}</div>
            <div className="mt-1 text-[13px] text-muted-foreground">{a.name}</div>
            {(a.bankName || a.accountNo) && (
              <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                {[a.bankName, a.accountNo].filter(Boolean).join(" · ")}
              </div>
            )}
            <div className="mt-3 flex gap-1">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => openAccount(a)}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-destructive"
                onClick={() => removeAccount(a)}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            </div>
          </div>
        ))}
        <button
          type="button"
          onClick={() => openAccount(null)}
          className="grid min-h-[120px] place-items-center rounded-lg border border-dashed bg-card text-sm font-semibold text-muted-foreground hover:text-foreground"
        >
          <span className="flex items-center gap-1.5">
            <Plus className="size-4" /> Add account
          </span>
        </button>
      </div>
      <ActionDialog
        open={accountOpen}
        onOpenChange={setAccountOpen}
        title={editing ? "Edit account" : "Add account"}
        description="Cash or bank account used for payments, collections and printed bank details."
        fields={ACCOUNT_FIELDS}
        submitLabel={editing ? "Save changes" : "Add account"}
        initialValues={
          editing
            ? {
                name: editing.name,
                type: editing.type,
                bankName: editing.bankName ?? "",
                accountNo: editing.accountNo ?? "",
              }
            : undefined
        }
        onSubmit={(values) =>
          save(
            editing
              ? api.put(`/cash-bank/accounts/${editing.id}`, values)
              : api.post("/cash-bank/accounts", values),
            editing ? "Account updated" : "Account added",
          )
        }
      />
      <Panel title="Transaction ledger" subtitle="Receipts, payments and running account balances">
        <DataTable
          columns={[
            { key: "ref", label: "Reference" },
            { key: "details", label: "Particulars" },
            { key: "account", label: "Account" },
            { key: "receipt", label: "Receipt", align: "right" },
            { key: "payment", label: "Payment", align: "right" },
            { key: "balance", label: "Balance", align: "right" },
          ]}
          rows={(txns ?? []).map((t) => ({
            ref: t.txnNo,
            details: t.particulars ?? statusLabel(t.type),
            account: t.account.name,
            receipt:
              t.type === "RECEIPT" ||
              ((t.type === "TRANSFER" || t.type === "ADJUSTMENT") && t.txnNo.endsWith("-IN"))
                ? money(t.amount)
                : "—",
            payment:
              ["PAYMENT", "ADJUSTMENT", "TRANSFER"].includes(t.type) && !t.txnNo.endsWith("-IN")
                ? money(t.amount)
                : "—",
            balance: money(t.balanceAfter),
            date: fmtDate(t.date),
          }))}
        />
      </Panel>
      <ActionDialog
        open={open}
        onOpenChange={setOpen}
        title="Add transaction"
        description="Record a receipt, payment, transfer, or adjustment."
        fields={[
          {
            label: "Transaction type",
            name: "type",
            options: [
              "Receipt",
              "Payment",
              "Bank transfer",
              "Adjustment (increase)",
              "Adjustment (decrease)",
            ],
            required: true,
          },
          {
            label: "Account",
            name: "account",
            options: (accounts ?? []).map((a) => a.name),
            required: true,
          },
          {
            label: "To account (transfers)",
            name: "toAccount",
            options: (accounts ?? []).map((a) => a.name),
          },
          { label: "Amount", name: "amount", type: "number", required: true },
          { label: "Date", name: "date", type: "date", required: true },
          { label: "Particulars", name: "particulars" },
          { label: "Reference", name: "reference" },
        ]}
        onSubmit={(values) =>
          save(
            api.post("/cash-bank/transactions", {
              type:
                values["type"] === "Bank transfer"
                  ? "TRANSFER"
                  : values["type"]?.startsWith("Adjustment")
                    ? "ADJUSTMENT"
                    : values["type"]?.toUpperCase(),
              direction: values["type"] === "Adjustment (increase)" ? "IN" : "OUT",
              accountId: accounts?.find((a) => a.name === values["account"])?.id,
              toAccountId: accounts?.find((a) => a.name === values["toAccount"])?.id,
              amount: num(values["amount"]),
              date: values["date"],
              particulars: values["particulars"],
              reference: values["reference"],
            }),
            "Transaction recorded",
          )
        }
      />
    </>
  );
}
