import { useState } from "react";
import { Plus, Printer, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Field, PageHeader, SelectField } from "../ui";
import { api } from "@/lib/api";
import {
  EntitySelect,
  fmtDate,
  ItemsEditor,
  money,
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
    invNo: string;
    invoiceDate: string;
    dueDate?: string;
    subtotal: string;
    discount: string;
    taxTotal: string;
    total: string;
    vatMode?: string;
    buyer: { name: string; code?: string; address?: string; phone?: string };
    salesOrder?: { soNo: string } | null;
    items: {
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
    dcNo: string;
    date: string;
    driverName?: string;
    vehicleNo?: string;
    notes?: string;
    buyer: { name: string; code?: string; address?: string; phone?: string };
    warehouse?: { name: string };
    salesOrder?: { soNo: string } | null;
    items: {
      quantity: string;
      product: { name: string; sku?: string; unit?: { name: string; code: string } };
    }[];
  };
}

interface Sources {
  invoices: { id: number; invNo: string }[];
  chalans: { id: number; dcNo: string }[];
}

const INVOICE_ACCENT = "#2f4f8f";
const CHALAN_ACCENT = "#e8912d";

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
  const [kind, setKind] = useState("Invoice");
  const [docId, setDocId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [brand, setBrand] = useState("");
  const [grossWeight, setGrossWeight] = useState("");
  const [mode, setMode] = useState<"browse" | "create">("browse");
  const { data: sources } = useData<Sources>(["doc-sources"], "/documents/sources");
  const { data: settings } = useData<Record<string, string>>(["settings"], "/settings");
  const { data: buyers } = useData<Named[]>(["buyers"], "/buyers");
  const { data: warehouses } = useData<Named[]>(["warehouses"], "/warehouses");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");
  const { data: orders } = useData<SalesOrderLite[]>(["sales-orders"], "/sales/orders");
  const { data: taxRates } = useData<TaxRateLite[]>(["tax-rates"], "/vat/rates");
  const { data: cashAccounts } = useData<CashAccountLite[]>(
    ["cash-accounts"],
    "/cash-bank/accounts",
  );

  const isChalan = kind === "Chalan";
  const isProforma = kind === "Proforma";
  const list = isChalan ? (sources?.chalans ?? []) : (sources?.invoices ?? []);
  const selectedId = docId ?? list[0]?.id;
  const bankAccount = (cashAccounts ?? []).find((a) => a.type === "BANK");

  const { data: doc } = useData<DocInvoice | DocChalan>(
    ["document", kind, selectedId],
    isChalan ? `/documents/chalan/${selectedId}` : `/documents/invoice/${selectedId}`,
    Boolean(selectedId) && mode === "browse",
  );

  const onCreated = (id: number) => {
    setDocId(id);
    setMode("browse");
  };

  return (
    <>
      <PageHeader
        eyebrow="Documents"
        title="Invoice & chalan generator"
        description="Compose commercial documents and verify the exact print layout before issue."
        action="Print"
        onAction={() => window.print()}
      />
      <div className="grid min-h-[670px] overflow-hidden rounded-lg border bg-card shadow-card lg:grid-cols-2">
        <div className="border-r">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <div className="flex rounded-lg border bg-surface-subtle p-1">
              {["Invoice", "Proforma", "Chalan"].map((k) => (
                <Button
                  type="button"
                  variant={kind === k ? "default" : "ghost"}
                  size="sm"
                  key={k}
                  onClick={() => {
                    setKind(k);
                    setDocId(null);
                  }}
                >
                  {k}
                </Button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button
                variant={mode === "create" ? "secondary" : "outline"}
                size="sm"
                onClick={() => setMode(mode === "create" ? "browse" : "create")}
              >
                <Plus className="size-4" /> {mode === "create" ? "Cancel" : "Create new"}
              </Button>
              <Button variant="outline" size="sm" onClick={() => window.print()}>
                <Printer className="size-4" /> Print
              </Button>
            </div>
          </div>
          {mode === "create" ? (
            !isChalan ? (
              <InvoiceCreateForm
                buyers={buyers ?? []}
                products={products ?? []}
                orders={orders ?? []}
                taxRates={taxRates ?? []}
                onCreated={onCreated}
              />
            ) : (
              <ChalanCreateForm
                buyers={buyers ?? []}
                warehouses={warehouses ?? []}
                products={products ?? []}
                orders={orders ?? []}
                onCreated={onCreated}
              />
            )
          ) : (
            <div className="p-5">
              <label className="grid gap-1.5 text-xs font-semibold">
                <span>Select {isChalan ? "chalan" : "invoice"}</span>
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
              {doc && !isChalan && "invoice" in doc && (
                <div className="mt-5 space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer</span>
                    <strong>{doc.invoice.buyer.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Issue date</span>
                    <span>{fmtDate(doc.invoice.invoiceDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order</span>
                    <span>{doc.invoice.salesOrder?.soNo ?? "â€”"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lines</span>
                    <span>{doc.invoice.items.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total</span>
                    <strong>{money(doc.invoice.total)}</strong>
                  </div>
                </div>
              )}
              {doc && isChalan && "chalan" in doc && (
                <div className="mt-5 space-y-2 text-[13px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Buyer</span>
                    <strong>{doc.chalan.buyer.name}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Date</span>
                    <span>{fmtDate(doc.chalan.date)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Order</span>
                    <span>{doc.chalan.salesOrder?.soNo ?? "â€”"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Vehicle</span>
                    <span>{doc.chalan.vehicleNo ?? "â€”"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Lines</span>
                    <span>{doc.chalan.items.length}</span>
                  </div>
                </div>
              )}
              {isProforma && (
                <div className="mt-4 grid gap-3">
                  <Field
                    label="Buyer (brand) — printed as “Buyer. :”"
                    value={brand}
                    onChange={setBrand}
                    placeholder="e.g. LAHALLE"
                  />
                  <Field
                    label="Gross weight"
                    value={grossWeight}
                    onChange={setGrossWeight}
                    placeholder="e.g. 14 KG"
                  />
                </div>
              )}
              <label className="mt-4 grid gap-1.5 text-[11px] font-semibold">
                Notes (printed on the document)
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isChalan
                      ? settings?.["doc_chalan_notes"]
                      : isProforma
                        ? settings?.["doc_proforma_notes"]
                        : settings?.["doc_invoice_terms"]
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
          {mode === "create" ? (
            <div className="mx-auto grid min-h-[600px] max-w-xl place-items-center border bg-background text-xs text-muted-foreground">
              Fill the form on the left â€” the new document will appear here.
            </div>
          ) : doc && !isChalan && "invoice" in doc ? (
            isProforma ? (
              <ProformaTemplate
                doc={doc}
                notes={notes || settings?.["doc_proforma_notes"]}
                brand={brand}
                grossWeight={grossWeight}
                currency={settings?.["currency"] ?? "USD"}
                bank={bankAccount}
                settings={settings}
              />
            ) : (
              <InvoiceTemplate
                doc={doc}
                notes={notes || settings?.["doc_invoice_terms"]}
                footer={settings?.["doc_invoice_footer"]}
              />
            )
          ) : doc && isChalan && "chalan" in doc ? (
            <ChalanTemplate
              doc={doc}
              notes={notes || doc.chalan.notes || settings?.["doc_chalan_notes"]}
              chalanType={settings?.["doc_chalan_type"] ?? "Delivery"}
            />
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

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Tax invoice (blue template) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

function InvoiceTemplate({
  doc,
  notes,
  footer,
}: {
  doc: DocInvoice;
  notes?: string | undefined;
  footer?: string | undefined;
}) {
  const c = doc.company;
  const inv = doc.invoice;
  const taxable = num(inv.subtotal) - num(inv.discount);

  return (
    <div
      id="print-document"
      className="mx-auto max-w-xl bg-white p-8 text-black shadow-print"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          {c?.logoUrl && <img src={c.logoUrl} alt="logo" className="mb-2 h-10 object-contain" />}
          <div className="text-2xl font-bold" style={{ color: INVOICE_ACCENT }}>
            {c?.name ?? "Company Name"}
          </div>
          <div className="mt-2 text-[10px] leading-4 text-gray-600">
            {c?.address?.split("\n").map((l, i) => (
              <div key={i}>{l}</div>
            ))}
            {c?.phone && <div>Phone: {c.phone}</div>}
            {c?.email && <div>{c.email}</div>}
            {c?.website && <div>Website: {c.website}</div>}
            {c?.vatRegNo && <div>BIN: {c.vatRegNo}</div>}
            {c?.tradeLicenseNo && <div>Trade License: {c.tradeLicenseNo}</div>}
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold" style={{ color: INVOICE_ACCENT }}>
            INVOICE
          </div>
          <table className="ml-auto mt-3 border-collapse text-[10px]">
            <tbody>
              {[
                ["DATE", fmtDate(inv.invoiceDate)],
                ["INVOICE #", inv.invNo],
                ["CUSTOMER ID", inv.buyer.code ?? "â€”"],
                ["DUE DATE", inv.dueDate ? fmtDate(inv.dueDate) : "â€”"],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td
                    className="border border-gray-300 px-2 py-1 text-left font-semibold"
                    style={{ color: INVOICE_ACCENT }}
                  >
                    {k}
                  </td>
                  <td className="border border-gray-300 px-2 py-1 text-right">{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bill to */}
      <div className="mt-6">
        <div
          className="px-2 py-1 text-[10px] font-bold text-white"
          style={{ background: INVOICE_ACCENT }}
        >
          BILL TO
        </div>
        <div className="mt-1 text-[11px] leading-5">
          <div className="font-semibold">{inv.buyer.name}</div>
          <div>{inv.buyer.address ?? ""}</div>
          <div>{inv.buyer.phone ?? ""}</div>
        </div>
      </div>

      {/* Items */}
      <table className="mt-5 w-full border-collapse text-[10px]">
        <thead>
          <tr style={{ background: INVOICE_ACCENT }}>
            <th className="px-2 py-1.5 text-left font-bold text-white">DESCRIPTION</th>
            <th className="w-14 px-2 py-1.5 text-center font-bold text-white">QTY</th>
            <th className="w-20 px-2 py-1.5 text-right font-bold text-white">RATE</th>
            <th className="w-14 px-2 py-1.5 text-center font-bold text-white">TAXED</th>
            <th className="w-24 px-2 py-1.5 text-right font-bold text-white">AMOUNT</th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 ? "#f3f5f9" : "#fff" }}>
              <td className="px-2 py-1.5">
                {item.product.name}
                {item.product.sku && <span className="text-gray-500"> Â· {item.product.sku}</span>}
              </td>
              <td className="px-2 py-1.5 text-center">{num(item.quantity).toLocaleString()}</td>
              <td className="px-2 py-1.5 text-right">{money(item.rate)}</td>
              <td className="px-2 py-1.5 text-center">{num(item.taxAmount) > 0 ? "X" : ""}</td>
              <td className="px-2 py-1.5 text-right">{money(item.total)}</td>
            </tr>
          ))}
          {Array.from({ length: Math.max(0, 6 - inv.items.length) }).map((_, i) => (
            <tr
              key={`empty-${i}`}
              style={{ background: (inv.items.length + i) % 2 ? "#f3f5f9" : "#fff" }}
            >
              <td className="px-2 py-1.5">&nbsp;</td>
              <td />
              <td />
              <td />
              <td />
            </tr>
          ))}
        </tbody>
      </table>

      {/* Comments + totals */}
      <div className="mt-4 flex gap-4">
        <div className="flex-1">
          <div
            className="px-2 py-1 text-[10px] font-bold text-white"
            style={{ background: INVOICE_ACCENT }}
          >
            OTHER COMMENTS
          </div>
          <div className="mt-1 whitespace-pre-line text-[10px] leading-4 text-gray-700">
            {notes || "1. Payment due within the agreed terms."}
          </div>
        </div>
        <table className="w-56 border-collapse text-[10px]">
          <tbody>
            <tr>
              <td className="px-2 py-1 text-right font-semibold">Subtotal</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{money(inv.subtotal)}</td>
            </tr>
            {num(inv.discount) > 0 && (
              <tr>
                <td className="px-2 py-1 text-right font-semibold">Discount</td>
                <td className="border border-gray-300 px-2 py-1 text-right">
                  -{money(inv.discount)}
                </td>
              </tr>
            )}
            <tr>
              <td className="px-2 py-1 text-right font-semibold">Taxable</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{money(taxable)}</td>
            </tr>
            <tr>
              <td className="px-2 py-1 text-right font-semibold">VAT</td>
              <td className="border border-gray-300 px-2 py-1 text-right">{money(inv.taxTotal)}</td>
            </tr>
            <tr>
              <td
                className="px-2 py-1.5 text-right font-bold text-white"
                style={{ background: INVOICE_ACCENT }}
              >
                TOTAL
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-right font-bold">
                {money(inv.total)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-6 text-[10px]">
        Make all cheques payable to <strong>{c?.legalName ?? c?.name ?? "Company Name"}</strong>
      </div>
      <div className="mt-8 text-center text-[10px] italic">
        {footer ?? "Thank you for your business!"}
      </div>
      {c?.phone && (
        <div className="mt-1 text-center text-[9px] text-gray-500">
          If you have any questions about this invoice, please contact {c.phone}
          {c.email ? `, ${c.email}` : ""}
        </div>
      )}
    </div>
  );
}

/* â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ Delivery chalan (amber template) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */

/* ------------------- Proforma invoice (bordered trade template) ------------------- */

const CURRENCY_SYMBOL: Record<string, string> = { BDT: "৳", USD: "$", EUR: "€" };
const CURRENCY_MAJOR: Record<string, string> = { BDT: "TAKA", USD: "DOLLARS", EUR: "EUROS" };
const CURRENCY_MINOR: Record<string, string> = { BDT: "PAISA", USD: "CENTS", EUR: "CENTS" };

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
  const major = CURRENCY_MAJOR[currency] ?? "";
  const minor = CURRENCY_MINOR[currency] ?? "CENTS";
  const main = parts.length ? parts.join(" ") : "ZERO";
  const centsPart = cents ? ` AND ${wordsBelow1000(cents)} ${minor}` : "";
  return `${currency} ${main}${major ? ` ${major}` : ""}${centsPart} ONLY`;
}

const ddmmyy = (d?: string | Date | null) => {
  if (!d) return "";
  const dt = new Date(d);
  return `${String(dt.getDate()).padStart(2, "0")}.${String(dt.getMonth() + 1).padStart(2, "0")}.${String(dt.getFullYear()).slice(-2)}`;
};

const B = "border-black";

function ProformaTemplate({
  doc,
  notes,
  brand,
  grossWeight,
  currency = "USD",
  bank,
  settings,
}: {
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
  const noteLines = parsedNotes.length
    ? parsedNotes
    : [
        "Complain should be brought to our notice in writing/mail within 7 days of delivery of the goods.",
        "Supplied trims fall under garment accessories by HSN CODE 6217.10.00.",
        "Payment should be made only by RTGS / bank transfer.",
      ];
  const filler = Math.max(0, 12 - inv.items.length);

  return (
    <div
      id="print-document"
      className="mx-auto max-w-[210mm] bg-white p-4 text-black shadow-print"
      style={{ fontFamily: "Arial, sans-serif" }}
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
                  <div
                    className="text-[26px] font-bold uppercase leading-8 tracking-wide"
                    style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
                  >
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
              PROFORMA INVOICE
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
                Buyer. :{(brand ?? "").toUpperCase()}
              </div>
            </td>
            <td colSpan={2} className={`border-b-2 border-l-2 ${B} p-2 align-top`}>
              <div className="text-[13px] font-bold">Invoice No : {inv.invNo}</div>
            </td>
          </tr>
          {/* Item header */}
          <tr className={`border-b-2 ${B}`}>
            <th className={`border-r ${B} w-10 px-1 py-1.5 text-center text-[11px] font-bold`}>
              SL No.
            </th>
            <th className={`border-r ${B} px-2 py-1.5 text-left text-[11px] font-bold`}>
              Style Name
            </th>
            <th className={`border-r ${B} w-24 px-2 py-1.5 text-left text-[11px] font-bold`}>
              Item name
            </th>
            <th className={`border-r ${B} w-20 px-2 py-1.5 text-right text-[11px] font-bold`}>
              Qty/Pcs
            </th>
            <th className={`border-r ${B} w-24 px-2 py-1.5 text-right text-[11px] font-bold`}>
              Rate per Dz ({sym})
            </th>
            <th className={`w-28 px-2 py-1.5 text-right text-[11px] font-bold`}>
              Amount in {cur}({sym})
            </th>
          </tr>
        </thead>
        <tbody>
          {inv.items.map((item, i) => (
            <tr key={i} className={`border-b ${B}`}>
              <td className={`border-r ${B} px-1 py-1 text-center`}>{i + 1}.</td>
              <td className={`border-r ${B} px-2 py-1`}>{item.product.sku || item.product.name}</td>
              <td className={`border-r ${B} px-2 py-1 font-semibold`}>{item.product.name}</td>
              <td className={`border-r ${B} px-2 py-1 text-right tabular-nums`}>
                {num(item.quantity).toLocaleString()}
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
              {totalQty.toLocaleString()}
            </td>
            <td className={`border-r ${B}`} />
            <td />
          </tr>
          <tr className={`border-b-2 ${B}`}>
            <td colSpan={3} className={`border-r ${B} px-2 py-1.5 text-center font-semibold`}>
              GROSS WEIGHT {"—".repeat(5) + ">"}
            </td>
            <td colSpan={3} className="px-2 py-1.5 font-semibold">
              {grossWeight}
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

function ChalanTemplate({
  doc,
  notes,
  chalanType,
}: {
  doc: DocChalan;
  notes?: string | undefined;
  chalanType: string;
}) {
  const c = doc.company;
  const ch = doc.chalan;
  const total = ch.items.reduce((s, i) => s + num(i.quantity), 0);

  return (
    <div
      id="print-document"
      className="mx-auto max-w-[210mm] bg-white p-8 text-black shadow-print"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      {/* Top bar */}
      <div className="mb-4 flex items-end justify-between border-b-4 border-black pb-2 text-[11px]">
        <div>Date: {fmtDate(ch.date)}</div>
        <div className="text-sm font-bold uppercase">DELIVERY CHALLAN</div>
        <div className="text-right">Challan No: {ch.dcNo}</div>
      </div>

      {/* To / From boxes */}
      <table className="w-full border-collapse border border-black text-[11px]">
        <tbody>
          <tr>
            <td className="w-1/2 align-top p-3">
              <div className="font-semibold">To:</div>
              <div className="font-bold uppercase">{ch.buyer.name}</div>
              <div className="mt-1 whitespace-pre-line leading-4">{ch.buyer.address ?? ""}</div>
              <div className="mt-1">Cell: {ch.buyer.phone ?? ""}</div>
              <div>ERP NO: {ch.salesOrder?.soNo ?? ""}</div>
              <div>Style: {ch.buyer.code ?? ""}</div>
            </td>
            <td className="w-1/2 align-top border-l border-black p-3">
              <div className="font-semibold">From:</div>
              <div className="font-bold uppercase">{c?.name ?? "Company Name"}</div>
              <div className="mt-1 whitespace-pre-line leading-4">{c?.address ?? ""}</div>
              <div className="mt-1">Cell: {c?.phone ?? ""}</div>
              <div>TIN NO: {c?.tradeLicenseNo ?? ""}</div>
              <div>BIN: {c?.vatRegNo ?? ""}</div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Meta line */}
      <div className="mt-2 flex justify-between text-[10px]">
        <div>Challan Type: {chalanType}</div>
        <div>
          Vehicle/Driver: {ch.vehicleNo ?? ""}
          {ch.vehicleNo && ch.driverName ? " / " : ""}
          {ch.driverName ?? ""}
        </div>
        <div>Warehouse: {ch.warehouse?.name ?? ""}</div>
      </div>

      {/* Items */}
      <table className="mt-4 w-full border-collapse border border-black text-[10px]">
        <thead>
          <tr>
            <th rowSpan={2} className="border border-black px-1 py-1">
              S.No.
            </th>
            <th rowSpan={2} className="border border-black px-1 py-1 text-left">
              Order No.
            </th>
            <th className="border border-black px-1 py-1">STICKER</th>
            <th className="border border-black px-1 py-1">Item No</th>
            <th className="border border-black px-1 py-1" />
            <th className="border border-black px-1 py-1" />
            <th className="border border-black px-1 py-1" />
          </tr>
          <tr>
            <th className="border border-black px-1 py-1">Qty. (Pcs.)</th>
            <th className="border border-black px-1 py-1">Qty. (Pcs.)</th>
            <th className="border border-black px-1 py-1">Qty. (Pcs.)</th>
            <th className="border border-black px-1 py-1">Qty. (Pcs.)</th>
            <th className="border border-black px-1 py-1">Qty. (Pcs.)</th>
          </tr>
        </thead>
        <tbody>
          {ch.items.map((item, i) => (
            <tr key={i}>
              <td className="border border-black px-1 py-1 text-center">{i + 1}</td>
              <td className="border border-black px-1 py-1">{item.product.name}</td>
              <td className="border border-black px-1 py-1 text-center">
                {num(item.quantity).toLocaleString()}
              </td>
              <td className="border border-black px-1 py-1 text-center" />
              <td className="border border-black px-1 py-1 text-center" />
              <td className="border border-black px-1 py-1 text-center" />
              <td className="border border-black px-1 py-1 text-center" />
            </tr>
          ))}
          <tr>
            <td colSpan={2} className="border border-black px-1 py-1 font-bold">
              Total Qty (Pcs.)= {total.toLocaleString()} pcs
            </td>
            <td className="border border-black px-1 py-1 text-center font-bold">
              {total.toLocaleString()} PCS
            </td>
            <td className="border border-black px-1 py-1 text-center font-bold">00 PCS</td>
            <td className="border border-black px-1 py-1 text-center font-bold">00 PCS</td>
            <td className="border border-black px-1 py-1 text-center font-bold">00 PCS</td>
            <td className="border border-black px-1 py-1 text-center font-bold">00 PCS</td>
          </tr>
        </tbody>
      </table>

      {/* Bottom section */}
      <div className="mt-6 flex justify-between text-[10px]">
        <div className="w-1/2 pr-4">
          <div className="mb-8 font-bold">RECEIVER SIGN :</div>
          <div className="mb-6 border-b border-black pb-1" />
          <div className="mb-6 border-b border-black pb-1" />
          <div className="font-bold">Name:</div>
          <div className="mt-3 text-[9px] leading-4">
            Note for any shortage kindly intimate us within three days. After receiving goods, After
            that it is not considerable.
          </div>
        </div>
        <div className="w-1/2 flex flex-col items-center justify-end">
          <div className="mb-2 h-32 w-32 border-2 border-dashed border-black" />
          <div className="font-bold">Authorised Signatory</div>
        </div>
      </div>
    </div>
  );
}

/* --------------------------- Create-new forms --------------------------- */

function InvoiceCreateForm({
  buyers,
  products,
  orders,
  taxRates,
  onCreated,
}: {
  buyers: Named[];
  products: ProductLite[];
  orders: SalesOrderLite[];
  taxRates: TaxRateLite[];
  onCreated: (id: number) => void;
}) {
  const save = useSave();
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [orderId, setOrderId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: "", rate: "" }]);
  const [discount, setDiscount] = useState("0");
  const [vatMode, setVatMode] = useState("EXCLUSIVE");

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
        save(
          api
            .post<{ id: number }>("/sales/invoices", {
              salesOrderId: orderId || null,
              buyerId,
              invoiceDate: v["Invoice date"],
              dueDate: v["Due date"],
              vatMode,
              discount: num(discount),
              items: items
                .filter((i) => i.productId)
                .map((i) => ({
                  productId: i.productId,
                  quantity: Number(i.quantity),
                  rate: Number(i.rate),
                  taxRateId: products.find((p) => p.id === i.productId)?.taxRateId ?? null,
                })),
            })
            .then((inv) => onCreated(inv.id)),
          "Invoice created",
        );
      }}
      className="space-y-4 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
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
        <Field
          label="Invoice date"
          name="Invoice date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
        <Field label="Due date" name="Due date" type="date" />
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
        <Field
          label="Discount"
          name="Discount"
          type="number"
          value={discount}
          onChange={setDiscount}
        />
      </div>
      <ItemsEditor products={products} items={items} onChange={setItems} priceField="salesPrice" />
      <div className="rounded-lg border bg-surface-subtle px-4 py-3 text-[12px]">
        <div className="flex justify-end gap-6">
          <span className="text-muted-foreground">Subtotal</span>
          <span className="w-28 text-right font-semibold tabular-nums">{money(subtotal)}</span>
        </div>
        <div className="flex justify-end gap-6">
          <span className="text-muted-foreground">VAT (auto)</span>
          <span className="w-28 text-right font-semibold tabular-nums">{money(vat)}</span>
        </div>
        <div className="flex justify-end gap-6">
          <span className="text-muted-foreground">Discount</span>
          <span className="w-28 text-right font-semibold tabular-nums">-{money(discount)}</span>
        </div>
        <div className="flex justify-end gap-6 border-t pt-1.5">
          <span className="font-semibold">Total</span>
          <span className="w-28 text-right font-bold tabular-nums">{money(total)}</span>
        </div>
      </div>
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!buyerId}>
          <Save /> Create invoice
        </Button>
      </div>
    </form>
  );
}

function ChalanCreateForm({
  buyers,
  warehouses,
  products,
  orders,
  onCreated,
}: {
  buyers: Named[];
  warehouses: Named[];
  products: ProductLite[];
  orders: SalesOrderLite[];
  onCreated: (id: number) => void;
}) {
  const save = useSave();
  const [buyerId, setBuyerId] = useState<number | "">("");
  const [warehouseId, setWarehouseId] = useState<number | "">("");
  const [orderId, setOrderId] = useState<number | "">("");
  const [items, setItems] = useState<LineItem[]>([{ productId: 0, quantity: "", rate: "" }]);

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
        save(
          api
            .post<{ id: number }>("/sales/chalans", {
              salesOrderId: orderId || null,
              buyerId,
              warehouseId,
              date: v["Delivery date"],
              driverName: v["Driver name"],
              vehicleNo: v["Vehicle no."],
              notes: v["Notes"],
              items: items
                .filter((i) => i.productId)
                .map((i) => ({ productId: i.productId, quantity: Number(i.quantity) })),
            })
            .then((ch) => onCreated(ch.id)),
          "Chalan created",
        );
      }}
      className="space-y-4 p-5"
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <EntitySelect label="Buyer" value={buyerId} onChange={setBuyerId} options={buyers} />
        <EntitySelect
          label="Warehouse"
          value={warehouseId}
          onChange={setWarehouseId}
          options={warehouses}
        />
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
        <Field
          label="Delivery date"
          name="Delivery date"
          type="date"
          defaultValue={new Date().toISOString().slice(0, 10)}
          required
        />
        <Field label="Driver name" name="Driver name" />
        <Field label="Vehicle no." name="Vehicle no." />
        <Field label="Notes" name="Notes" />
      </div>
      <ItemsEditor products={products} items={items} onChange={setItems} priceField="salesPrice" />
      <div className="flex justify-end">
        <Button type="submit" size="sm" disabled={!buyerId || !warehouseId}>
          <Save /> Create chalan
        </Button>
      </div>
    </form>
  );
}
