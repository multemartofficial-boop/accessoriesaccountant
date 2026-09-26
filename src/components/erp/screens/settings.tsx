import { useState } from "react";
import { Activity, Download, FileText, Save, UserRound, type LucideIcon } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ActionDialog, DataTable, Field, PageHeader, SelectField } from "../ui";
import { api } from "@/lib/api";
import { num, statusLabel, useActionDialog, useData, useSave } from "./shared";

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

interface ErpUser {
  id: number;
  name: string;
  email: string;
  role: string;
  location?: string;
  status: string;
}

interface Sequence {
  docType: string;
  prefix: string;
  lastNumber: number;
  padding: number;
  yearInfix: boolean;
}

export function SettingsScreen() {
  const [tab, setTab] = useState("Company profile");
  const dialog = useActionDialog();
  const save = useSave();
  const [editingUser, setEditingUser] = useState<ErpUser | null>(null);
  const tabs = [
    "Company profile",
    "Document templates",
    "Users & roles",
    "Numbering",
    "Tax & currency",
    "Backup & export",
    "Notifications",
  ];

  const { data: company } = useData<Company>(["company"], "/settings/company");
  const { data: users } = useData<ErpUser[]>(["users"], "/settings/users");
  const { data: settings } = useData<Record<string, string>>(["settings"], "/settings");
  const { data: sequences } = useData<Sequence[]>(["sequences"], "/settings/sequences");

  return (
    <>
      <PageHeader
        eyebrow="Administration"
        title="Settings"
        description="Company identity, access control and system-wide defaults."
      />
      <div className="grid gap-5 xl:grid-cols-[220px_1fr]">
        <nav className="h-fit rounded-lg border bg-card p-2 shadow-card">
          {tabs.map((item) => (
            <button
              key={item}
              onClick={() => setTab(item)}
              className={`flex w-full items-center gap-2 rounded-md px-3 py-2.5 text-left text-[13px] font-medium ${
                tab === item
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <SettingsIcon label={item} />
              {item}
            </button>
          ))}
        </nav>
        <div className="rounded-lg border bg-card shadow-card">
          <div className="border-b px-5 py-4">
            <h2 className="text-sm font-semibold">{tab}</h2>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Manage {tab.toLowerCase()} defaults for the company workspace.
            </p>
          </div>

          {tab === "Company profile" && (
            <form
              key={company?.name ?? "company"}
              onSubmit={(e) => {
                e.preventDefault();
                const v = Object.fromEntries(new FormData(e.currentTarget).entries());
                save(api.put("/settings/company", v), "Company profile saved");
              }}
              className="grid gap-4 p-5 sm:grid-cols-2"
            >
              <Field label="Company name" name="name" defaultValue={company?.name} required />
              <Field label="Legal name" name="legalName" defaultValue={company?.legalName} />
              <Field label="Phone" name="phone" defaultValue={company?.phone} />
              <Field label="Email" name="email" type="email" defaultValue={company?.email} />
              <Field label="Address" name="address" defaultValue={company?.address} />
              <Field label="Website" name="website" defaultValue={company?.website} />
              <Field
                label="VAT registration (BIN)"
                name="vatRegNo"
                defaultValue={company?.vatRegNo}
              />
              <Field
                label="Trade license"
                name="tradeLicenseNo"
                defaultValue={company?.tradeLicenseNo}
              />
              <Field label="Logo URL" name="logoUrl" defaultValue={company?.logoUrl} />
              <div className="flex items-end justify-end sm:col-span-2">
                <Button type="submit" size="sm">
                  <Save /> Save profile
                </Button>
              </div>
            </form>
          )}

          {tab === "Document templates" && (
            <form
              key={JSON.stringify(settings)}
              onSubmit={(e) => {
                e.preventDefault();
                const v = Object.fromEntries(new FormData(e.currentTarget).entries());
                save(
                  api.put("/settings", {
                    doc_invoice_terms: v["Invoice terms"],
                    doc_invoice_footer: v["Invoice footer"],
                    doc_chalan_notes: v["Chalan default notes"],
                    doc_chalan_type: v["Chalan type"],
                    doc_proforma_notes: v["Proforma notes"],
                    bank_name: v["Bank name"],
                    bank_holder: v["Account holder"],
                    bank_account_no: v["A/C no."],
                    bank_swift: v["Swift no."],
                    bank_routing: v["Routing no."],
                    bank_address: v["Bank address"],
                  }),
                  "Document templates saved",
                );
              }}
              className="grid gap-4 p-5"
            >
              <p className="text-[12px] text-muted-foreground">
                These texts print on every invoice and chalan. Company name, logo, address, phone
                and BIN come from the Company profile tab.
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
                  <span>Invoice terms (printed under "Other comments")</span>
                  <Textarea
                    name="Invoice terms"
                    defaultValue={
                      settings?.["doc_invoice_terms"] ??
                      "1. Payment due within the agreed terms.\n2. Please include the invoice number on your cheque."
                    }
                    className="rounded-lg text-[13px] shadow-none"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
                  <span>Invoice footer line</span>
                  <Textarea
                    name="Invoice footer"
                    defaultValue={
                      settings?.["doc_invoice_footer"] ?? "Thank you for your business!"
                    }
                    className="rounded-lg text-[13px] shadow-none"
                  />
                </label>
                <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
                  <span>Chalan default notes</span>
                  <Textarea
                    name="Chalan default notes"
                    defaultValue={
                      settings?.["doc_chalan_notes"] ??
                      "Received the above goods in good order and condition."
                    }
                    className="rounded-lg text-[13px] shadow-none"
                  />
                </label>
                <SelectField
                  label="Chalan type"
                  name="Chalan type"
                  options={["Delivery", "Job work", "Sample", "Returnable"]}
                  defaultValue={settings?.["doc_chalan_type"] ?? "Delivery"}
                />
              </div>
              <div className="border-t pt-4">
                <p className="mb-3 text-[12px] font-semibold">
                  Proforma invoice — bank details & notes
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field
                    label="Bank name"
                    name="Bank name"
                    defaultValue={settings?.["bank_name"]}
                  />
                  <Field
                    label="Account holder"
                    name="Account holder"
                    defaultValue={settings?.["bank_holder"]}
                  />
                  <Field
                    label="A/C no."
                    name="A/C no."
                    defaultValue={settings?.["bank_account_no"]}
                  />
                  <Field
                    label="Swift no."
                    name="Swift no."
                    defaultValue={settings?.["bank_swift"]}
                  />
                  <Field
                    label="Routing no."
                    name="Routing no."
                    defaultValue={settings?.["bank_routing"]}
                  />
                  <Field
                    label="Bank address"
                    name="Bank address"
                    defaultValue={settings?.["bank_address"]}
                  />
                  <label className="grid gap-1.5 text-xs font-semibold sm:col-span-2">
                    <span>Proforma notes (numbered list printed above the signatures)</span>
                    <Textarea
                      name="Proforma notes"
                      defaultValue={
                        settings?.["doc_proforma_notes"] ??
                        "1. Complain should be brought to our notice in writing/mail within 7 days of delivery of the goods.\n2. Payment should be made only by RTGS / bank transfer.\n3. Goods once delivered will not be taken back."
                      }
                      className="rounded-lg text-[13px] shadow-none"
                    />
                  </label>
                </div>
              </div>
              <div className="flex justify-end">
                <Button type="submit" size="sm">
                  <Save /> Save templates
                </Button>
              </div>
            </form>
          )}

          {tab === "Users & roles" && (
            <div className="p-5">
              <div className="mb-4 flex justify-end">
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingUser(null);
                    dialog.create();
                  }}
                >
                  Add user
                </Button>
              </div>
              <DataTable
                searchable={false}
                columns={[
                  { key: "name", label: "User" },
                  { key: "email", label: "Email" },
                  { key: "role", label: "Role" },
                  { key: "location", label: "Location" },
                  { key: "status", label: "Status", status: true },
                ]}
                rows={(users ?? []).map((u) => ({
                  id: u.id,
                  name: u.name,
                  email: u.email,
                  role: statusLabel(u.role),
                  location: u.location ?? "—",
                  status: statusLabel(u.status),
                }))}
                onEdit={(row) => {
                  setEditingUser(users?.find((u) => u.id === Number(row["id"])) ?? null);
                  dialog.setOpen(true);
                }}
                onDelete={(row) =>
                  save(api.del(`/settings/users/${row["id"]}`), "User deactivated")
                }
              />
            </div>
          )}

          {tab === "Numbering" && (
            <div className="p-5">
              <DataTable
                searchable={false}
                columns={[
                  { key: "type", label: "Document" },
                  { key: "prefix", label: "Prefix" },
                  { key: "next", label: "Next number", align: "right" },
                  { key: "format", label: "Format" },
                ]}
                rows={(sequences ?? []).map((s) => ({
                  type: statusLabel(s.docType),
                  prefix: s.prefix,
                  next: s.lastNumber + 1,
                  format: s.yearInfix
                    ? `${s.prefix}-YYMM-${"#".repeat(s.padding)}`
                    : `${s.prefix}-${"#".repeat(s.padding)}`,
                }))}
              />
            </div>
          )}

          {tab === "Tax & currency" && (
            <form
              key={JSON.stringify(settings)}
              onSubmit={(e) => {
                e.preventDefault();
                const v = Object.fromEntries(new FormData(e.currentTarget).entries());
                save(
                  api.put("/settings", {
                    currency: v["Currency"],
                    vat_mode: v["VAT mode"],
                    approval_threshold: v["Approval threshold"],
                  }),
                  "Tax & currency saved",
                );
              }}
              className="grid gap-4 p-5 sm:grid-cols-2"
            >
              <SelectField
                label="Currency"
                name="Currency"
                options={["BDT", "USD", "EUR"]}
                defaultValue={settings?.["currency"] ?? "BDT"}
              />
              <SelectField
                label="VAT mode"
                name="VAT mode"
                options={["EXCLUSIVE", "INCLUSIVE"]}
                defaultValue={settings?.["vat_mode"] ?? "EXCLUSIVE"}
              />
              <Field
                label="Approval threshold"
                name="Approval threshold"
                type="number"
                defaultValue={settings?.["approval_threshold"] ?? "100000"}
              />
              <div className="flex items-end justify-end sm:col-span-2">
                <Button type="submit" size="sm">
                  <Save /> Save defaults
                </Button>
              </div>
            </form>
          )}

          {tab === "Backup & export" && (
            <div className="grid gap-4 p-5">
              <p className="text-[13px] text-muted-foreground">
                Download any report as CSV (Excel-compatible) from the Analytics Center, or export
                table data using the Export button on each list.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    try {
                      const { getToken } = await import("@/lib/api");
                      const res = await fetch("/api/system/backup", {
                        headers: { Authorization: `Bearer ${getToken()}` },
                      });
                      if (!res.ok) throw new Error(`Backup failed (${res.status})`);
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement("a");
                      a.href = url;
                      a.download = `garmenttrade-backup-${new Date().toISOString().slice(0, 10)}.json`;
                      a.click();
                      URL.revokeObjectURL(url);
                      toast.success("Backup downloaded");
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : "Backup failed");
                    }
                  }}
                >
                  <Download /> Download database backup
                </Button>
              </div>
            </div>
          )}

          {tab === "Notifications" && (
            <div className="divide-y">
              {(
                [
                  [
                    "Low stock alerts",
                    "Notify when stock falls below the product minimum",
                    "notify_low_stock",
                  ],
                  [
                    "Approval queue",
                    "Notify managers when a request is awaiting approval",
                    "notify_approvals",
                  ],
                ] as [string, string, string][]
              ).map(([title, desc, key]) => (
                <div key={key} className="flex items-center justify-between px-5 py-4">
                  <div>
                    <div className="text-[13px] font-semibold">{title}</div>
                    <div className="text-[11px] text-muted-foreground">{desc}</div>
                  </div>
                  <Switch
                    defaultChecked={settings?.[key] === "true"}
                    onCheckedChange={(checked) =>
                      save(api.put("/settings", { [key]: String(checked) }), "Preference saved")
                    }
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <ActionDialog
        open={dialog.open}
        onOpenChange={dialog.setOpen}
        title={editingUser ? "Edit user" : "Add user"}
        description="User account and role assignment."
        fields={[
          { label: "Name", name: "name", required: true },
          { label: "Email", name: "email", type: "email", required: true },
          { label: "Password", name: "password", type: "password", required: !editingUser },
          { label: "Role", name: "role", options: ["ADMIN", "MANAGER", "STAFF"], required: true },
          { label: "Location", name: "location" },
        ]}
        initialValues={
          editingUser
            ? {
                name: editingUser.name,
                email: editingUser.email,
                role: editingUser.role,
                location: editingUser.location ?? "",
              }
            : undefined
        }
        onSubmit={(values) => {
          const payload = { ...values };
          if (!payload["password"]) delete payload["password"];
          return save(
            editingUser
              ? api.put(`/settings/users/${editingUser.id}`, payload)
              : api.post("/settings/users", payload),
            "User saved",
          );
        }}
      />
    </>
  );
}

function SettingsIcon({ label }: { label: string }) {
  const Icon: LucideIcon =
    label === "Users & roles"
      ? UserRound
      : label === "Backup & export"
        ? Download
        : label === "Notifications"
          ? Activity
          : FileText;
  return <Icon className="size-3.5" />;
}
