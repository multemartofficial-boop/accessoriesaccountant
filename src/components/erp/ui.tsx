import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Download,
  Filter,
  Landmark,
  MoreHorizontal,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

export type TableRowData = Record<string, string | number>;
export type Column = { key: string; label: string; align?: "left" | "right"; status?: boolean };
type MetricTone = "up" | "down" | "neutral" | "cash" | "stock";

export function PageHeader({ eyebrow, title, description, action = "New entry", onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-5 flex flex-col justify-between gap-4 sm:mb-6 sm:flex-row sm:items-end">
      <div>
        <div className="mb-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-sm leading-5 text-muted-foreground sm:text-xs">{description}</p>
      </div>
      {action && <Button size="sm" className="h-11 w-full rounded-lg px-3.5 text-xs shadow-sm sm:h-9 sm:w-auto" onClick={onAction}><Plus className="size-3.5" />{action}</Button>}
    </div>
  );
}

const metricIcons = [CircleDollarSign, Landmark, Banknote, Package, TriangleAlert];
export function MetricStrip({ items }: { items: { label: string; value: string; detail: string; tone?: MetricTone }[] }) {
  return (
    <div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.tone === "down" ? TriangleAlert : metricIcons[index % metricIcons.length] ?? CircleDollarSign;
        const accent = item.tone === "up" ? "border-l-success" : item.tone === "down" ? "border-l-destructive" : item.tone === "cash" ? "border-l-chart-2" : "border-l-primary";
        return <div key={item.label} className={cn("relative min-w-0 overflow-hidden rounded-lg border border-l-[3px] bg-card px-3 py-3.5 shadow-card sm:px-4 sm:py-4", accent)}>
          <div className="flex items-start justify-between gap-3"><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</div><Icon className={cn("size-5", item.tone === "up" ? "text-success" : item.tone === "down" ? "text-destructive" : "text-primary/65")} /></div>
          <div className="mt-2 break-words text-xl font-bold leading-tight text-foreground sm:text-[clamp(1.6rem,2.2vw,2rem)]">{item.value}</div>
          <div className={cn("mt-2.5 flex items-center gap-1 text-[11px] font-medium", item.tone === "up" ? "text-success" : item.tone === "down" ? "text-destructive" : "text-muted-foreground")}>
            {item.tone === "up" && <ArrowUpRight className="size-3.5" />}{item.tone === "down" && <ArrowDownRight className="size-3.5" />}{item.detail}
          </div>
        </div>;
      })}
    </div>
  );
}

export function MiniStats({ items }: { items: { label: string; value: string; detail?: string; tone?: MetricTone }[] }) {
  return <div className="grid grid-cols-2 gap-3 xl:grid-cols-3">{items.map((item) => <div key={item.label} className="min-w-0 rounded-lg border bg-card p-3.5 shadow-card sm:p-4"><div className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</div><div className={cn("mt-1.5 break-words text-xl font-bold sm:text-2xl", item.tone === "down" && "text-destructive", item.tone === "up" && "text-success")}>{item.value}</div>{item.detail && <div className="mt-1 text-[11px] leading-4 text-muted-foreground">{item.detail}</div>}</div>)}</div>;
}

export function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn("overflow-hidden rounded-lg border bg-card shadow-card", className)}><div className="flex min-h-13 items-center justify-between gap-3 border-b px-4 py-3"><div><h2 className="text-sm font-semibold">{title}</h2>{subtitle && <p className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</p>}</div>{action}</div>{children}</section>;
}

