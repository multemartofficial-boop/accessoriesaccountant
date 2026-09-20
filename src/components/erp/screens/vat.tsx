import { useState } from "react";
import { ActionDialog, DataTable, PageHeader, Panel, TabsBar } from "../ui";
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
          <DataTable
            columns={[
              { key: "period", label: "Period" },
              { key: "sales", label: "Taxable sales", align: "right" },
              { key: "output", label: "Output VAT", align: "right" },
              { key: "purchase", label: "Taxable purchase", align: "right" },
              { key: "input", label: "Input VAT", align: "right" },
              { key: "net", label: "Net payable", align: "right" },
            ]}
            rows={(report ?? []).map((r) => ({
              period: periodName(r.period),
              sales: money(r.taxableSales),
              output: money(r.outputVat),
              purchase: money(r.taxablePurchase),
              input: money(r.inputVat),
              net: money(r.netPayable),
            }))}
          />
        ) : (
          <div className="bg-workspace/40 p-5">
            <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
              <Panel
                title="Configured tax rates"
                subtitle="Edit applicable rates and ledger mapping"
              >
                <div className="divide-y">
                  {(rates ?? []).map((rate) => (
                    <div
                      key={rate.id}
                      className="grid items-center gap-3 px-4 py-4 sm:grid-cols-[1fr_70px_110px_80px]"
                    >
                      <div>
                        <div className="text-[13px] font-semibold">{rate.name}</div>
                        <div className="mt-1 text-[11px] text-muted-foreground">
                          {statusLabel(rate.type)} · {rate.code} · from{" "}
                          {fmtDate(rate.effectiveFrom)}
                        </div>
                      </div>
                      <div className="text-sm font-bold">{num(rate.ratePercent)}%</div>
                      <span
                        className={`w-fit rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          rate.status === "ACTIVE"
                            ? "bg-success-soft text-success"
                            : "bg-muted text-muted-foreground"
                        }`}
                      >
                        {statusLabel(rate.status)}
                      </span>
                      <button
                        className="text-left text-[11px] font-semibold text-primary hover:underline"
                        onClick={() => {
                          setEditingRate(rate);
                          dialog.setOpen(true);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  ))}
                </div>
              </Panel>
            </div>
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
