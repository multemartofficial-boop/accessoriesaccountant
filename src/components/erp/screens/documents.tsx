import { createContext, useContext, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, PageHeader } from "../ui";
import { api } from "@/lib/api";
import {
  EntitySelect,
  fmtDate,
  ItemsEditor,
  num,
  useData,
  useSave,
  type LineItem,
  type ProductLite,
} from "./shared";

interface Company {
  name?: string;
  legalName?: string;
  logoUrl?: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  vatRegNo?: string;
  tradeLicenseNo?: string;
}

interface DocInvoice {
  type: string;
  company?: Company | null;
  invoice: {
    id: number;
    invNo: string;
    invoiceDate: string;
    dueDate?: string | null;
    subtotal: string;
    discount: string;
    taxTotal: string;
    total: string;
    vatMode?: string;
    brand?: string | null;
    grossWeight?: string | null;
    notes?: string | null;
    buyerId: number;
    buyer: { name: string; code?: string; address?: string; phone?: string };
    salesOrder?: { soNo: string } | null;
    items: {
      productId: number;
      quantity: string;
      rate: string;
      taxAmount: string;
      total: string;
      product: { name: string; sku?: string; unit?: { name: string; code: string } };
    }[];
  };
}

interface DocChalan {
  type: string;
  company?: Company | null;
  chalan: {
    id: number;
    dcNo: string;
    date: string;
    driverName?: string | null;
    vehicleNo?: string | null;
    styleNo?: string | null;
    erpNo?: string | null;
    notes?: string | null;
    buyerId: number;
    buyer: { name: string; code?: string; address?: string; phone?: string };
    warehouse?: { name: string };
    salesOrder?: { soNo: string } | null;
    items: {
      productId: number;
      quantity: string;
      product: { name: string; sku?: string; unit?: { name: string; code: string } };
    }[];
  };
}

// Printed verbatim on every proforma invoice unless the composer overrides them.
const PROFORMA_NOTES = [
  "Complain Should be Brought to our Notice in writing / mail within 7 Days of Delivery of the Goods to You.",
  "Supplied all trims by us has comes under garment accessories by HSN CODE 6217.10.00.",
  "Payment should be made only by RTGS.",
  "If invoice amount less than $1500-must be Paid by the RTGS or FDD only.",
];