function statusClass(value: string) {
  const v = value.toLowerCase();
  if (["paid", "approved", "active", "received", "completed", "in stock"].some((s) => v.includes(s))) return "border-success/25 bg-success-soft text-success";
  if (["pending", "partial", "low", "review", "awaiting"].some((s) => v.includes(s))) return "border-warning/25 bg-warning-soft text-warning";
  if (["overdue", "declined", "cancelled", "out of stock"].some((s) => v.includes(s))) return "border-destructive/20 bg-destructive-soft text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

export function DataTable({ columns, rows, searchable = true, onRowClick, onEdit, onDelete, filterLabel = "All records" }: { columns: Column[]; rows: TableRowData[]; searchable?: boolean; onRowClick?: (row: TableRowData) => void; onEdit?: (row: TableRowData) => void; onDelete?: (row: TableRowData) => void; filterLabel?: string }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [filterOn, setFilterOn] = useState(false);
  const [deleting, setDeleting] = useState<TableRowData | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  useEffect(() => {
    const update = (event: Event) => setQuery((event as CustomEvent<string>).detail ?? "");
    window.addEventListener("erp-global-search", update);
    return () => window.removeEventListener("erp-global-search", update);
  }, []);
  const filtered = useMemo(() => rows.filter((row) => {
    const matches = Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase());
    return matches && (!filterOn || !String(row["status"] ?? "").toLowerCase().includes("completed"));
  }), [filterOn, query, rows]);
  const exportRows = () => {
    const csv = [columns.map((c) => c.label), ...filtered.map((r) => columns.map((c) => String(r[c.key] ?? "")))].map((line) => line.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const anchor = document.createElement("a"); anchor.href = url; anchor.download = "garmenttrade-export.csv"; anchor.click(); URL.revokeObjectURL(url);
    toast.success("Export prepared", { description: `${filtered.length} records downloaded.` });
  };
  return <div>
    {searchable && <div className="grid grid-cols-2 items-center gap-2 border-b bg-surface-subtle p-3 md:flex md:flex-wrap"><div className="relative col-span-2 min-w-0 flex-1 md:col-span-1 md:min-w-52"><Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search records..." className="h-11 rounded-lg border-border bg-card pl-9 text-sm shadow-none md:h-9 md:text-xs" /></div><Button variant={filterOn ? "secondary" : "outline"} size="sm" className="h-11 rounded-lg shadow-none md:h-9" onClick={() => setFilterOn((value) => !value)}><Filter />{filterOn ? "Filtered" : filterLabel}</Button><Button variant="outline" size="sm" className="h-11 rounded-lg shadow-none md:h-9" onClick={exportRows}><Download />Export</Button></div>}
    <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[720px] text-sm"><thead><tr className="border-b bg-table-head text-muted-foreground">{columns.map((column) => <th key={column.key} className={cn("h-9 whitespace-nowrap px-4 text-left text-[11px] font-bold uppercase tracking-[0.08em]", column.align === "right" && "text-right")}>{column.label}</th>)}{(onEdit || onDelete) && <th className="w-20" />}</tr></thead><tbody>{filtered.map((row, index) => <tr key={`${Object.values(row)[0]}-${index}`} tabIndex={onRowClick ? 0 : undefined} onClick={() => onRowClick?.(row)} onKeyDown={(event) => { if (event.key === "Enter") onRowClick?.(row); }} className={cn("border-b last:border-b-0 transition-colors hover:bg-accent/55", onRowClick && "cursor-pointer focus:bg-accent focus:outline-none")}>{columns.map((column) => <td key={column.key} className={cn("h-11 whitespace-nowrap px-4 tabular-nums", column.align === "right" && "text-right font-semibold")}>{column.status ? <Badge variant="outline" className={cn("rounded-full px-2.5 py-0.5 text-[11px] font-semibold shadow-none", statusClass(String(row[column.key])))}>{row[column.key]}</Badge> : row[column.key]}</td>)}{(onEdit || onDelete) && <td className="px-2"><div className="flex justify-end"><Button variant="ghost" size="icon" title="Edit record" aria-label="Edit record" className="h-7 w-7 rounded-md" onClick={(event) => { event.stopPropagation(); onEdit?.(row); }}><Pencil className="size-4" /></Button><Button variant="ghost" size="icon" title="Delete record" aria-label="Delete record" className="h-7 w-7 rounded-md text-destructive" onClick={(event) => { event.stopPropagation(); setDeleting(row); }}><Trash2 className="size-4" /></Button></div></td>}</tr>)}</tbody></table>{filtered.length === 0 && <div className="px-4 py-12 text-center text-sm text-muted-foreground">No records match your search.</div>}</div>
    <div className="grid gap-3 bg-workspace/40 p-3 md:hidden">{filtered.map((row, index) => { const statusColumn = columns.find((column) => column.status); const visibleColumns = columns.filter((column) => !column.status); const titleColumn = visibleColumns.find((column) => /^(name|party|product|item|details|account)$/.test(column.key)) ?? visibleColumns[0]; const subtitleColumn = visibleColumns.find((column) => column.key !== titleColumn?.key); const summaryColumn = [...visibleColumns].reverse().find((column) => column.align === "right" && column.key !== titleColumn?.key) ?? visibleColumns.find((column) => column.key !== titleColumn?.key && column.key !== subtitleColumn?.key); const isExpanded = expanded === index; return <article key={`${Object.values(row)[0]}-${index}`} className="overflow-hidden rounded-lg border bg-card shadow-card"><button type="button" onClick={() => onRowClick ? onRowClick(row) : setExpanded(isExpanded ? null : index)} className="block min-h-20 w-full p-4 text-left"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{String(row[titleColumn?.key ?? ""] ?? "Record")}</div>{subtitleColumn && <div className="mt-1 truncate text-xs text-muted-foreground">{String(row[subtitleColumn.key] ?? "")}</div>}</div>{statusColumn && <Badge variant="outline" className={cn("shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold", statusClass(String(row[statusColumn.key])))}>{row[statusColumn.key]}</Badge>}</div>{summaryColumn && <div className="mt-3 flex items-center justify-between border-t pt-3 text-xs"><span className="text-muted-foreground">{summaryColumn.label}</span><strong className="text-right">{row[summaryColumn.key]}</strong></div>}</button>{isExpanded && <div className="grid grid-cols-2 gap-x-4 gap-y-3 border-t bg-surface-subtle p-4">{columns.filter((column) => ![titleColumn?.key, subtitleColumn?.key, summaryColumn?.key].includes(column.key)).map((column) => <div key={column.key} className="min-w-0"><div className="text-[10px] font-semibold uppercase text-muted-foreground">{column.label}</div><div className="mt-1 break-words text-xs font-medium">{row[column.key]}</div></div>)}</div>}{(onEdit || onDelete) && <div className="grid grid-cols-2 border-t"><Button variant="ghost" className="h-11 rounded-none border-r" onClick={() => onEdit?.(row)}><Pencil/>Edit</Button><Button variant="ghost" className="h-11 rounded-none text-destructive" onClick={() => setDeleting(row)}><Trash2/>Delete</Button></div>}</article>})}{filtered.length === 0 && <div className="py-12 text-center text-sm text-muted-foreground">No records match your search.</div>}</div>
    <div className="flex h-11 items-center justify-between border-t bg-surface-subtle px-4 text-[11px] text-muted-foreground"><span>{filtered.length} records · Page {page} of 3</span><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Previous page" className="h-7 w-7 rounded-md shadow-none" onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Next page" className="h-7 w-7 rounded-md shadow-none" onClick={() => setPage((p) => Math.min(3, p + 1))}><ChevronRight /></Button></div></div>
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }}><AlertDialogContent className="rounded-lg"><AlertDialogHeader><AlertDialogTitle>Delete this record?</AlertDialogTitle><AlertDialogDescription>This removes it from the current demo session. The action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleting) onDelete?.(deleting); setDeleting(null); toast.success("Record deleted"); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

