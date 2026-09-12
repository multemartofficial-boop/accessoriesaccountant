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
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div>
        <div className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-primary">{eyebrow}</div>
        <h1 className="text-2xl font-bold text-foreground">{title}</h1>
        <p className="mt-1.5 max-w-2xl text-xs leading-5 text-muted-foreground">{description}</p>
      </div>
      {action && <Button size="sm" className="h-9 rounded-lg px-3.5 text-xs shadow-sm" onClick={onAction}><Plus className="size-3.5" />{action}</Button>}
    </div>
  );
}

const metricIcons = [CircleDollarSign, Landmark, Banknote, Package, TriangleAlert];
export function MetricStrip({ items }: { items: { label: string; value: string; detail: string; tone?: MetricTone }[] }) {
  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => {
        const Icon = item.tone === "down" ? TriangleAlert : metricIcons[index % metricIcons.length] ?? CircleDollarSign;
        const accent = item.tone === "up" ? "border-l-success" : item.tone === "down" ? "border-l-destructive" : item.tone === "cash" ? "border-l-chart-2" : "border-l-primary";
        return <div key={item.label} className={cn("relative min-w-0 overflow-hidden rounded-lg border border-l-[3px] bg-card px-4 py-4 shadow-card", accent)}>
          <div className="flex items-start justify-between gap-3"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</div><Icon className={cn("size-4", item.tone === "up" ? "text-success" : item.tone === "down" ? "text-destructive" : "text-primary/65")} /></div>
          <div className="mt-2 text-[clamp(1.35rem,2vw,1.7rem)] font-bold leading-none text-foreground">{item.value}</div>
          <div className={cn("mt-2.5 flex items-center gap-1 text-[10px] font-medium", item.tone === "up" ? "text-success" : item.tone === "down" ? "text-destructive" : "text-muted-foreground")}>
            {item.tone === "up" && <ArrowUpRight className="size-3" />}{item.tone === "down" && <ArrowDownRight className="size-3" />}{item.detail}
          </div>
        </div>;
      })}
    </div>
  );
}

