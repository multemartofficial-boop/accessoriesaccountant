import { createContext, Fragment, useContext, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Printer, RotateCcw, Save } from "lucide-react";
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

  const invoiceDoc = doc && !isChalan && "invoice" in doc ? doc : undefined;
  const chalanDoc = doc && isChalan && "chalan" in doc ? doc : undefined;

  // Table header labels are overridable per document (double-click in the
  // preview) and stored as JSON in the key-value settings table. While a new
  // document is being created they live in local state and are saved under
  // the new document's id once it exists.
  const qc = useQueryClient();
  const save = useSave();
  const { data: company } = useData<Company>(["company"], "/settings/company");
  const [draftLabels, setDraftLabels] = useState<Record<string, string>>({});
  const keyFor = (id: number | undefined) => `doc_headers_${isChalan ? "chalan" : "invoice"}_${id}`;
  const persistLabels = (key: string, next: Record<string, string>) => {
    const json = JSON.stringify(next);
    qc.setQueryData<Record<string, string>>(["settings"], (s) => ({ ...s, [key]: json }));
    return save(api.put("/settings", { [key]: json }), "Header updated", [["settings"]]);
  };
  const labels = mode === "create" ? draftLabels : parseLabels(settings?.[keyFor(selectedId)]);
  const writeLabels = (next: Record<string, string>) => {
    if (mode === "create") setDraftLabels(next);
    else void persistLabels(keyFor(selectedId), next);
  };
  const setLabel = (id: string, value: string | null) => {
    const next = { ...labels };
    if (value === null) delete next[id];
    else next[id] = value;
    writeLabels(next);
  };
  const hasEdits = Object.keys(labels).length > 0;
  const changeMode = (next: typeof mode) => {
    setDraftLabels({});
    setMode(next);
  };

  // "Create new" previews an empty sheet so headers can be edited right away.
  const today = new Date().toISOString();
  const blank = { id: 0, buyerId: 0, buyer: { name: "" }, items: [] };
  const previewInvoice: DocInvoice | undefined =
    mode !== "create"
      ? invoiceDoc
      : isChalan
        ? undefined
        : {
            type: "invoice",
            company: company ?? null,
            invoice: {
              ...blank,
              invNo: "",
              invoiceDate: today,
              subtotal: "0",
              discount: "0",
              taxTotal: "0",
              total: "0",
            },
          };
  const previewChalan: DocChalan | undefined =
    mode !== "create"
      ? chalanDoc
      : isChalan
        ? { type: "chalan", company: company ?? null, chalan: { ...blank, dcNo: "", date: today } }
        : undefined;

  const onSaved = (id: number) => {
    if (mode === "create" && Object.keys(draftLabels).length)
      void persistLabels(keyFor(id), draftLabels);
    setDocId(id);
    changeMode("browse");
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
                    changeMode("browse");
                  }}
                >
                  {k}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              {hasEdits && (previewInvoice || previewChalan) && (
                <Button
                  variant="outline"
                  size="sm"
                  title="Restore the original text in every edited cell"
                  onClick={() => writeLabels({})}
                >
                  <RotateCcw className="size-4" /> Reset edits
                </Button>
              )}
              {mode === "browse" && doc && (
                <Button variant="outline" size="sm" onClick={() => setMode("edit")}>
                  <Pencil className="size-4" /> Edit
                </Button>
              )}
              <Button
                variant={mode !== "browse" ? "secondary" : "outline"}
                size="sm"
                onClick={() => changeMode(mode !== "browse" ? "browse" : "create")}
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
                    <span>{invoiceDoc.invoice.salesOrder?.soNo ?? "â€”"}</span>
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
                    <span>{chalanDoc.chalan.salesOrder?.soNo ?? "â€”"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle</span>
                    <span>{chalanDoc.chalan.vehicleNo ?? "â€”"}</span>
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
                    label="Buyer (brand) â€” printed as â€œBuyer. :â€"
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
                          {a.accountNo ? ` Â· ${a.accountNo}` : ""}
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
                Company name, logo, address and document text are managed in Settings â†’ Company
                profile / Document templates.
              </p>
            </div>
          )}
        </div>
        <div className="bg-workspace p-4 sm:p-8">
          {previewInvoice ? (
            <LabelContext.Provider value={{ labels, setLabel }}>
              <TradeInvoiceTemplate
                title="PROFORMA INVOICE"
                doc={previewInvoice}
                notes={notes || settings?.["doc_proforma_notes"]}
                brand={brand}
                grossWeight={grossWeight}
                currency="USD"
                bank={bankAccount}
                settings={settings}
              />
            </LabelContext.Provider>
          ) : previewChalan ? (
            <LabelContext.Provider value={{ labels, setLabel }}>
              <ChalanTemplate doc={previewChalan} />
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
  setLabel?: (id: string, value: string | null) => void;
}>({ labels: {} });

function parseLabels(json?: string): Record<string, string> {
  try {
    return json ? (JSON.parse(json) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

// Double-click to edit; Enter saves (Shift+Enter = new line), Esc cancels.
// An emptied cell stays blank; "Reset edits" restores the original text.
// `block` makes the editable area fill its table cell (needed for empty cells).
function EditableLabel({
  id,
  children = "",
  block,
}: {
  id: string;
  children?: string;
  block?: boolean;
}) {
  const { labels, setLabel } = useContext(LabelContext);
  const value = labels[id] ?? children;
  const [draft, setDraft] = useState<string | null>(null);

  if (draft === null || !setLabel)
    return (
      <span
        className={`whitespace-pre-line ${block ? "block" : value ? "" : "inline-block min-w-[3em]"} ${setLabel ? "cursor-text rounded-sm hover:bg-yellow-100 print:hover:bg-transparent" : ""}`}
        title={setLabel ? "Double-click to edit" : undefined}
        onDoubleClick={() => setLabel && setDraft(value)}
      >
        {value || "\u00a0"}
      </span>
    );

  const commit = () => {
    const next = draft.trim();
    setDraft(null);
    if (next !== value) setLabel(id, next === children ? null : next);
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
      className="w-full min-w-[4em] resize-none border border-blue-500 bg-white p-0 font-[inherit] [text-align:inherit] text-[inherit] leading-tight outline-none"
    />
  );
}

const E = EditableLabel;

/* ---------------------------- Sales invoice / proforma (bordered trade template) ---------------------------- */

const CURRENCY_SYMBOL: Record<string, string> = { BDT: "à§³", USD: "$", EUR: "â‚¬" };

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
  // documents â€” rate per dz = unit rate x 12 (PCS units only).
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
                      <E id="c.logoText">{c?.name ?? "Company"}</E>
                    </div>
                  )}
                </div>
                <div className="flex-1 px-2 py-2 text-center">
                  <div className="text-[26px] font-bold uppercase leading-8 tracking-wide">
                    <E id="c.name">{c?.name ?? "Company Name"}</E>
                  </div>
                  <div className="mt-0.5 whitespace-pre-line text-[10px] leading-4">
                    <E id="c.address">
                      {`${c?.address ?? ""}${c?.phone ? `${c?.address ? "  " : ""}PH:- ${c.phone}` : ""}`}
                    </E>
                  </div>
                  <div className="mt-0.5 text-[11px] font-semibold">
                    <E id="c.tax">
                      {[
                        c?.tradeLicenseNo ? `TIN NO: ${c.tradeLicenseNo}` : "",
                        c?.vatRegNo ? `BIN : ${c.vatRegNo}` : "",
                      ]
                        .filter(Boolean)
                        .join(", ")}
                    </E>
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
              <E id="title">{title}</E>
            </td>
            <td
              colSpan={2}
              className={`border-b-2 ${B} px-2 py-1.5 text-right text-[13px] font-bold`}
            >
              <E id="date">{`Date: ${ddmmyy(inv.invoiceDate)}`}</E>
            </td>
          </tr>
          {/* Consignee + invoice no */}
          <tr>
            <td colSpan={4} className={`border-b-2 ${B} p-2 align-top`}>
              <div>
                <E id="to">To :</E>
              </div>
              <div className="mt-1 text-[13px] font-bold uppercase">
                <E id="buyer.name">{inv.buyer.name}</E>
              </div>
              <div className="mt-0.5 whitespace-pre-line text-[11px] leading-4">
                <E id="buyer.address">{inv.buyer.address ?? ""}</E>
              </div>
              <div className="mt-3 text-[12px] font-semibold">
                <E id="brand">{`Buyer. :${brandText.toUpperCase()}`}</E>
              </div>
            </td>
            <td colSpan={2} className={`border-b-2 border-l-2 ${B} p-2 align-top`}>
              <div className="text-[13px] font-bold">
                <E id="invNo">{`Invoice No : ${inv.invNo}`}</E>
              </div>
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
              <td className={`border-r ${B} px-1 py-1 text-center`}>
                <E id={`r${i}.sl`} block>{`${i + 1}.`}</E>
              </td>
              <td className={`border-r ${B} whitespace-pre-line break-words px-2 py-1 leading-4`}>
                <E id={`r${i}.style`} block>
                  {item.product.sku || item.product.name}
                </E>
              </td>
              <td
                className={`border-r ${B} whitespace-pre-line break-words px-2 py-1 font-semibold leading-4`}
              >
                <E id={`r${i}.item`} block>
                  {item.product.name}
                </E>
              </td>
              <td className={`border-r ${B} px-2 py-1 text-right tabular-nums`}>
                <E id={`r${i}.qty`} block>
                  {String(num(item.quantity))}
                </E>
              </td>
              <td className={`border-r ${B} px-2 py-1 text-right tabular-nums`}>
                <E id={`r${i}.rate`} block>{`${sym} ${ratePerDz(item).toFixed(2)}`}</E>
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                <E id={`r${i}.amount`} block>
                  {fx(item.total)}
                </E>
              </td>
            </tr>
          ))}
          {Array.from({ length: filler }).map((_, i) => (
            <tr key={`f-${i}`} className={`border-b ${B}`}>
              <td className={`border-r ${B} px-1 py-1 text-center`}>
                <E id={`f${i}.sl`} block />
              </td>
              <td className={`border-r ${B} px-2 py-1`}>
                <E id={`f${i}.style`} block />
              </td>
              <td className={`border-r ${B} px-2 py-1 font-semibold`}>
                <E id={`f${i}.item`} block />
              </td>
              <td className={`border-r ${B} px-2 py-1 text-right tabular-nums`}>
                <E id={`f${i}.qty`} block />
              </td>
              <td className={`border-r ${B} px-2 py-1 text-right tabular-nums`}>
                <E id={`f${i}.rate`} block />
              </td>
              <td className="px-2 py-1 text-right tabular-nums">
                <E id={`f${i}.amount`} block />
              </td>
            </tr>
          ))}
          {/* Totals strip */}
          <tr className={`border-b ${B}`}>
            <td colSpan={3} className={`border-r ${B} px-2 py-1.5 text-center font-semibold`}>
              <E id="totalItems.label">{`Total Items ${"â€”".repeat(5)}>`}</E>
            </td>
            <td className={`border-r ${B} px-2 py-1.5 text-right font-bold tabular-nums`}>
              <E id="totalItems.qty" block>
                {String(totalQty)}
              </E>
            </td>
            <td className={`border-r ${B} px-2 py-1.5 text-right font-bold`}>
              <E id="totalItems.rate" block />
            </td>
            <td className="px-2 py-1.5 text-right font-bold">
              <E id="totalItems.amount" block />
            </td>
          </tr>
          <tr className={`border-b-2 ${B}`}>
            <td colSpan={3} className={`border-r ${B} px-2 py-1.5 text-center font-semibold`}>
              <E id="gross.label">{`GROSS WEIGHT ${"â€”".repeat(5)}>`}</E>
            </td>
            <td colSpan={3} className="px-2 py-1.5 font-semibold">
              <E id="gross.value" block>
                {weightText}
              </E>
            </td>
          </tr>
          {/* Bottom: amount-in-words / bank / notes | totals */}
          <tr>
            <td colSpan={4} className="p-2 align-top">
              <div className="text-[11px] font-bold">
                <E id="amountWords">{`AMOUNT\u00a0\u00a0${amountInWords(grand, cur)}.`}</E>
              </div>
              <div className="mt-1 text-[10px] font-semibold">
                <E id="allPrices">{`ALL PRICES IN ${cur}`}</E>
              </div>
              <div className="mt-2 grid grid-cols-[110px_1fr] gap-y-0.5 text-[11px]">
                {(
                  [
                    ["Bank Details :", bankName, true],
                    ["Account Holder", holder, true],
                    ["A/C No.", acNo, false],
                    ["Swift No.", swift, false],
                    ["Routing No.", routing, false],
                    ["Bank Address", bankAddr, false],
                  ] as const
                ).map(([label, value, bold], i) => (
                  <Fragment key={i}>
                    <span className="align-top">
                      <E id={`bank.l${i}`}>{label}</E>
                    </span>
                    <span className={bold ? "font-semibold" : ""}>
                      <E id={`bank.v${i}`} block>
                        {value}
                      </E>
                    </span>
                  </Fragment>
                ))}
              </div>
              {noteLines.length > 0 && (
                <div className="mt-3">
                  <div className="text-[10px] font-semibold">
                    <E id="notes.title">Notes:-</E>
                  </div>
                  <ol className="mt-0.5 list-decimal pl-4 text-[9.5px] leading-4">
                    {noteLines.map((l, i) => (
                      <li key={i}>
                        <E id={`notes.${i}`}>{l}</E>
                      </li>
                    ))}
                  </ol>
                </div>
              )}
            </td>
            <td colSpan={2} className={`border-l-2 ${B} p-0 align-top`}>
              <table className="w-full border-collapse text-[11px]">
                <tbody>
                  {(
                    [
                      ["sub", "Sub Total", fx(subtotal), true],
                      ["vat", "VAT", fx(tax), tax > 0],
                      ["total", "Total", fx(subtotal + tax), true],
                      ["less", "Less", less ? fx(less) : "0.00", true],
                      ["grand", "Grand Total :", fx(grand), true],
                    ] as const
                  )
                    .filter((r) => r[3])
                    .map(([key, label, value]) => {
                      const weight = key === "grand" ? "font-bold" : "font-semibold";
                      return (
                        <tr key={key}>
                          <td className={`px-2 py-1 text-right ${weight}`}>
                            <E id={`${key}.label`}>{label}</E>
                          </td>
                          <td
                            className={`border ${B} w-24 px-2 py-1 text-right tabular-nums ${key === "grand" ? "font-bold" : ""}`}
                          >
                            <E id={`${key}.value`} block>
                              {value}
                            </E>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              <div className="mt-8 px-2 text-right text-[11px] font-semibold italic">
                <E id="forCompany">{`For ${c?.name ?? "Company"}`}</E>
              </div>
            </td>
          </tr>
          {/* Signature footer */}
          <tr>
            <td colSpan={6} className={`border-t-2 ${B} px-3 pb-2 pt-8`}>
              <div className="flex justify-between text-[11px] font-semibold">
                {["Merchandiser", "Accounts", "Auth. Sign."].map((s, i) => (
                  <span key={i}>
                    <E id={`sign.${i}`}>{s}</E>
                  </span>
                ))}
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
      {/* Top bar â€” outside the bordered form */}
      <div className="mb-1 flex items-baseline justify-between text-[13px]">
        <div className="w-1/3">
          <E id="date">{`Date : ${ddmmyy(ch.date)}`}</E>
        </div>
        <div className="w-1/3 text-center text-[16px] font-bold tracking-[0.18em]">
          <E id="title">DELIVERY CHALLAN</E>
        </div>
        <div className="w-1/3 text-right">
          <E id="dcNo">{`Challan No : ${ch.dcNo}`}</E>
        </div>
      </div>

      <table className="w-full border-collapse border border-black text-[11px]">
        <thead>
          {/* To / supplier block */}
          <tr>
            <td colSpan={3} className="border border-black p-2 align-top">
              <div>
                <E id="to">To :</E>
              </div>
              <div className="mt-0.5 text-[15px] font-bold uppercase">
                <E id="buyer.name">{ch.buyer.name}</E>
              </div>
              <div className="whitespace-pre-line uppercase leading-[1.35]">
                <E id="buyer.address">{ch.buyer.address ?? ""}</E>
              </div>
              <div className="mt-2 text-[10px]">
                <div>
                  <E id="buyer.cell">{`Cell : ${ch.buyer.phone ?? ""}`}</E>
                </div>
                <div>
                  <E id="style">{`Style : ${ch.styleNo ?? ""}`}</E>
                </div>
                <div>
                  <E id="erp">{`ERP NO: ${ch.erpNo ?? ch.salesOrder?.soNo ?? ""}`}</E>
                </div>
              </div>
            </td>
            <td colSpan={extraQtyCols} className="border border-black p-2 align-top">
              <div className="text-[15px] font-bold uppercase">
                <E id="c.name">{c?.name ?? "Company Name"}</E>
              </div>
              <div className="whitespace-pre-line leading-[1.35]">
                <E id="c.address">{c?.address ?? ""}</E>
              </div>
              <div className="mt-2 text-[10px]">
                <div>
                  <E id="c.cell">{`Cell : ${c?.phone ?? ""}`}</E>
                </div>
                <div>
                  <E id="c.tin">{`TIN NO : ${c?.tradeLicenseNo ?? ""}`}</E>
                </div>
                <div>
                  <E id="c.bin">{`BIN : ${c?.vatRegNo ?? ""}`}</E>
                </div>
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
              <td className={qtyCell}>
                <E id={`r${i}.sno`} block>
                  {String(i + 1)}
                </E>
              </td>
              <td className="border border-black px-2 py-[3px] uppercase">
                <E id={`r${i}.name`} block>
                  {item.product.name}
                </E>
              </td>
              <td className={qtyCell}>
                <E id={`r${i}.q0`} block>
                  {String(num(item.quantity))}
                </E>
              </td>
              {Array.from({ length: extraQtyCols }).map((_, j) => (
                <td key={j} className={qtyCell}>
                  <E id={`r${i}.q${j + 1}`} block />
                </td>
              ))}
            </tr>
          ))}
          {Array.from({ length: filler }).map((_, i) => (
            <tr key={`f-${i}`}>
              <td className={qtyCell}>
                <E id={`f${i}.sno`} block />
              </td>
              <td className="border border-black px-2 py-[3px] uppercase">
                <E id={`f${i}.name`} block />
              </td>
              {Array.from({ length: extraQtyCols + 1 }).map((_, j) => (
                <td key={j} className={qtyCell}>
                  <E id={`f${i}.q${j}`} block />
                </td>
              ))}
            </tr>
          ))}
          {/* Totals */}
          <tr>
            <td colSpan={2} className="border border-black px-2 py-[4px] font-bold">
              <E id="total.label">{`Total Qty (Pcs.)= ${total.toLocaleString()} pcs`}</E>
            </td>
            <td className={`${qtyCell} font-bold`}>
              <E id="total.q0" block>{`${total} PCS`}</E>
            </td>
            {Array.from({ length: extraQtyCols }).map((_, j) => (
              <td key={j} className={`${qtyCell} font-bold`}>
                <E id={`total.q${j + 1}`} block>
                  00 PCS
                </E>
              </td>
            ))}
          </tr>
          {/* Bottom band */}
          <tr>
            <td colSpan={2} className="border border-black p-2 align-top">
              <div className="text-[10px] font-semibold">
                <E id="receiver">RECEIVER SIGN :</E>
              </div>
              <div className="mt-10 text-[10px]">
                <E id="receiver.name">Name:</E>
              </div>
            </td>
            <td colSpan={2} className="border border-black p-2 align-top">
              <div className="text-[9.5px] italic leading-[1.45]">
                <E id="note">
                  {
                    "Note for any shortage kindly\nintimate us within three days.\n\nAfter receiving goods. After that\nit is not considerable."
                  }
                </E>
              </div>
            </td>
            <td colSpan={extraQtyCols - 1} className="border border-black p-2 align-bottom">
              <div className="pb-1 text-center">
                <div className="text-[11px] font-semibold italic">
                  <E id="c.sign">{c?.name ?? "Company"}</E>
                </div>
                <div className="text-[10px] italic">
                  <E id="sign">Authorized Signatory</E>
                </div>
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

// Only the queries a document save actually changes â€” not the whole cache.
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
                  {o.soNo} Â· {o.buyer.name}
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
          <Save /> {saving ? "Savingâ€¦" : existing ? "Save changes" : "Create proforma invoice"}
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
                  {o.soNo} Â· {o.buyer.name}
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
          <Save /> {saving ? "Savingâ€¦" : existing ? "Save changes" : "Create chalan"}
        </Button>
      </div>
    </form>
  );
}