export function TabsBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return <div className="flex gap-2 overflow-x-auto border-b bg-card p-3 md:gap-6 md:px-4 md:py-0">{tabs.map((tab) => <button key={tab} type="button" onClick={() => onChange(tab)} className={cn("h-11 shrink-0 whitespace-nowrap rounded-full border px-4 text-sm font-semibold transition-colors md:rounded-none md:border-x-0 md:border-t-0 md:px-0", active === tab ? "border-primary bg-primary text-primary-foreground md:bg-transparent md:text-primary" : "border-border bg-surface-subtle text-muted-foreground hover:text-foreground md:border-transparent md:bg-transparent")}>{tab}</button>)}</div>;
}

export function Field({ label, name, defaultValue, value, onChange, type = "text", placeholder, required = false }: { label: string; name?: string | undefined; defaultValue?: string | undefined; value?: string | undefined; onChange?: ((value: string) => void) | undefined; type?: string | undefined; placeholder?: string | undefined; required?: boolean | undefined }) {
  return <label className="grid gap-1.5 text-sm font-semibold text-foreground md:text-xs"><span>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</span><Input name={name ?? label} type={type} defaultValue={value === undefined ? defaultValue : undefined} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} required={required} placeholder={placeholder} className="h-11 rounded-lg bg-card text-sm shadow-none md:h-9 md:text-xs" /></label>;
}

export function SelectField({ label, name, options, defaultValue, required = false }: { label: string; name?: string | undefined; options: string[]; defaultValue?: string | undefined; required?: boolean | undefined }) {
  return <label className="grid gap-1.5 text-xs font-semibold md:text-[11px]"><span>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</span><select name={name ?? label} required={required} defaultValue={defaultValue} className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/25 md:h-9 md:text-xs">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

export function ActionDialog({ open, onOpenChange, title, description, fields, submitLabel = "Save record", initialValues, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; fields: { label: string; name: string; type?: string | undefined; options?: string[] | undefined; required?: boolean | undefined }[]; submitLabel?: string | undefined; initialValues?: Record<string, string> | undefined; onSubmit?: ((values: Record<string, string>) => void) | undefined }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    onSubmit?.(values); onOpenChange(false); toast.success(`${title} saved`, { description: "The demo data was updated successfully." });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[92svh] overflow-y-auto rounded-lg sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><form onSubmit={submit}><div className="grid gap-4 py-2 sm:grid-cols-2">{fields.map((field) => field.options ? <SelectField key={field.name} label={field.label} name={field.name} options={field.options} {...(initialValues?.[field.name] ? { defaultValue: initialValues[field.name] } : {})} {...(field.required !== undefined ? { required: field.required } : {})}/> : <Field key={field.name} label={field.label} name={field.name} {...(field.type ? { type: field.type } : {})} {...(initialValues?.[field.name] ? { defaultValue: initialValues[field.name] } : {})} {...(field.required !== undefined ? { required: field.required } : {})} placeholder={`Enter ${field.label.toLowerCase()}`}/>)}</div><DialogFooter className="mobile-action-bar mt-5"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit"><Plus className="size-4" />{submitLabel}</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function submitWithToast(label: string) { toast.success(label, { description: "Your changes are saved in this demo session." }); }