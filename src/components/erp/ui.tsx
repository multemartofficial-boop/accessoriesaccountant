import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Filter, MoreHorizontal, Plus, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type TableRowData = Record<string, string | number>;
export type Column = { key: string; label: string; align?: "left" | "right"; status?: boolean };

export function PageHeader({ eyebrow, title, description, action = "New entry", onAction }: { eyebrow: string; title: string; description: string; action?: string; onAction?: () => void }) {
  return (
    <div className="mb-4 flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
      <div><div className="mb-1 text-[10px] font-semibold uppercase text-primary">{eyebrow}</div><h1 className="text-xl font-bold text-foreground">{title}</h1><p className="mt-1 max-w-2xl text-xs text-muted-foreground">{description}</p></div>
      {action && <Button size="sm" className="h-8 rounded-sm text-xs shadow-none" onClick={onAction}><Plus className="size-3.5" />{action}</Button>}
    </div>
  );
}

export function MetricStrip({ items }: { items: { label: string; value: string; detail: string; tone?: "up" | "down" | "neutral" }[] }) {
  return <div className="mb-4 grid border-l border-t bg-card sm:grid-cols-2 xl:grid-cols-4">{items.map((item) => <div key={item.label} className="min-w-0 border-b border-r px-4 py-3"><div className="text-[11px] text-muted-foreground">{item.label}</div><div className="mt-1 text-xl font-semibold tabular-nums">{item.value}</div><div className={cn("mt-1 text-[10px]", item.tone === "up" ? "text-success" : item.tone === "down" ? "text-destructive" : "text-muted-foreground")}>{item.detail}</div></div>)}</div>;
}

export function Panel({ title, subtitle, action, children, className }: { title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <section className={cn("border bg-card", className)}><div className="flex min-h-11 items-center justify-between gap-2 border-b px-3 py-2"><div><h2 className="text-xs font-semibold">{title}</h2>{subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}</div>{action}</div>{children}</section>;
}

function statusClass(value: string) {
  const v = value.toLowerCase();
  if (["paid", "approved", "active", "received", "completed", "in stock"].some((s) => v.includes(s))) return "border-success/30 bg-success-soft text-success";
  if (["pending", "partial", "low", "review", "awaiting"].some((s) => v.includes(s))) return "border-warning/30 bg-warning-soft text-warning";
  if (["overdue", "declined", "cancelled", "out of stock"].some((s) => v.includes(s))) return "border-destructive/25 bg-destructive-soft text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

export function DataTable({ columns, rows, searchable = true }: { columns: Column[]; rows: TableRowData[]; searchable?: boolean }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const filtered = useMemo(() => rows.filter((row) => Object.values(row).join(" ").toLowerCase().includes(query.toLowerCase())), [query, rows]);
  return <div>
    {searchable && <div className="flex flex-wrap items-center gap-2 border-b p-2"><div className="relative min-w-52 flex-1"><Search className="absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search records..." className="h-8 rounded-sm pl-8 text-xs shadow-none" /></div><Button variant="outline" size="sm" className="h-8 rounded-sm shadow-none"><Filter />Filter</Button><Button variant="outline" size="sm" className="h-8 rounded-sm shadow-none"><Download />Export</Button></div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-xs"><thead><tr className="border-b bg-table-head text-muted-foreground">{columns.map((column) => <th key={column.key} className={cn("h-8 whitespace-nowrap px-3 text-left text-[10px] font-semibold uppercase", column.align === "right" && "text-right")}>{column.label}</th>)}<th className="w-10" /></tr></thead><tbody>{filtered.map((row, index) => <tr key={`${Object.values(row)[0]}-${index}`} className="border-b last:border-b-0 hover:bg-muted/45">{columns.map((column) => <td key={column.key} className={cn("h-9 whitespace-nowrap px-3 tabular-nums", column.align === "right" && "text-right font-medium")}>{column.status ? <Badge variant="outline" className={cn("rounded-sm px-1.5 py-0 text-[10px] font-medium shadow-none", statusClass(String(row[column.key])))}>{row[column.key]}</Badge> : row[column.key]}</td>)}<td className="px-2"><Button variant="ghost" size="icon" aria-label="Row actions" className="h-7 w-7 rounded-sm"><MoreHorizontal className="size-3.5" /></Button></td></tr>)}</tbody></table></div>
    <div className="flex h-10 items-center justify-between border-t px-3 text-[10px] text-muted-foreground"><span>{filtered.length} records · Page {page} of 3</span><div className="flex gap-1"><Button variant="outline" size="icon" aria-label="Previous page" className="h-6 w-6 rounded-sm shadow-none" onClick={() => setPage((p) => Math.max(1, p - 1))}><ChevronLeft /></Button><Button variant="outline" size="icon" aria-label="Next page" className="h-6 w-6 rounded-sm shadow-none" onClick={() => setPage((p) => Math.min(3, p + 1))}><ChevronRight /></Button></div></div>
  </div>;
}

export function TabsBar({ tabs, active, onChange }: { tabs: string[]; active: string; onChange: (tab: string) => void }) {
  return <div className="flex gap-5 overflow-x-auto border-b bg-card px-3">{tabs.map((tab) => <button key={tab} type="button" onClick={() => onChange(tab)} className={cn("h-10 whitespace-nowrap border-b-2 text-xs font-medium", active === tab ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground")}>{tab}</button>)}</div>;
}

export function Field({ label, defaultValue, type = "text", placeholder }: { label: string; defaultValue?: string; type?: string; placeholder?: string }) {
  return <label className="grid gap-1 text-[11px] font-medium text-foreground"><span>{label}</span><Input type={type} defaultValue={defaultValue} placeholder={placeholder} className="h-8 rounded-sm text-xs shadow-none" /></label>;
}

export function SelectField({ label, options, defaultValue }: { label: string; options: string[]; defaultValue?: string }) {
  return <label className="grid gap-1 text-[11px] font-medium"><span>{label}</span><select defaultValue={defaultValue} className="h-8 rounded-sm border border-input bg-background px-2 text-xs outline-none focus:ring-1 focus:ring-ring">{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
