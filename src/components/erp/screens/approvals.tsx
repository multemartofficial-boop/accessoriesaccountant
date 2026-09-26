import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "../ui";
import { api } from "@/lib/api";
import { fmtDate, money, statusLabel, useData, useSave } from "./shared";

interface ApprovalRequest {
  id: number;
  entityType: string;
  entityId: number;
  entityRef?: string;
  amount?: string;
  reason?: string;
  status: string;
  createdAt: string;
  requestedBy?: { name: string } | null;
  entity?: Record<string, unknown> | null;
}

const entityLabel: Record<string, string> = {
  PURCHASE_ORDER: "Purchase order",
  SALES_ORDER: "Sales order",
  SALES_DISCOUNT: "Sales discount",
  STOCK_ADJUSTMENT: "Stock adjustment",
  SUPPLIER_PAYMENT: "Supplier payment",
  PAYMENT_COLLECTION: "Payment collection",
  STOCK_TRANSFER: "Stock transfer",
};

export function ApprovalsScreen() {
  const [selected, setSelected] = useState(0);
  const navigate = useNavigate();
  const save = useSave();
  const { data: queue } = useData<ApprovalRequest[]>(["approvals"], "/approvals");
  const items = queue ?? [];
  const current = items[selected];

  const decide = (id: number, action: "approve" | "decline") =>
    save(api.post(`/approvals/${id}/${action}`), `Request ${action}d`);

  return (
    <>
      <PageHeader
        eyebrow="Controls"
        title="Approval workflow"
        description="Review purchase, sales, payment and stock requests awaiting authorization."
        action="Approval rules"
        onAction={() => navigate({ to: "/settings" })}
      />
      <div className="grid min-h-[590px] overflow-hidden rounded-lg border bg-card shadow-card lg:grid-cols-[380px_1fr]">
        <div className="border-r bg-surface-subtle">
          <div className="border-b px-4 py-4 text-[13px] font-semibold">
            Pending queue <span className="ml-1 text-muted-foreground">({items.length})</span>
          </div>
          {items.map((r, i) => (
            <button
              type="button"
              key={r.id}
              onClick={() => setSelected(i)}
              className={`block w-full border-b border-l-2 px-4 py-4 text-left transition-colors ${
                selected === i
                  ? "border-l-primary bg-card"
                  : "border-l-transparent hover:bg-card/70"
              }`}
            >
              <div className="flex justify-between text-[13px] font-semibold">
                <span>{entityLabel[r.entityType] ?? r.entityType}</span>
                <span>{money(r.amount)}</span>
              </div>
              <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
                <span>{r.entityRef ?? `#${r.entityId}`}</span>
                <span>{statusLabel(r.status)}</span>
              </div>
            </button>
          ))}
          {items.length === 0 && (
            <div className="p-8 text-center text-xs text-muted-foreground">
              No pending approvals.
            </div>
          )}
        </div>
        <div className="p-5">
          {current ? (
            <>
              <div className="flex flex-col justify-between gap-4 border-b pb-5 sm:flex-row sm:items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <div className="grid size-9 place-items-center rounded-lg bg-primary/10 text-primary">
                      <ShieldCheck className="size-4" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold">
                        {entityLabel[current.entityType]} · {current.entityRef}
                      </div>
                      <div className="text-[11px] text-muted-foreground">
                        Submitted by {current.requestedBy?.name ?? "System"} ·{" "}
                        {fmtDate(current.createdAt)}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => decide(current.id, "decline")}>
                    <X className="size-4" /> Decline
                  </Button>
                  <Button size="sm" onClick={() => decide(current.id, "approve")}>
                    <Check className="size-4" /> Approve
                  </Button>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-[13px]">
                {current.reason && (
                  <div className="flex justify-between border-b pb-2">
                    <span className="text-muted-foreground">Reason</span>
                    <span>{current.reason}</span>
                  </div>
                )}
                <div className="flex justify-between border-b pb-2">
                  <span className="text-muted-foreground">Amount</span>
                  <span className="font-semibold">{money(current.amount)}</span>
                </div>
                {current.entity && (
                  <pre className="max-h-96 overflow-auto rounded-lg bg-surface-subtle p-4 text-[11px] leading-5">
                    {JSON.stringify(current.entity, null, 2)}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="grid h-full place-items-center text-sm text-muted-foreground">
              Select a request to review.
            </div>
          )}
        </div>
      </div>
    </>
  );
}
