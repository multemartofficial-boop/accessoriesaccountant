import { useState } from "react";
import { Activity, Clock3 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, PageHeader, Panel } from "../ui";
import { fmtDate, statusLabel, useData } from "./shared";

interface AuditEntry {
  id: number;
  action: string;
  module: string;
  recordId?: string;
  ipAddress?: string;
  createdAt: string;
  user?: { name: string } | null;
}

const MODULES = [
  "All modules",
  "Buyers",
  "Suppliers",
  "Products",
  "Purchase",
  "Sales",
  "Inventory",
  "Cash & Bank",
  "Warehouses",
  "Approvals",
  "VAT & Tax",
  "Settings",
  "Auth",
];

export function AuditScreen() {
  const [module, setModule] = useState("All modules");
  const [date, setDate] = useState("");
  const params = new URLSearchParams();
  if (module !== "All modules") params.set("module", module);
  if (date) {
    params.set("from", date);
    params.set("to", date);
  }
  const { data: events } = useData<AuditEntry[]>(["audit", module, date], `/audit-log?${params}`);

  return (
    <>
      <PageHeader
        eyebrow="Governance"
        title="Audit log"
        description="Chronological record of user activity and changes across every module."
        action="Export log"
        onAction={() => toast.success("Audit log export prepared")}
      />
      <div className="grid gap-5 xl:grid-cols-[250px_1fr]">
        <Panel title="Activity filters">
          <div className="grid gap-4 p-4">
            <label className="grid gap-1.5 text-xs font-semibold">
              <span>Module</span>
              <select
                className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
                value={module}
                onChange={(e) => setModule(e.target.value)}
              >
                {MODULES.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <Field label="Date" type="date" value={date} onChange={setDate} />
            <Button onClick={() => toast.success("Activity filters applied")}>Apply filters</Button>
          </div>
        </Panel>
        <Panel
          title={date ? fmtDate(date) : "All activity"}
          subtitle={`${events?.length ?? 0} recorded activities`}
        >
          <div className="divide-y">
            {(events ?? []).map((event, index) => (
              <div key={event.id} className="relative flex gap-4 px-5 py-4">
                <div className="relative z-10 grid size-9 shrink-0 place-items-center rounded-full border bg-card text-primary shadow-sm">
                  <Activity className="size-4" />
                </div>
                {index < (events?.length ?? 0) - 1 && (
                  <span className="absolute bottom-0 left-[37px] top-12 w-px bg-border" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-[13px]">
                      <strong>{event.user?.name ?? "System"}</strong>{" "}
                      {statusLabel(event.action).toLowerCase()}{" "}
                      {event.recordId ? (
                        <span className="text-muted-foreground">· {event.recordId}</span>
                      ) : null}
                    </p>
                    <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Clock3 className="size-3.5" />
                      {new Date(event.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {event.module}
                    {event.ipAddress ? ` · ${event.ipAddress}` : ""}
                  </p>
                </div>
              </div>
            ))}
            {(events ?? []).length === 0 && (
              <div className="p-10 text-center text-xs text-muted-foreground">
                No activity matches the filters.
              </div>
            )}
          </div>
        </Panel>
      </div>
    </>
  );
}