const usd = (n: number | string) =>
  `$ ${num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

interface Sources {
  invoices: { id: number; invNo: string }[];
  chalans: { id: number; dcNo: string }[];
}

interface Named {
  id: number;
  name: string;
}

interface CashAccountLite {
  id: number;
  name: string;
  type: string;
  bankName?: string | null;
  accountNo?: string | null;
}

interface SalesOrderLite {
  id: number;
  soNo: string;
  buyer: { id: number; name: string };
  items: { productId: number; quantity: string; rate: string }[];
}

interface TaxRateLite {
  id: number;
  ratePercent: string;
}

export function DocumentsScreen() {
  const [kind, setKind] = useState("Proforma");
  const [docId, setDocId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [brand, setBrand] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [bankId, setBankId] = useState<number | "">("");
  const [mode, setMode] = useState<"browse" | "create" | "edit">("browse");
  const { data: sources } = useData<Sources>(["doc-sources"], "/documents/sources");
  const { data: settings } = useData<Record<string, string>>(["settings"], "/settings");
  const { data: buyers } = useData<Named[]>(["buyers"], "/buyers");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");
  const { data: orders } = useData<SalesOrderLite[]>(["sales-orders"], "/sales/orders");
  const { data: taxRates } = useData<TaxRateLite[]>(["tax-rates"], "/vat/rates");
  const { data: cashAccounts } = useData<CashAccountLite[]>(
    ["cash-accounts"],
    "/cash-bank/accounts",
  );

  const isChalan = kind === "Chalan";
  const list = isChalan ? (sources?.chalans ?? []) : (sources?.invoices ?? []);
  const selectedId = docId ?? list[0]?.id;
  const bankOptions = (cashAccounts ?? []).filter((a) => a.type === "BANK");
  const bankAccount = bankOptions.find((a) => a.id === bankId) ?? bankOptions[0];

  const { data: doc } = useData<DocInvoice | DocChalan>(
    ["document", kind, selectedId],
    isChalan ? `/documents/chalan/${selectedId}` : `/documents/invoice/${selectedId}`,
    Boolean(selectedId),
  );

  const onSaved = (id: number) => {
    setDocId(id);
    setMode("browse");
  };
  const invoiceDoc = doc && !isChalan && "invoice" in doc ? doc : undefined;
  const chalanDoc = doc && isChalan && "chalan" in doc ? doc : undefined;

  // Table header labels are overridable per document (double-click in the
  // preview) and stored as JSON in the key-value settings table.
  const qc = useQueryClient();
  const save = useSave();
  const labelsKey = `doc_headers_${isChalan ? "chalan" : "invoice"}_${selectedId}`;
  const labels = parseLabels(settings?.[labelsKey]);
  const setLabel = (id: string, value: string) => {
    const next = { ...labels };
    if (value) next[id] = value;
    else delete next[id];
    const json = JSON.stringify(next);
    qc.setQueryData<Record<string, string>>(["settings"], (s) => ({ ...s, [labelsKey]: json }));
    void save(api.put("/settings", { [labelsKey]: json }), "Header updated", [["settings"]]);
  };

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Proforma invoice & chalan generator"
        description="Compose commercial documents and verify the exact print layout before issue."
        action="Print"
        onAction={() => window.print()}
      />
      <div className="grid min-h-[670px] overflow-hidden rounded-lg border bg-card shadow-card lg:grid-cols-2">
        <div className="border-r">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex rounded-lg border bg-surface-subtle p-1">
              {["Proforma", "Chalan"].map((k) => (
                <Button
                  type="button"
                  variant={kind === k ? "default" : "ghost"}
                  size="sm"
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setDocId(null);
                    setMode("browse");
                  }}
                >
                  {k}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {mode === "browse" && doc && (
                <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
              <Button
                variant={mode !== "browse" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setMode(mode !== "browse" ? "browse" : "create")}
              >
                <Plus className="size-4" /> {mode !== "browse" ? "Cancel" : "Create new"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </Button>
            </div>
          </div>
          {mode !== "browse" ? (
            !isChalan ? (
              <InvoiceForm
                key={mode === "edit" ? `inv-${selectedId}` : "inv-new"}
                buyers={buyers ?? []}
                products={products ?? []}
                orders={orders ?? []}
                taxRates={taxRates ?? []}
                existing={mode === "edit" ? invoiceDoc?.invoice : undefined}
                onSaved={onSaved}
              />
            ) : (
              <ChalanForm
                key={mode === "edit" ? `dc-${selectedId}` : "dc-new"}
                buyers={buyers ?? []}
                products={products ?? []}
                orders={orders ?? []}
                existing={mode === "edit" ? chalanDoc?.chalan : undefined}
                onSaved={onSaved}
              />
            )
          ) : (
            <div className="p-5">
              <label className="grid gap-1.5 text-xs font-semibold">
                <span>Select {isChalan ? "chalan" : "proforma invoice"}</span>
                <select
                  className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9"
                  value={selectedId ?? ""}
                  onChange={(e) => setDocId(Number(e.target.value))}
                >
                  {list.map((d) => (
                    <option key={d.id} value={d.id}>
                      {"invNo" in d ? d.invNo : d.dcNo}
                    </option>
                  ))}
                </select>
              </label>
              {invoiceDoc && (
                <div className="mt-5 space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer</span>
                    <strong>{invoiceDoc.invoice.buyer.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Issue date</span>
                    <span>{fmtDate(invoiceDoc.invoice.invoiceDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order</span>
                    <span>{invoiceDoc.invoice.salesOrder?.soNo ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lines</span>
                    <span>{invoiceDoc.invoice.items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <strong>{usd(invoiceDoc.invoice.total)}</strong>
                  </div>
                </div>
              )}
              {chalanDoc && (
                <div className="mt-5 space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer</span>
                    <strong>{chalanDoc.chalan.buyer.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{fmtDate(chalanDoc.chalan.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order</span>
                    <span>{chalanDoc.chalan.salesOrder?.soNo ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle</span>
                    <span>{chalanDoc.chalan.vehicleNo ?? "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lines</span>
                    <span>{chalanDoc.chalan.items.length}</span>
                  </div>
                </div>
              )}
              {!isChalan && (
                <div className="mt-4 grid gap-3">
                  <Field
                    label="Buyer (brand) — printed as “Buyer. :”"
                    value={brand}
                    onChange={setBrand}
                    placeholder={invoiceDoc?.invoice.brand ?? "e.g. LAHALLE"}
                  />
                  <Field
                    label="Gross weight"
                    value={grossWeight}
                    onChange={setGrossWeight}
                    placeholder={invoiceDoc?.invoice.grossWeight ?? "e.g. 14 KG"}
                  />
                  <label className="grid gap-1.5 text-xs font-semibold">
                    <span>Bank account (printed in Bank Details)</span>
                    <select
                      className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
                      value={bankAccount?.id ?? ""}
                      onChange={(e) => setBankId(Number(e.target.value))}
                    >
                      {bankOptions.length === 0 && <option value="">No bank account</option>}
                      {bankOptions.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.bankName || a.name}
                          {a.accountNo ? ` · ${a.accountNo}` : ""}
                        </option>
                      ))}
                    </select>
                    <span className="text-[11px] font-normal text-muted-foreground">
                      Add, rename or remove bank accounts under Cash &amp; Bank.
                    </span>
                  </label>
                </div>
              )}
              <label className="mt-4 grid gap-1.5 text-[11px] font-semibold">
                Notes (printed on the document)
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isChalan ? settings?.["doc_chalan_notes"] : PROFORMA_NOTES.join("\n")
                  }
                  className="rounded-lg text-[13px] shadow-none"
                />
              </label>
              <p className="mt-3 text-[11px] text-muted-foreground">
                Company name, logo, address and document text are managed in Settings → Company
                profile / Document templates.
              </p>
            </div>
          )}
        </div>
        <div className="bg-workspace p-4 sm:p-8">
          {mode === "create" ? (
            <div className="mx-auto grid min-h-[600px] max-w-xl place-items-center border bg-background text-xs text-muted-foreground">
              Fill the form on the left — the new document will appear here.
            </div>
          ) : invoiceDoc ? (
            <LabelContext.Provider value={{ labels, setLabel }}>
              <TradeInvoiceTemplate
                title="PROFORMA INVOICE"
                doc={invoiceDoc}
                notes={notes || settings?.["doc_proforma_notes"]}
                brand={brand}
                grossWeight={grossWeight}
                currency="USD"
                bank={bankAccount}
                settings={settings}
              />
            </LabelContext.Provider>
          ) : chalanDoc ? (
            <LabelContext.Provider value={{ labels, setLabel }}>
              <ChalanTemplate doc={chalanDoc} />
            </LabelContext.Provider>
          ) : (
            <div className="mx-auto grid min-h-[600px] max-w-xl place-items-center border bg-background text-xs text-muted-foreground">
              Select a document to preview.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ---------------------------- Editable header labels ---------------------------- */

const LabelContext = createContext<{
  labels: Record<string, string>;
  setLabel?: (id: string, value: string) => void;
}>({ labels: {} });

function parseLabels(json?: string): Record<string, string> {
  try {
    return json ? (JSON.parse(json) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// Double-click to edit; Enter saves (Shift+Enter = new line), Esc cancels,
// clearing the text restores the default label.
function EditableLabel({ id, children }: { id: string; children: string }) {
  const { labels, setLabel } = useContext(LabelContext);
  const value = labels[id] ?? children;
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null || !setLabel)
    return (
      <span
        className={`whitespace-pre-line ${setLabel ? "cursor-text rounded-sm hover:bg-yellow-100 print:hover:bg-transparent" : ""}`}
        title={setLabel ? "Double-click to edit" : undefined}
        onDoubleClick={() => setLabel && setDraft(value)}
      >
        {value}
      </span>
    );

  const commit = () => {
    const next = draft.trim();
    setDraft(null);
    if (next !== value) setLabel(id, next === children ? "" : next);
  };
  return (
    <textarea
      autoFocus
      value={draft}
      rows={Math.max(1, draft.split("\n").length)}
      onChange={(e) => setDraft(e.target.value)}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          commit();
        } else if (e.key === "Escape") setDraft(null);
      }}
      className="w-full resize-none border border-blue-500 bg-white p-0 font-[inherit] [text-align:inherit] text-[inherit] leading-tight outline-none"
    />
  );
}

/* ---------------------------- Sales invoice / proforma (bordered trade template) ---------------------------- */

const CURRENCY_SYMBOL: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€" };

const CURRENCY_MINOR: Record<string, string> = { BDT: "PAISA", USD: "CENT", EUR: "CENT" };

const ONES = [
  "",
  "ONE",
  "TWO",
  "THREE",
  "FOUR",
  "FIVE",
  "SIX",
  "SEVEN",
  "EIGHT",
  "NINE",
  "TEN",
  "ELEVEN",
  "TWELVE",
  "THIRTEEN",
  "FOURTEEN",
  "FIFTEEN",
  "SIXTEEN",
  "SEVENTEEN",
  "EIGHTEEN",
  "NINETEEN",
];
const TENS = ["", "", "TWENTY", "THIRTY", "FORTY", "FIFTY", "SIXTY", "SEVENTY", "EIGHTY", "NINETY"];

function wordsBelow1000(n: number): string {
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  if (hundreds) parts.push(`${ONES[hundreds]!} HUNDRED`);
  const rest = n % 100;
  if (rest >= 20) {
    const t = Math.floor(rest / 10);
    parts.push(rest % 10 ? `${TENS[t]!} ${ONES[rest % 10]!}` : TENS[t]!);
  } else if (rest > 0) {
    parts.push(ONES[rest]!);
  }
  return parts.join(" ");
}

function amountInWords(amount: number, currency: string): string {
  const int = Math.floor(amount);
  const cents = Math.round((amount - int) * 100);
  const scales: [number, string][] = [
    [1_000_000_000, "BILLION"],
    [1_000_000, "MILLION"],
    [1_000, "THOUSAND"],
  ];
  let rest = int;
  const parts: string[] = [];
  for (const [scale, name] of scales) {
    const chunk = Math.floor(rest / scale);
    if (chunk) {
      parts.push(`${wordsBelow1000(chunk)} ${name}`);
      rest %= scale;
    }
  }
  if (rest) parts.push(wordsBelow1000(rest));
  const minor = CURRENCY_MINOR[currency] ?? "CENT";
  const main = parts.length ? parts.join(" ") : "ZERO";
  const centsPart = cents ? ` AND ${minor} ${wordsBelow1000(cents)}` : "";
  return `${currency} ${main}${centsPart} ONLY`;
}

const ddmmyy = (d?: string | Date | null) => {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getFullYear()).slice(-2)}`;
};

