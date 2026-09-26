import { useState } from "react";
import { ActionDialog, PageHeader, Panel, TabsBar } from "../ui";
import { api } from "@/lib/api";
import { fmtDate, money, num, statusLabel, useActionDialog, useData, useSave } from "./shared";

interface TaxRate {
  id: number;
  name: string;
  code: string;
  ratePercent: string;
  type: string;
  effectiveFrom: string;
  status: string;
}

interface VatPeriod {
  period: string;
  taxableSales: string;
  outputVat: string;
  taxablePurchase: string;
  inputVat: string;
  netPayable: string;
}

export function VatTaxScreen() {
  const [tab, setTab] = useState("VAT report");
  const dialog = useActionDialog();
  const save = useSave();
  const { data: report } = useData<VatPeriod[]>(["vat-report"], "/vat/report");
  const { data: rates } = useData<TaxRate[]>(["tax-rates"], "/vat/rates");
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);

  const periodName = (p: string) => {
    const [y, m] = p.split("-");
    return `${new Date(Number(y), Number(m) - 1).toLocaleString("en-GB", { month: "short" })} ${y}`;
  };

  const totals = (report ?? []).reduce(
    (acc, r) => ({
      taxableSales: acc.taxableSales + num(r.taxableSales),
      outputVat: acc.outputVat + num(r.outputVat),
      taxablePurchase: acc.taxablePurchase + num(r.taxablePurchase),
      inputVat: acc.inputVat + num(r.inputVat),
      netPayable: acc.netPayable + num(r.netPayable),
    }),
    { taxableSales: 0, outputVat: 0, taxablePurchase: 0, inputVat: 0, netPayable: 0 },
  );

  const netPosition =
    totals.netPayable > 0 ? "Payable" : totals.netPayable < 0 ? "Receivable" : "Balanced";
  const netPositionClass =
    totals.netPayable > 0
      ? "bg-destructive-soft text-destructive"
      : totals.netPayable < 0
        ? "bg-success-soft text-success"
        : "bg-muted text-muted-foreground";

  const periodBadge = (net: number) => {
    if (net > 0) return { label: "Payable", className: "bg-destructive-soft text-destructive" };
    if (net < 0) return { label: "Receivable", className: "bg-success-soft text-success" };
    return { label: "Balanced", className: "bg-muted text-muted-foreground" };
  };

  const summaryItems = [
    { label: "Total taxable sales", value: money(totals.taxableSales) },
    { label: "Total output VAT", value: money(totals.outputVat) },
    { label: "Total taxable purchase", value: money(totals.taxablePurchase) },
    { label: "Total input VAT", value: money(totals.inputVat) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Compliance"
        title="VAT & tax management"
        description="Configure applicable rates and review VAT collected and paid."
        action="Add tax rate"
        onAction={() => {
          setTab("Tax rate configuration");
          setEditingRate(null);
          dialog.create();
        }}
      />
      <Panel title="Tax workspace">
        <TabsBar tabs={["VAT report", "Tax rate configuration"]} active={tab} onChange={setTab} />
        {tab === "VAT report" ? (
          <div className="bg-workspace/40 p-5">
            <div className="grid gap-5">
              <Panel title="VAT position summary" subtitle="Aggregated across all filing periods">
                <div className="grid grid-cols-2 gap-3 p-4 xl:grid-cols-5">
                  {summaryItems.map((item) => (
                    <div key={item.label} className="rounded-lg border bg-card p-3 shadow-card">
                      <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                        {item.label}
                      </div>
                      <div className="mt-1.5 break-words text-lg font-bold text-foreground sm:text-xl">
                        {item.value}
                      </div>
                    </div>
                  ))}
                  <div className="rounded-lg border bg-card p-3 shadow-card">
                    <div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
                      Net VAT position
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span className="break-words text-lg font-bold text-foreground sm:text-xl">
                        {money(Math.abs(totals.netPayable))}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${netPositionClass}`}
                      >
                        {netPosition}
                      </span>
                    </div>
                  </div>
                </div>
              </Panel>

              <Panel title="Filing periods" subtitle="VAT collected vs recoverable by period">
                {(report ?? []).length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">
                    No VAT periods found.
                  </div>
                ) : (
                  <div className="grid gap-4 p-4 md:grid-cols-2">
                    {(report ?? []).map((r) => {
                      const badge = periodBadge(num(r.netPayable));
                      return (
                        <div key={r.period} className="rounded-lg border bg-card p-4 shadow-card">
                          <div className="flex items-start justify-between gap-3">
                            <div className="text-sm font-semibold">{periodName(r.period)}</div>
                            <span
                              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${badge.className}`}
                            >
                              {badge.label}
                            </span>
                          </div>
                          <div className="mt-4 grid grid-cols-2 gap-3">
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Taxable sales
                              </div>
                              <div className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
                                {money(r.taxableSales)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Output VAT
                              </div>
                              <div className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
                                {money(r.outputVat)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Taxable purchase
                              </div>
                              <div className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
                                {money(r.taxablePurchase)}
                              </div>
                            </div>
                            <div>
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Input VAT
                              </div>
                              <div className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
                                {money(r.inputVat)}
                              </div>
                            </div>
                            <div className="col-span-2">
                              <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                                Net payable
                              </div>
                              <div className="mt-0.5 text-xs font-semibold tabular-nums text-foreground">
                                {money(r.netPayable)}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Panel>
            </div>
          </div>
        ) : (
          <div className="bg-workspace/40 p-5">
            <Panel title="Configured tax rates" subtitle="Edit applicable rates and ledger mapping">
              {(rates ?? []).length === 0 ? (
                <div className="p-6 text-center text-sm text-muted-foreground">
                  No tax rates configured.
                </div>
              ) : (
                <div className="grid gap-4 p-4 md:grid-cols-2">
                  {(rates ?? []).map((rate) => (
                    <div key={rate.id} className="rounded-lg border bg-card p-4 shadow-card">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{rate.name}</div>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {rate.code}
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                            rate.status === "ACTIVE"
                              ? "bg-success-soft text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {statusLabel(rate.status)}
                        </span>
                      </div>

                      <div className="mt-3 text-2xl font-bold text-foreground">
                        {num(rate.ratePercent)}%
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {statusLabel(rate.type)}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          Effective from {fmtDate(rate.effectiveFrom)}
                        </span>
                      </div>

                      <div className="mt-3 flex justify-end">
                        <button
                          className="text-[11px] font-semibold text-primary hover:underline"
                          onClick={() => {
                            setEditingRate(rate);
                            dialog.setOpen(true);
                          }}
                        >
                          Edit
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Panel>
          </div>
        )}
      </Panel>
      <ActionDialog
        open={dialog.open}
        onOpenChange={dialog.setOpen}
        title={editingRate ? "Edit tax rate" : "Add tax rate"}
        description="Configure rate, type and effective date."
        fields={[
          { label: "Name", name: "name", required: true },
          { label: "Code", name: "code", required: true },
          { label: "Rate %", name: "ratePercent", type: "number", required: true },
          {
            label: "Type",
            name: "type",
            options: ["BOTH", "OUTPUT", "INPUT", "DEDUCTION"],
            required: true,
          },
          { label: "Effective from", name: "effectiveFrom", type: "date" },
        ]}
        initialValues={
          editingRate
            ? {
                name: editingRate.name,
                code: editingRate.code,
                ratePercent: String(editingRate.ratePercent),
                type: editingRate.type,
                effectiveFrom: editingRate.effectiveFrom.slice(0, 10),
              }
            : undefined
        }
        onSubmit={(values) =>
          save(
            editingRate
              ? api.put(`/vat/rates/${editingRate.id}`, {
                  ...values,
                  ratePercent: num(values["ratePercent"]),
                })
              : api.post("/vat/rates", { ...values, ratePercent: num(values["ratePercent"]) }),
            "Tax rate saved",
          )
        }
      />
    </>
  );
}
