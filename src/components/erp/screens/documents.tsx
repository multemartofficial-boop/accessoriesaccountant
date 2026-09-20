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
  const [mode, setMode] = useState<"browse" | "create">("browse");
  const { data: sources } = useData<Sources>(["doc-sources"], "/documents/sources");
  const { data: settings } = useData<Record<string, string>>(["settings"], "/settings");
  const { data: buyers } = useData<Named[]>(["buyers"], "/buyers");
  const { data: warehouses } = useData<Named[]>(["warehouses"], "/warehouses");
  const { data: products } = useData<ProductLite[]>(["products"], "/products");
  const { data: orders } = useData<SalesOrderLite[]>(["sales-orders"], "/sales/orders");
  const { data: taxRates } = useData<TaxRateLite[]>(["tax-rates"], "/vat/rates");

  const isInvoice = kind === "Invoice";
  const list = isInvoice ? (sources?.invoices ?? []) : (sources?.chalans ?? []);
  const selectedId = docId ?? list[0]?.id;

  const { data: doc } = useData<DocInvoice | DocChalan>(
    ["document", kind, selectedId],
    isInvoice ? `/documents/invoice/${selectedId}` : `/documents/chalan/${selectedId}`,
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
              {["Invoice", "Chalan"].map((k) => (
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
            isInvoice ? (
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
                <span>Select {isInvoice ? "invoice" : "chalan"}</span>
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
              {doc && isInvoice && "invoice" in doc && (
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
              {doc && !isInvoice && "chalan" in doc && (
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
              <label className="mt-4 grid gap-1.5 text-[11px] font-semibold">
                Notes (printed on the document)
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    isInvoice ? settings?.["doc_invoice_terms"] : settings?.["doc_chalan_notes"]
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
          ) : doc && isInvoice && "invoice" in doc ? (
            <InvoiceTemplate
              doc={doc}
              notes={notes || settings?.["doc_invoice_terms"]}
              footer={settings?.["doc_invoice_footer"]}
            />
          ) : doc && !isInvoice && "chalan" in doc ? (
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

  return (
    <div
      id="print-document"
      className="mx-auto max-w-xl bg-white p-8 text-black shadow-print"
      style={{ fontFamily: "Arial, sans-serif" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="text-[10px] leading-4">
          <div className="flex items-center gap-2">
            {c?.logoUrl && <img src={c.logoUrl} alt="logo" className="h-8 object-contain" />}
            <div>
              Company Name: <strong>{c?.name ?? "Company Name"}</strong>
            </div>
          </div>
          <div className="mt-1 text-gray-700">
            Address: {c?.address ?? ""}
            {c?.vatRegNo && (
              <>
                <br />
                BIN: {c.vatRegNo}
              </>
            )}
            {c?.phone && (
              <>
                <br />
                Phone: {c.phone}
              </>
            )}
          </div>
        </div>
        <div className="text-right">
          <div className="text-xl font-bold tracking-wide" style={{ color: CHALAN_ACCENT }}>
            DELIVERY CHALLAN
          </div>
          <div className="mt-1 text-[10px] text-gray-700">Delivery Challan# - {ch.dcNo}</div>
        </div>
      </div>

      {/* Meta strip */}
      <table className="mt-5 w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th className="px-2 py-1 text-left font-bold" style={{ color: CHALAN_ACCENT }}>
              Delivery Challan #
            </th>
            <th className="px-2 py-1 text-left font-bold" style={{ color: CHALAN_ACCENT }}>
              Order Date #
            </th>
            <th className="px-2 py-1 text-left font-bold" style={{ color: CHALAN_ACCENT }}>
              Dispatch Date #
            </th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="border border-gray-300 px-2 py-1.5">{ch.dcNo}</td>
            <td className="border border-gray-300 px-2 py-1.5">{fmtDate(ch.date)}</td>
            <td className="border border-gray-300 px-2 py-1.5">{fmtDate(ch.date)}</td>
          </tr>
        </tbody>
      </table>

      {/* Bill to + right meta */}
      <div className="mt-4 flex justify-between gap-6 text-[10px]">
        <div>
          <div className="font-semibold">Bill To:</div>
          <div className="mt-1 leading-4">
            <div>{ch.buyer.name}</div>
            <div>{ch.buyer.address ?? ""}</div>
            {ch.buyer.phone && <div>Phone: {ch.buyer.phone}</div>}
            <div>Place of Supply: {ch.buyer.address?.split(",").pop()?.trim() ?? "â€”"}</div>
          </div>
        </div>
        <div className="leading-5">
          <div>
            <span style={{ color: CHALAN_ACCENT }}>Challan Date #</span> {fmtDate(ch.date)}
          </div>
          <div>
            <span style={{ color: CHALAN_ACCENT }}>Ref #</span> {ch.salesOrder?.soNo ?? "â€”"}
          </div>
          <div>
            <span style={{ color: CHALAN_ACCENT }}>Challan Type:</span> {chalanType}
          </div>
          <div>
            <span style={{ color: CHALAN_ACCENT }}>Vehicle:</span> {ch.vehicleNo ?? "â€”"}
            {ch.driverName ? ` Â· ${ch.driverName}` : ""}
          </div>
          <div>
            <span style={{ color: CHALAN_ACCENT }}>Warehouse:</span> {ch.warehouse?.name ?? "â€”"}
          </div>
        </div>
      </div>

      {/* Items */}
      <table className="mt-5 w-full border-collapse text-[10px]">
        <thead>
          <tr>
            <th
              className="w-8 border border-gray-300 px-1 py-1.5 font-bold"
              style={{ color: CHALAN_ACCENT }}
            >
              SR
              <br />
              No.
            </th>
            <th
              className="border border-gray-300 px-2 py-1.5 text-left font-bold"
              style={{ color: CHALAN_ACCENT }}
            >
              ITEM DESCRIPTION
            </th>
            <th
              className="w-24 border border-gray-300 px-2 py-1.5 font-bold"
              style={{ color: CHALAN_ACCENT }}
            >
              CODE
            </th>
            <th
              className="w-16 border border-gray-300 px-2 py-1.5 font-bold"
              style={{ color: CHALAN_ACCENT }}
            >
              QTY
            </th>
            <th
              className="w-16 border border-gray-300 px-2 py-1.5 font-bold"
              style={{ color: CHALAN_ACCENT }}
            >
              UNIT
            </th>
          </tr>
        </thead>
        <tbody>
          {ch.items.map((item, i) => (
            <tr key={i} style={{ background: i % 2 ? "#fdf6ec" : "#fff" }}>
              <td className="border border-gray-300 px-1 py-1.5 text-center">{i + 1}</td>
              <td className="border border-gray-300 px-2 py-1.5">{item.product.name}</td>
              <td className="border border-gray-300 px-2 py-1.5 text-center">
                {item.product.sku ?? "â€”"}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center">
                {num(item.quantity).toLocaleString()}
              </td>
              <td className="border border-gray-300 px-2 py-1.5 text-center">
                {item.product.unit?.code ?? "â€”"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-1 text-right text-[10px]">
        Total quantity:{" "}
        <strong>{ch.items.reduce((s, i) => s + num(i.quantity), 0).toLocaleString()}</strong>
      </div>

      {/* Notes */}
      <div className="mt-5">
        <div className="text-[10px] font-bold" style={{ color: CHALAN_ACCENT }}>
          Notes
        </div>
        <div className="mt-1 min-h-10 border-t border-gray-200 pt-1 text-[10px] text-gray-700">
          {notes || "Received the above goods in good order and condition."}
        </div>
      </div>

      {/* Signatures */}
      <div className="mt-14 flex justify-between text-[10px]">
        <div className="w-40 border-t border-gray-400 pt-1 text-center">Received by</div>
        <div className="w-40 border-t border-gray-400 pt-1 text-center">Driver</div>
        <div className="w-40 border-t border-gray-400 pt-1 text-center">
          For {c?.name ?? "Company"}
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