const B = "border-black";

function TradeInvoiceTemplate({
  title,
  doc,
  notes,
  brand,
  grossWeight,
  currency = "USD",
  bank,
  settings,
}: {
  title: string;
  doc: DocInvoice;
  notes?: string | undefined;
  brand?: string | undefined;
  grossWeight?: string | undefined;
  currency?: string | undefined;
  bank?: CashAccountLite | undefined;
  settings?: Record<string, string> | undefined;
}) {
  const c = doc.company;
  const inv = doc.invoice;
  const cur = currency || "USD";
  const sym = CURRENCY_SYMBOL[cur] ?? "$";
  const fx = (n: number | string) =>
    `${sym} ${num(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const totalQty = inv.items.reduce((s, i) => s + num(i.quantity), 0);
  const subtotal = num(inv.subtotal);
  const tax = num(inv.taxTotal);
  const less = num(inv.discount);
  const grand = num(inv.total);
  // Composer fields override; otherwise print the values saved on the invoice.
  const brandText = brand || inv.brand || "";
  const weightText = grossWeight || inv.grossWeight || "";
  // Items are priced per piece in the ERP but quoted per dozen on trade
  // documents — rate per dz = unit rate x 12 (PCS units only).
  const ratePerDz = (item: DocInvoice["invoice"]["items"][number]) =>
    item.product.unit?.code === "PCS" ? num(item.rate) * 12 : num(item.rate);

  const bankName = settings?.["bank_name"] || bank?.bankName || bank?.name || "";
  const holder = settings?.["bank_holder"] || c?.legalName || c?.name || "";
  const acNo = settings?.["bank_account_no"] || bank?.accountNo || "";
  const swift = settings?.["bank_swift"] || "";
  const routing = settings?.["bank_routing"] || "";
  const bankAddr = settings?.["bank_address"] || "";

  const parsedNotes = (notes ?? "")
    .split("\n")
    .map((l) =>
      l
        .trim()
        .replace(/^\d+[.)\s-]*/, "")
        .trim(),
    )
    .filter(Boolean);
  const noteLines = parsedNotes.length ? parsedNotes : PROFORMA_NOTES;
  const filler = Math.max(0, 12 - inv.items.length);

  return (
    <div
      id="print-document"
      className="mx-auto max-w-[210mm] bg-white p-4 text-black shadow-print"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      <table className={`w-full border-collapse border-2 ${B} text-[11px]`}>
        <thead>
          {/* Company header */}
          <tr>
            <td colSpan={6} className={`border-b-2 ${B} p-0`}>
              <div className="flex items-stretch">
                <div
                  className={`flex w-44 shrink-0 items-center justify-center border-r-2 ${B} p-2`}
                >
                  {c?.logoUrl ? (
                    <img src={c.logoUrl} alt="logo" className="max-h-16 object-contain" />
                  ) : (
                    <div className="text-center text-base font-bold uppercase leading-5">
                      {c?.name ?? "Company"}
                    </div>
                  )}
                </div>
                <div className="flex-1 px-2 py-2 text-center">
                  <div className="text-[26px] font-bold uppercase leading-8 tracking-wide">
                    {c?.name ?? "Company Name"}
                  </div>
                  <div className="mt-0.5 whitespace-pre-line text-[10px] leading-4">
                    {c?.address}
                    {c?.phone ? `${c?.address ? "  " : ""}PH:- ${c.phone}` : ""}
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold">
                    {c?.tradeLicenseNo ? `TIN NO: ${c.tradeLicenseNo}` : ""}
                    {c?.tradeLicenseNo && c?.vatRegNo ? ", " : ""}
                    {c?.vatRegNo ? `BIN : ${c.vatRegNo}` : ""}
                  </div>
                </div>
              </div>
            </td>
          </tr>
          {/* Title + date */}
          <tr>
            <td
              colSpan={4}
              className={`border-b-2 ${B} px-2 py-1.5 text-[15px] font-bold tracking-wide`}
            >
              {title}
            </td>
            <td
              colSpan={2}
              className={`border-b-2 ${B} px-2 py-1.5 text-right text-[13px] font-bold`}
            >
              Date: {ddmmyy(inv.invoiceDate)}
            </td>
          </tr>
          {/* Consignee + invoice no */}
          <tr>
            <td colSpan={4} className={`border-b-2 ${B} p-2 align-top`}>
              <div>To :</div>
              <div className="mt-1 text-[13px] font-bold uppercase">{inv.buyer.name}</div>
              <div className="mt-0.5 whitespace-pre-line text-[11px] leading-4">
                {inv.buyer.address}
              </div>
              <div className="mt-3 text-[12px] font-semibold">
                Buyer. :{brandText.toUpperCase()}
              </div>
            </td>
            <td colSpan={2} className={`border-b-2 border-l-2 ${B} p-2 align-top`}>
              <div className="text-[13px] font-bold">Invoice No : {inv.invNo}</div>
            </td>
          </tr>
          {/* Item header */}
          <tr className={`border-b-2 ${B}`}>
            <th className={`border-r ${B} w-10 px-1 py-1.5 text-center text-[11px] font-bold`}>
              <EditableLabel id="sl">SL No.</EditableLabel>
            </th>
            <th className={`border-r ${B} px-2 py-1.5 text-left text-[11px] font-bold`}>
              <EditableLabel id="style">Style Name</EditableLabel>
            </th>
            <th className={`border-r ${B} w-24 px-2 py-1.5 text-left text-[11px] font-bold`}>
              <EditableLabel id="item">Item name</EditableLabel>
            </th>
            <th className={`border-r ${B} w-20 px-2 py-1.5 text-right text-[11px] font-bold`}>
              <EditableLabel id="qty">Qty/Pcs</EditableLabel>
            </th>
            <th className={`border-r ${B} w-24 px-2 py-1.5 text-right text-[11px] font-bold`}>
              <EditableLabel id="rate">{`Rate per Dz (${sym})`}</EditableLabel>
            </th>
            <th className={`w-28 px-2 py-1.5 text-right text-[11px] font-bold`}>
              <EditableLabel id="amount">{`Amount in ${cur}(${sym})`}</EditableLabel>
            </th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, i) => (
            <tr key={i} className={`border-b ${B} align-top`}>
              <td className={`border-r ${B} px-1 py-1 text-center`}>{i + 1}.</td>
              <td className={`border-r ${B} whitespace-pre-line break-words px-2 py-1 leading-4`}>
                {item.product.sku || item.product.name}
              </td>
              <td
                className={`border-r ${B} whitespace-pre-line break-words px-2 py-1 font-semibold leading-4`}
              >
                {item.product.name}
              </td>
              <td className={`border-r ${B} px-2 py-1 text-right tabular-nums`}>
                {num(item.quantity)}
              </td>
              <td className={`border-r ${B} px-2 py-1 text-right tabular-nums`}>
                {sym} {ratePerDz(item).toFixed(2)}
              </td>
              <td className="px-2 py-1 text-right tabular-nums">{fx(item.total)}</td>
            </tr>
          ))}
          {Array.from({ length: filler }).map((_, i) => (
            <tr key={`f-${i}`} className={`border-b ${B}`}>
              <td className={`border-r ${B} px-1 py-1`}>&nbsp;</td>
              <td className={`border-r ${B}`} />
              <td className={`border-r ${B}`} />
              <td className={`border-r ${B}`} />
              <td className={`border-r ${B}`} />
              <td />
            </tr>
          ))}
          {/* Totals strip */}
          <tr className={`border-b ${B}`}>
            <td colSpan={3} className={`border-r ${B} px-2 py-1.5 text-center font-semibold`}>
              Total Items {"—".repeat(5) + ">"}
            </td>
            <td className={`border-r ${B} px-2 py-1.5 text-right font-bold tabular-nums`}>
              {totalQty}
            </td>
            <td className={`border-r ${B}`} />
            <td />
          </tr>
          <tr className={`border-b-2 ${B}`}>
            <td colSpan={3} className={`border-r ${B} px-2 py-1.5 text-center font-semibold`}>
              GROSS WEIGHT {"—".repeat(5) + ">"}
            </td>
            <td colSpan={3} className="px-2 py-1.5 font-semibold">
              {weightText}
            </td>
          </tr>
          {/* Bottom: amount-in-words / bank / notes | totals */}
          <tr>
            <td colSpan={4} className="p-2 align-top">
              <div className="text-[11px] font-bold">
                AMOUNT&nbsp;&nbsp;{amountInWords(grand, cur)}.
              </div>
              <div className="mt-1 text-[10px] font-semibold">ALL PRICES IN {cur}</div>
              <div className="mt-2 grid grid-cols-[110px_1fr] gap-y-0.5 text-[11px]">
                <span>Bank Details :</span>
                <span className="font-semibold">{bankName}</span>
                <span>Account Holder</span>
                <span className="font-semibold">{holder}</span>
                <span>A/C No.</span>
                <span>{acNo}</span>
                <span>Swift No.</span>
                <span>{swift}</span>
                <span>Routing No.</span>
                <span>{routing}</span>
                <span className="align-top">Bank Address</span>
                <span className="whitespace-pre-line">{bankAddr}</span>
              </div>
              {noteLines.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold">Notes:-</div>
                  <ol className="mt-0.5 list-decimal pl-4 text-[9.5px] leading-4">
                    {noteLines.map((l, i) => (
                      <li key={i}>{l}</li>
                    ))}
                  </ol>
                </div>
              )}
            </td>
            <td colSpan={2} className={`border-l-2 ${B} p-0 align-top`}>
              <table className="w-full border-collapse text-[11px]">
                <tbody>
                  <tr>
                    <td className="px-2 py-1 text-right font-semibold">Sub Total</td>
                    <td className={`border ${B} w-24 px-2 py-1 text-right tabular-nums`}>
                      {fx(subtotal)}
                    </td>
                  </tr>
                  {tax > 0 && (
                    <tr>
                      <td className="px-2 py-1 text-right font-semibold">VAT</td>
                      <td className={`border ${B} px-2 py-1 text-right tabular-nums`}>{fx(tax)}</td>
                    </tr>
                  )}
                  <tr>
                    <td className="px-2 py-1 text-right font-semibold">Total</td>
                    <td className={`border ${B} px-2 py-1 text-right tabular-nums`}>
                      {fx(subtotal + tax)}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 text-right font-semibold">Less</td>
                    <td className={`border ${B} px-2 py-1 text-right tabular-nums`}>
                      {less ? fx(less) : "0.00"}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-2 py-1 text-right font-bold">Grand Total :</td>
                    <td className={`border ${B} px-2 py-1 text-right font-bold tabular-nums`}>
                      {fx(grand)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-8 px-2 text-right text-[11px] font-semibold italic">
                For {c?.name ?? "Company"}
              </div>
            </td>
          </tr>
          {/* Signature footer */}
          <tr>
            <td colSpan={6} className={`border-t-2 ${B} px-3 pb-2 pt-8`}>
              <div className="flex justify-between text-[11px] font-semibold">
                <span>Merchandiser</span>
                <span>Accounts</span>
                <span>Auth. Sign.</span>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function ChalanTemplate({ doc }: { doc: DocChalan }) {
  const c = doc.company;
  const ch = doc.chalan;
  const total = ch.items.reduce((s, i) => s + num(i.quantity), 0);
  // Printed forms keep a fixed block of ruled rows so the sheet still looks
  // complete when few items ship; longer lists simply overflow to page 2+.
  const filler = Math.max(0, 22 - ch.items.length);
  const qtyCell = "border border-black px-1 py-[3px] text-center align-middle";
  const extraQtyCols = 5;

  return (
    <div
      id="print-document"
      className="mx-auto max-w-[210mm] bg-white p-4 text-black shadow-print"
      style={{ fontFamily: "'Times New Roman', Times, serif" }}
    >
      {/* Top bar — outside the bordered form */}
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <div className="w-1/3">Date : {ddmmyy(ch.date)}</div>
        <div className="w-1/3 text-center text-[16px] font-bold tracking-[0.18em]">
          DELIVERY CHALLAN
        </div>
        <div className="w-1/3 text-right">Challan No : {ch.dcNo}</div>
      </div>

      <table className="w-full border-collapse border border-black text-[11px]">
        <thead>
          {/* To / supplier block */}
          <tr>
            <td colSpan={3} className="border border-black p-2 align-top">
              <div>To :</div>
              <div className="mt-0.5 text-[15px] font-bold uppercase">{ch.buyer.name}</div>
              <div className="whitespace-pre-line uppercase leading-[1.35]">
                {ch.buyer.address ?? ""}
              </div>
              <div className="mt-2 text-[10px]">
                <div>Cell : {ch.buyer.phone ?? ""}</div>
                <div>Style : {ch.styleNo ?? ""}</div>
                <div>ERP NO: {ch.erpNo ?? ch.salesOrder?.soNo ?? ""}</div>
              </div>
            </td>
            <td colSpan={extraQtyCols} className="border border-black p-2 align-top">
              <div className="text-[15px] font-bold uppercase">{c?.name ?? "Company Name"}</div>
              <div className="whitespace-pre-line leading-[1.35]">{c?.address ?? ""}</div>
              <div className="mt-2 text-[10px]">
                <div>Cell : {c?.phone ?? ""}</div>
                <div>TIN NO : {c?.tradeLicenseNo ?? ""}</div>
                <div>BIN : {c?.vatRegNo ?? ""}</div>
              </div>
            </td>
          </tr>
          {/* Column headers: "Item No" groups the quantity columns */}
          <tr>
            <th rowSpan={2} className={`${qtyCell} w-9 font-bold`}>
              <EditableLabel id="sno">S.No.</EditableLabel>
            </th>
            <th rowSpan={2} className="border border-black px-2 py-[3px] text-left font-bold">
              <EditableLabel id="order">Order No.</EditableLabel>
            </th>
            <th
              colSpan={extraQtyCols + 1}
              className="border border-black px-1 py-[2px] text-center font-bold"
            >
              <EditableLabel id="itemNo">Item No</EditableLabel>
            </th>
          </tr>
          <tr>
            <th className={`${qtyCell} w-[11%] font-bold leading-tight`}>
              <EditableLabel id="qty0">{"STICKER\nQty. (Pcs.)"}</EditableLabel>
            </th>
            {Array.from({ length: extraQtyCols }).map((_, i) => (
              <th key={i} className={`${qtyCell} w-[11%] font-bold`}>
                <EditableLabel id={`qty${i + 1}`}>Qty. (Pcs.)</EditableLabel>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {ch.items.map((item, i) => (
            <tr key={i}>
              <td className={qtyCell}>{i + 1}</td>
              <td className="border border-black px-2 py-[3px] uppercase">{item.product.name}</td>
              <td className={qtyCell}>{num(item.quantity)}</td>
              {Array.from({ length: extraQtyCols }).map((_, j) => (
                <td key={j} className={qtyCell} />
              ))}
            </tr>
          ))}
          {Array.from({ length: filler }).map((_, i) => (
            <tr key={`f-${i}`}>
              <td className={qtyCell}>&nbsp;</td>
              <td className="border border-black px-2 py-[3px]" />
              <td className={qtyCell} />
              {Array.from({ length: extraQtyCols }).map((_, j) => (
                <td key={j} className={qtyCell} />
              ))}
            </tr>
          ))}
          {/* Totals */}
          <tr>
            <td colSpan={2} className="border border-black px-2 py-[4px] font-bold">
              Total Qty (Pcs.)= {total.toLocaleString()} pcs
            </td>
            <td className={`${qtyCell} font-bold`}>{total} PCS</td>
            {Array.from({ length: extraQtyCols }).map((_, j) => (
              <td key={j} className={`${qtyCell} font-bold`}>
                00 PCS
              </td>
            ))}
          </tr>
          {/* Bottom band */}
          <tr>
            <td colSpan={2} className="border border-black p-2 align-top">
              <div className="text-[10px] font-semibold">RECEIVER SIGN :</div>
              <div className="mt-10 text-[10px]">Name:</div>
            </td>
            <td colSpan={2} className="border border-black p-2 align-top">
              <div className="text-[9.5px] italic leading-[1.45]">
                Note for any shortage kindly
                <br />
                intimate us within three days.
                <br />
                <br />
                After receiving goods. After that
                <br />
                it is not considerable.
              </div>
            </td>
            <td colSpan={extraQtyCols - 1} className="border border-black p-2 align-bottom">
              <div className="pb-1 text-center">
                <div className="text-[11px] font-semibold italic">{c?.name ?? "Company"}</div>
                <div className="text-[10px] italic">Authorized Signatory</div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------- Create / edit forms --------------------------- */

const isoDate = (d?: string | null) => (d ? new Date(d).toISOString().slice(0, 10) : "");

// Only the queries a document save actually changes — not the whole cache.
const DOC_KEYS: unknown[][] = [["doc-sources"], ["document"], ["products"], ["sales-orders"]];

function InvoiceForm({
  buyers,
  products,
  orders,
  taxRates,
  existing,
  onSaved,
}: {
  buyers: Named[];
  products: ProductLite[];
  orders: SalesOrderLite[];
  taxRates: TaxRateLite[];
  existing?: DocInvoice["invoice"] | undefined;
  onSaved: (id: number) => void;
}) {
  const save = useSave();
  const [saving, setSaving] = useState(false);
  const [invNo, setInvNo] = useState(existing?.invNo ?? "");
  const [buyerId, setBuyerId] = useState<number | "">(existing?.buyerId ?? "");
  const [orderId, setOrderId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>(
    existing?.items.length
      ? existing.items.map((i) => ({
          productId: i.productId,
          quantity: String(num(i.quantity)),
          rate: String(num(i.rate)),
        }))
      : [{ productId: 0, quantity: "", rate: "" }],
  );
  const [discount, setDiscount] = useState(String(num(existing?.discount ?? 0)));
  const [vatMode, setVatMode] = useState(existing?.vatMode ?? "EXCLUSIVE");
  const [brand, setBrand] = useState(existing?.brand ?? "");
  const [grossWeight, setGrossWeight] = useState(existing?.grossWeight ?? "");

  const rateFor = (productId: number) => {
    const taxRateId = products.find((p) => p.id === productId)?.taxRateId;
    return num(taxRates.find((r) => r.id === taxRateId)?.ratePercent);
  };
  const lines = items.filter((i) => i.productId);
  // Auto VAT per line: exclusive adds on top, inclusive is already inside the rate.
  const subtotal = lines.reduce((s, i) => s + num(i.quantity) * num(i.rate), 0);
  const vat = lines.reduce((s, i) => {
    const pct = rateFor(i.productId) / 100;
    const amount = num(i.quantity) * num(i.rate);
    return s + (vatMode === "INCLUSIVE" ? amount - amount / (1 + pct) : amount * pct);
  }, 0);
  const total = subtotal + (vatMode === "EXCLUSIVE" ? vat : 0) - num(discount);

  const pickOrder = (id: number) => {
    setOrderId(id);
    const order = orders.find((o) => o.id === id);
    if (order) {
      setBuyerId(order.buyer.id);
      setItems(
        order.items.map((i) => ({
          productId: i.productId,
          quantity: String(i.quantity),
          rate: String(i.rate),
        })),
      );
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        const payload = {
          invNo: invNo.trim() || null,
          buyerId,
          invoiceDate: v["Invoice date"],
          dueDate: v["Due date"] || null,
          vatMode,
          discount: num(discount),
          brand: brand || null,
          grossWeight: grossWeight || null,
          items: lines.map((i) => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            rate: Number(i.rate),
            taxRateId: products.find((p) => p.id === i.productId)?.taxRateId ?? null,
          })),
        };
        if (saving) return;
        setSaving(true);
        save(
          existing
            ? api
                .put<{ id: number }>(`/sales/invoices/${existing.id}`, payload)
                .then(() => onSaved(existing.id))
            : api
                .post<{ id: number }>("/sales/invoices", {
                  ...payload,
                  salesOrderId: orderId || null,
                })
                .then((inv) => onSaved(inv.id)),
          existing ? "Proforma invoice updated" : "Proforma invoice created",
          DOC_KEYS,
        ).finally(() => setSaving(false));
      }}
      className="space-y-4 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Invoice no."
          value={invNo}
          onChange={setInvNo}
          placeholder={existing ? existing.invNo : "Leave blank to auto-number"}
        />
        <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
        {!existing && (
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Sales order (optional)</span>
            <select
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
              value={orderId}
              onChange={(e) => pickOrder(Number(e.target.value))}
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.soNo} · {o.buyer.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Field
          label="Invoice date"
          name="Invoice date"
          type="date"
          defaultValue={isoDate(existing?.invoiceDate) || new Date().toISOString().slice(0, 10)}
          required
        />
        <Field
          label="Due date"
          name="Due date"
          type="date"
          defaultValue={isoDate(existing?.dueDate)}
        />
        <label className="grid gap-1.5 text-xs font-semibold">
          <span>VAT mode</span>
          <select
            className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
            value={vatMode}
            onChange={(e) => setVatMode(e.target.value)}
          >
            <option>EXCLUSIVE</option>
            <option>INCLUSIVE</option>
          </select>
        </label>
        <Field label="Discount ($)" type="number" value={discount} onChange={setDiscount} />
        <Field label="Buyer brand" value={brand} onChange={setBrand} placeholder="e.g. LAHALLE" />
        <Field
          label="Gross weight"
          value={grossWeight}
          onChange={setGrossWeight}
          placeholder="e.g. 14 KG"
        />
      </div>
      <ItemsEditor products={products} items={items} onChange={setItems} priceField="salesPrice" />
      <div className="rounded-lg border bg-surface-subtle px-4 py-3 text-[12px]">
        <div className="flex justify-end gap-6">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="w-28 text-right font-semibold tabular-nums">{usd(subtotal)}</span>
        </div>
        <div className="flex justify-end gap-6">
          <span className="text-muted-foreground">VAT (auto)</span>
          <span className="w-28 text-right font-semibold tabular-nums">{usd(vat)}</span>
        </div>
        <div className="flex justify-end gap-6">
          <span className="text-muted-foreground">Discount</span>
          <span className="w-28 text-right font-semibold tabular-nums">-{usd(discount)}</span>
        </div>
        <div className="flex justify-end gap-6 border-t pt-1.5">
          <span className="font-semibold">Total</span>
          <span className="w-28 text-right font-bold tabular-nums">{usd(total)}</span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving || !buyerId || lines.length === 0}>
          <Save /> {saving ? "Saving…" : existing ? "Save changes" : "Create proforma invoice"}
        </Button>
      </div>
    </form>
  );
}

function ChalanForm({
  buyers,
  products,
  orders,
  existing,
  onSaved,
}: {
  buyers: Named[];
  products: ProductLite[];
  orders: SalesOrderLite[];
  existing?: DocChalan["chalan"] | undefined;
  onSaved: (id: number) => void;
}) {
  const save = useSave();
  const [saving, setSaving] = useState(false);
  const [buyerId, setBuyerId] = useState<number | "">(existing?.buyerId ?? "");
  const [orderId, setOrderId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>(
    existing?.items.length
      ? existing.items.map((i) => ({
          productId: i.productId,
          quantity: String(num(i.quantity)),
          rate: "0",
        }))
      : [{ productId: 0, quantity: "", rate: "0" }],
  );
  const lines = items.filter((i) => i.productId);

  const pickOrder = (id: number) => {
    setOrderId(id);
    const order = orders.find((o) => o.id === id);
    if (order) {
      setBuyerId(order.buyer.id);
      setItems(
        order.items.map((i) => ({
          productId: i.productId,
          quantity: String(i.quantity),
          rate: "0",
        })),
      );
    }
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        const payload = {
          buyerId,
          date: v["Delivery date"],
          driverName: v["Driver name"] || null,
          vehicleNo: v["Vehicle no."] || null,
          styleNo: v["Style ref"] || null,
          erpNo: v["ERP no."] || null,
          notes: v["Notes"] || null,
          items: lines.map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
        };
        if (saving) return;
        setSaving(true);
        save(
          existing
            ? api
                .put<{ id: number }>(`/sales/chalans/${existing.id}`, payload)
                .then(() => onSaved(existing.id))
            : api
                .post<{ id: number }>("/sales/chalans", {
                  ...payload,
                  salesOrderId: orderId || null,
                })
                .then((ch) => onSaved(ch.id)),
          existing ? "Chalan updated" : "Chalan created",
          DOC_KEYS,
        ).finally(() => setSaving(false));
      }}
      className="space-y-4 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
        {!existing && (
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Sales order (optional)</span>
            <select
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
              value={orderId}
              onChange={(e) => pickOrder(Number(e.target.value))}
            >
              <option value="">None</option>
              {orders.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.soNo} · {o.buyer.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <Field
          label="Delivery date"
          name="Delivery date"
          type="date"
          defaultValue={isoDate(existing?.date) || new Date().toISOString().slice(0, 10)}
          required
        />
        <Field label="Driver name" name="Driver name" defaultValue={existing?.driverName ?? ""} />
        <Field label="Vehicle no." name="Vehicle no." defaultValue={existing?.vehicleNo ?? ""} />
        <Field
          label="Style ref"
          name="Style ref"
          defaultValue={existing?.styleNo ?? ""}
          placeholder="e.g. LH4 PRUNE V2 LKLH26-63 D1"
        />
        <Field
          label="ERP no."
          name="ERP no."
          defaultValue={existing?.erpNo ?? ""}
          placeholder="e.g. LKL-TB-26-22056"
        />
        <Field label="Notes" name="Notes" defaultValue={existing?.notes ?? ""} />
      </div>
      <ItemsEditor
        products={products}
        items={items}
        onChange={setItems}
        priceField="salesPrice"
        showRate={false}
      />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={saving || !buyerId || lines.length === 0}>
          <Save /> {saving ? "Saving…" : existing ? "Save changes" : "Create chalan"}
        </Button>
      </div>
    </form>
  );
}