export function MiniStats({ items }: { items: { label: string; value: string; detail?: string; tone?: MetricTone }[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{items.map((item) => <div key={item.label} className="rounded-lg border bg-card p-4 shadow-card"><div className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">{item.label}</div><div className={cn("mt-1.5 text-xl font-bold", item.tone === "down" && "text-destructive", item.tone === "up" && "text-success")}>{item.value}</div>{item.detail && <div className="mt-1 text-[10px] text-muted-foreground">{item.detail}</div>}</div>)}</div>;
}

export function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={cn("overflow-hidden rounded-lg border bg-card shadow-card", className)}><div className="flex min-h-13 items-center justify-between gap-3 border-b px-4 py-3"><div><h2 className="text-xs font-semibold">{title}</h2>{subtitle && <p className="mt-0.5 text-[10px] text-muted-foreground">{subtitle}</p>}</div>{action}</div>{children}</section>;
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
    {searchable && <div className="flex flex-wrap items-center gap-2 border-b bg-surface-subtle p-3"><div className="relative min-w-52 flex-1"><Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Search records..." className="h-9 rounded-lg border-border bg-card pl-9 text-xs shadow-none" /></div><Button variant={filterOn ? "secondary" : "outline"} size="sm" className="h-9 rounded-lg shadow-none" onClick={() => setFilterOn((value) => !value)}><Filter />{filterOn ? "Filtered" : filterLabel}</Button><Button variant="outline" size="sm" className="h-9 rounded-lg shadow-none" onClick={exportRows}><Download />Export</Button></div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-xs"><thead><tr className="border-b bg-table-head text-muted-foreground">{columns.map((column) => <th key={column.key} className={cn("h-9 whitespace-nowrap px-4 text-left text-[10px] font-bold uppercase tracking-[0.08em]", column.align === "right" && "text-right")}>{column.label}</th>)}{(onEdit || onDelete) && <th className="w-20" />}</tr></thead><tbody>{filtered.map((row, index) => <tr key={`${Object.values(row)[0]}-${index}`} tabIndex={onRowClick ? 0 : undefined} onClick={() => onRowClick?.(row)} onKeyDown={(event) => { if (event.key === "Enter") onRowClick?.(row); }} className={cn("border-b last:border-b-0 transition-colors hover:bg-accent/55", onRowClick && "cursor-pointer focus:bg-accent focus:outline-none")}>{columns.map((column) => <td key={column.key} className={cn("h-11 whitespace-nowrap px-4 tabular-nums", column.align === "right" && "text-right font-semibold")}>{column.status ? <Badge variant="outline" className={cn("rounded-md px-2 py-0.5 text-[10px] font-semibold shadow-none", statusClass(String(row[column.key])))}>{row[column.key]}</Badge> : row[column.key]}</td>)}{(onEdit || onDelete) && <td className="px-2"><div className="flex justify-end"><Button variant="ghost" size="icon" title="Edit record" aria-label="Edit record" className="h-7 w-7 rounded-md" onClick={(event) => { event.stopPropagation(); onEdit?.(row); }}><Pencil className="size-3.5" /></Button><Button variant="ghost" size="icon" title="Delete record" aria-label="Delete record" className="h-7 w-7 rounded-md text-destructive" onClick={(event) => { event.stopPropagation(); setDeleting(row); }}><Trash2 className="size-3.5" /></Button></div></td>}</tr>)}</tbody></table>{filtered.length === 0 && <div className="px-4 py-12 text-center text-xs text-muted-foreground">No records match your search.</div>}</div>
    <div className="flex h-11 items-center justify-between border-t bg-surface-subtle px-4 text-[10px] text-muted-foreground"><span>{filtered.length} records · Page {page} of 3</span><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Previous page" className="h-7 w-7 rounded-md shadow-none" onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Next page" className="h-7 w-7 rounded-md shadow-none" onClick={() => setPage((p) => Math.min(3, p + 1))}><ChevronRight /></Button></div></div>
    <AlertDialog open={Boolean(deleting)} onOpenChange={(open) => { if (!open) setDeleting(null); }}><AlertDialogContent className="rounded-lg"><AlertDialogHeader><AlertDialogTitle>Delete this record?</AlertDialogTitle><AlertDialogDescription>This removes it from the current demo session. The action cannot be undone.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => { if (deleting) onDelete?.(deleting); setDeleting(null); toast.success("Record deleted"); }}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

export function TabsBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return <div className="flex gap-6 overflow-x-auto border-b bg-card px-4">{tabs.map((tab) => <button key={tab} type="button" onClick={() => onChange(tab)} className={cn("h-11 whitespace-nowrap border-b-2 text-xs font-semibold transition-colors", active === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab}</button>)}</div>;
}

export function Field({ label, name, defaultValue, value, onChange, type = "text", placeholder, required = false }: { label: string; name?: string; defaultValue?: string; value?: string; onChange?: (value: string) => void; type?: string; placeholder?: string; required?: boolean }) {
  return <label className="grid gap-1.5 text-[11px] font-semibold text-foreground"><span>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</span><Input name={name ?? label} type={type} defaultValue={value === undefined ? defaultValue : undefined} value={value} onChange={onChange ? (event) => onChange(event.target.value) : undefined} required={required} placeholder={placeholder} className="h-9 rounded-lg bg-card text-xs shadow-none" /></label>;
}

export function SelectField({ label, name, options, defaultValue, required = false }: { label: string; name?: string; options: string[]; defaultValue?: string; required?: boolean }) {
  return <label className="grid gap-1.5 text-[11px] font-semibold"><span>{label}{required && <span className="ml-0.5 text-destructive">*</span>}</span><select name={name ?? label} required={required} defaultValue={defaultValue} className="h-9 rounded-lg border border-input bg-card px-2.5 text-xs outline-none focus:ring-2 focus:ring-ring/25">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}

export function ActionDialog({ open, onOpenChange, title, description, fields, submitLabel = "Save record", initialValues, onSubmit }: { open: boolean; onOpenChange: (open: boolean) => void; title: string; description: string; fields: { label: string; name: string; type?: string; options?: string[]; required?: boolean }[]; submitLabel?: string; initialValues?: Record<string, string>; onSubmit?: (values: Record<string, string>) => void }) {
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget).entries()) as Record<string, string>;
    onSubmit?.(values); onOpenChange(false); toast.success(`${title} saved`, { description: "The demo data was updated successfully." });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="max-h-[90vh] overflow-y-auto rounded-lg sm:max-w-2xl"><DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>{description}</DialogDescription></DialogHeader><form onSubmit={submit}><div className="grid gap-4 py-2 sm:grid-cols-2">{fields.map((field) => field.options ? <SelectField key={field.name} label={field.label} name={field.name} options={field.options} {...(initialValues?.[field.name] ? { defaultValue: initialValues[field.name] } : {})} {...(field.required !== undefined ? { required: field.required } : {})}/> : <Field key={field.name} label={field.label} name={field.name} {...(field.type ? { type: field.type } : {})} {...(initialValues?.[field.name] ? { defaultValue: initialValues[field.name] } : {})} {...(field.required !== undefined ? { required: field.required } : {})} placeholder={`Enter ${field.label.toLowerCase()}`}/>)}</div><DialogFooter className="mt-5"><Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button type="submit"><Plus className="size-4" />{submitLabel}</Button></DialogFooter></form></DialogContent></Dialog>;
}

export function submitWithToast(label: string) { toast.success(label, { description: "Your changes are saved in this demo session." }); }