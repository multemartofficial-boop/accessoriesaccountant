import { useState } from "react";
import { Landmark } from "lucide-react";
import { ActionDialog, DataTable, PageHeader, Panel } from "../ui";
import { api } from "@/lib/api";
import { fmtDate, money, num, statusLabel, useData, useSave } from "./shared";

interface Account {
  id: number;
  name: string;
  type: "CASH" | "BANK";
  bankName?: string;
  balance: string;
  status: string;
}

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
  const save = useSave();
  const { data: accounts } = useData<Account[]>(["cash-accounts"], "/cash-bank/accounts");
  const { data: txns } = useData<Txn[]>(["cash-txns"], "/cash-bank/transactions");

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
          </div>
        ))}
      </div>
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
              t.type === "RECEIPT" || (t.type === "TRANSFER" && t.txnNo.endsWith("-IN"))
                ? money(t.amount)
                : "—",
            payment:
              ["PAYMENT", "ADJUSTMENT"].includes(t.type) ||
              (t.type === "TRANSFER" && !t.txnNo.endsWith("-IN"))
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
            options: ["Receipt", "Payment", "Bank transfer", "Adjustment"],
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
              type: values["type"] === "Bank transfer" ? "TRANSFER" : values["type"]?.toUpperCase(),
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
