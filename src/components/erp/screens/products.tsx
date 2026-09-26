import { Fragment, useEffect, useState } from "react";
import { Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Field, PageHeader, Panel, TabsBar } from "../ui";
import { api } from "@/lib/api";
import { money, num, statusLabel, useData, useSave } from "./shared";

interface Product {
  id: number;
  sku: string;
  name: string;
  color?: string;
  size?: string;
  purchasePrice: string;
  salesPrice: string;
  minStock: string;
  status: string;
  totalStock: string;
  category: { id: number; name: string };
  unit: { id: number; name: string };
  taxRateId?: number | null;
}

interface Category {
  id: number;
  name: string;
  code: string;
  description?: string;
  _count: { products: number };
}

interface Unit {
  id: number;
  name: string;
  code: string;
}

const PALETTE = [
  "bg-red-100 text-red-700",
  "bg-blue-100 text-blue-700",
  "bg-emerald-100 text-emerald-700",
  "bg-amber-100 text-amber-700",
  "bg-purple-100 text-purple-700",
  "bg-pink-100 text-pink-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
];

function avatarClass(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return PALETTE[Math.abs(hash) % PALETTE.length] ?? "bg-muted text-muted-foreground";
}

function avatarLetter(name: string, sku: string) {
  return (name || sku || "?").charAt(0).toUpperCase();
}

function stockStatus(p: Product) {
  const total = num(p.totalStock);
  const min = num(p.minStock);
  if (total <= 0) return "Out of Stock";
  if (total < min) return "Low Stock";
  return "In Stock";
}

function stockPillClass(status: string) {
  if (status === "In Stock") return "border-success/25 bg-success-soft text-success";
  if (status === "Low Stock") return "border-warning/25 bg-warning-soft text-warning";
  if (status === "Out of Stock")
    return "border-destructive/20 bg-destructive-soft text-destructive";
  return "border-border bg-muted text-muted-foreground";
}

export function ProductsScreen() {
  const [tab, setTab] = useState("Product list");
  const [editing, setEditing] = useState<Product | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [draft, setDraft] = useState({
    purchasePrice: "",
    salesPrice: "",
    minStock: "",
    status: "ACTIVE",
  });
  const save = useSave();
  const { data: products } = useData<Product[]>(["products"], "/products");
  const { data: categories } = useData<Category[]>(["categories"], "/categories");
  const { data: units } = useData<Unit[]>(["units"], "/units");
  const { data: rates } = useData<{ id: number; name: string }[]>(["tax-rates"], "/vat/rates");

  const selectedProduct = products?.find((p) => p.id === selectedId);

  useEffect(() => {
    if (selectedProduct) {
      setDraft({
        purchasePrice: String(selectedProduct.purchasePrice),
        salesPrice: String(selectedProduct.salesPrice),
        minStock: String(selectedProduct.minStock),
        status: (selectedProduct.status || "ACTIVE").toUpperCase(),
      });
    }
  }, [selectedProduct]);

  const totalSkus = products?.length ?? 0;
  const lowStockCount = (products ?? []).filter((p) => stockStatus(p) === "Low Stock").length;
  const outOfStockCount = (products ?? []).filter((p) => stockStatus(p) === "Out of Stock").length;

  return (
    <>
      <PageHeader
        eyebrow="Inventory setup"
        title="Product & accessories master"
        description="Maintain SKU, commercial pricing and minimum stocking rules."
        action="Add product"
        onAction={() => {
          setEditing(null);
          setTab("Add / edit product");
        }}
      />
      <Panel title="Product master">
        <TabsBar
          tabs={["Product list", "Add / edit product", "Categories & units"]}
          active={tab}
          onChange={setTab}
        />
        {tab === "Product list" ? (
          <div className="bg-workspace/40 p-3">
            <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              {[
                { label: "Total SKUs", value: totalSkus },
                { label: "Low stock", value: lowStockCount, tone: "warning" },
                { label: "Out of stock", value: outOfStockCount, tone: "destructive" },
              ].map((stat) => (
                <div
                  key={stat.label}
                  className="flex items-center justify-between rounded-md border bg-card px-3 py-2 shadow-card"
                >
                  <div className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                    {stat.label}
                  </div>
                  <div
                    className={cn(
                      "text-base font-bold tabular-nums",
                      stat.tone === "warning" && "text-warning",
                      stat.tone === "destructive" && "text-destructive",
                    )}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>
            <div className="overflow-hidden rounded-lg border bg-card shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-left text-sm">
                  <thead>
                    <tr className="border-b bg-table-head text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                      <th className="px-3 py-2">Item</th>
                      <th className="px-3 py-2">SKU</th>
                      <th className="px-3 py-2">Category</th>
                      <th className="px-3 py-2">Variant</th>
                      <th className="px-3 py-2 text-right">Purchase</th>
                      <th className="px-3 py-2 text-right">Sales</th>
                      <th className="px-3 py-2 text-center">Stock</th>
                      <th className="w-10 px-2 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {(products ?? []).map((p) => {
                      const status = stockStatus(p);
                      const isSelected = selectedId === p.id;
                      return (
                        <Fragment key={p.id}>
                          <tr
                            onClick={() => setSelectedId(isSelected ? null : p.id)}
                            className={cn(
                              "cursor-pointer border-b last:border-b-0 transition-colors hover:bg-accent/55",
                              isSelected && "bg-accent/55",
                            )}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2.5">
                                <div
                                  className={cn(
                                    "flex h-7 w-7 shrink-0 items-center justify-center rounded text-[11px] font-bold",
                                    avatarClass(p.name),
                                  )}
                                >
                                  {avatarLetter(p.name, p.sku)}
                                </div>
                                <span className="text-[13px] font-medium">{p.name}</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <span className="font-mono text-[13px] font-bold">{p.sku}</span>
                            </td>
                            <td className="px-3 py-2">
                              <Badge variant="outline" className="text-[11px]">
                                {p.category.name}
                              </Badge>
                            </td>
                            <td className="px-3 py-2 text-[12px] text-muted-foreground">
                              {p.color ?? "—"} · {p.size ?? "—"} · {p.unit.name}
                            </td>
                            <td className="px-3 py-2 text-right text-[13px] tabular-nums">
                              {money(p.purchasePrice)}
                            </td>
                            <td className="px-3 py-2 text-right text-[13px] tabular-nums font-semibold">
                              {money(p.salesPrice)}
                            </td>
                            <td className="px-3 py-2 text-center">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                                  stockPillClass(status),
                                )}
                              >
                                {status}
                              </Badge>
                            </td>
                            <td className="px-2 py-2 text-right">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  setSelectedId(isSelected ? null : p.id);
                                }}
                              >
                                <Pencil className="size-4" />
                              </Button>
                            </td>
                          </tr>
                          {isSelected && (
                            <tr className="border-b bg-surface-subtle">
                              <td colSpan={8} className="px-3 py-3">
                                <form
                                  onSubmit={(event) => {
                                    event.preventDefault();
                                    save(
                                      api.put(`/products/${p.id}`, {
                                        name: p.name,
                                        sku: p.sku,
                                        categoryId: p.category.id,
                                        unitId: p.unit.id,
                                        color: p.color,
                                        size: p.size,
                                        purchasePrice: Number(draft.purchasePrice),
                                        salesPrice: Number(draft.salesPrice),
                                        minStock: Number(draft.minStock),
                                        taxRateId: p.taxRateId ?? null,
                                        status: draft.status.toUpperCase(),
                                      }),
                                      "Product updated",
                                    ).then(() => setSelectedId(null));
                                  }}
                                  className="flex flex-wrap items-end gap-3"
                                >
                                  <div className="grid gap-1">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                      Purchase
                                    </label>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={draft.purchasePrice}
                                      onChange={(event) =>
                                        setDraft((d) => ({
                                          ...d,
                                          purchasePrice: event.target.value,
                                        }))
                                      }
                                      className="h-8 w-28 rounded-md border border-input bg-card px-2 text-xs"
                                    />
                                  </div>
                                  <div className="grid gap-1">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                      Sales
                                    </label>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={draft.salesPrice}
                                      onChange={(event) =>
                                        setDraft((d) => ({ ...d, salesPrice: event.target.value }))
                                      }
                                      className="h-8 w-28 rounded-md border border-input bg-card px-2 text-xs"
                                    />
                                  </div>
                                  <div className="grid gap-1">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                      Min stock
                                    </label>
                                    <Input
                                      type="number"
                                      step="any"
                                      value={draft.minStock}
                                      onChange={(event) =>
                                        setDraft((d) => ({ ...d, minStock: event.target.value }))
                                      }
                                      className="h-8 w-24 rounded-md border border-input bg-card px-2 text-xs"
                                    />
                                  </div>
                                  <div className="grid gap-1">
                                    <label className="text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
                                      Status
                                    </label>
                                    <select
                                      value={draft.status}
                                      onChange={(event) =>
                                        setDraft((d) => ({ ...d, status: event.target.value }))
                                      }
                                      className="h-8 rounded-md border border-input bg-card px-2 text-xs"
                                    >
                                      {[draft.status, "ACTIVE", "INACTIVE", "REVIEW"]
                                        .filter((v, i, a) => a.indexOf(v) === i)
                                        .map((option) => (
                                          <option key={option} value={option}>
                                            {statusLabel(option)}
                                          </option>
                                        ))}
                                    </select>
                                  </div>
                                  <Button type="submit" size="sm" className="h-8">
                                    <Save className="size-4" />
                                    Save
                                  </Button>
                                </form>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {(products ?? []).length === 0 && (
                <div className="px-4 py-12 text-center text-sm text-muted-foreground">
                  No products found.
                </div>
              )}
            </div>
          </div>
        ) : tab === "Add / edit product" ? (
          <ProductForm
            initial={editing}
            categories={categories ?? []}
            units={units ?? []}
            rates={rates ?? []}
            onDone={() => {
              setEditing(null);
              setTab("Product list");
            }}
          />
        ) : (
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <Panel title="Product categories" subtitle={`${categories?.length ?? 0} categories`}>
              <div className="divide-y">
                {(categories ?? []).map((c) => (
                  <div
                    className="flex items-center justify-between px-4 py-3 text-[13px]"
                    key={c.id}
                  >
                    <span>
                      {c.name} · {c._count.products} SKUs
                    </span>
                  </div>
                ))}
              </div>
              <CategoryForm />
            </Panel>
            <Panel title="Units" subtitle={`${units?.length ?? 0} units`}>
              <div className="divide-y">
                {(units ?? []).map((u) => (
                  <div
                    className="flex items-center justify-between px-4 py-3 text-[13px]"
                    key={u.id}
                  >
                    <span>
                      {u.name} · {u.code}
                    </span>
                  </div>
                ))}
              </div>
              <UnitForm />
            </Panel>
          </div>
        )}
      </Panel>
    </>
  );
}

function ProductForm({
  initial,
  categories,
  units,
  rates,
  onDone,
}: {
  initial: Product | null;
  categories: Category[];
  units: Unit[];
  rates: { id: number; name: string }[];
  onDone: () => void;
}) {
  const save = useSave();
  return (
    <form
      key={initial?.id ?? "new"}
      onSubmit={(event) => {
        event.preventDefault();
        const v = Object.fromEntries(new FormData(event.currentTarget).entries());
        const payload = {
          name: v["Product name"],
          sku: v["SKU"],
          categoryId: categories.find((c) => c.name === v["Category"])?.id,
          unitId: units.find((u) => u.name === v["Unit"])?.id,
          color: v["Color"],
          size: v["Size"],
          purchasePrice: Number(v["Purchase price"]),
          salesPrice: Number(v["Sales price"]),
          minStock: Number(v["Minimum stock"]),
          taxRateId: rates.find((r) => r.name === v["Tax rate"])?.id ?? null,
        };
        save(
          initial ? api.put(`/products/${initial.id}`, payload) : api.post("/products", payload),
          "Product saved",
        ).then(onDone);
      }}
      className="bg-workspace/40 p-5"
    >
      <div className="mx-auto max-w-5xl rounded-lg border bg-card p-5 shadow-card">
        <div className="mb-5 border-b pb-4">
          <h3 className="text-sm font-semibold">Product information</h3>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Core identity, variants, pricing and replenishment controls.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          <Field label="Product name" defaultValue={initial?.name} required />
          <Field label="SKU" defaultValue={initial?.sku} required />
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>
              Category<span className="ml-0.5 text-destructive">*</span>
            </span>
            <select
              name="Category"
              required
              defaultValue={initial?.category.name}
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
            >
              {categories.map((c) => (
                <option key={c.id}>{c.name}</option>
              ))}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Unit</span>
            <select
              name="Unit"
              defaultValue={initial?.unit.name}
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
            >
              {units.map((u) => (
                <option key={u.id}>{u.name}</option>
              ))}
            </select>
          </label>
          <Field label="Color" defaultValue={initial?.color} />
          <Field label="Size" defaultValue={initial?.size} />
          <Field
            label="Purchase price"
            type="number"
            defaultValue={initial?.purchasePrice}
            required
          />
          <Field label="Sales price" type="number" defaultValue={initial?.salesPrice} required />
          <Field label="Minimum stock" type="number" defaultValue={initial?.minStock} required />
          <label className="grid gap-1.5 text-xs font-semibold">
            <span>Tax rate</span>
            <select
              name="Tax rate"
              defaultValue={rates.find((r) => r.id === initial?.taxRateId)?.name ?? ""}
              className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
            >
              <option value="">None</option>
              {rates.map((r) => (
                <option key={r.id}>{r.name}</option>
              ))}
            </select>
          </label>
        </div>
        <div className="mobile-action-bar mt-6 flex justify-end gap-2">
          <Button variant="outline" type="reset">
            Reset
          </Button>
          <Button type="submit">
            <Save />
            Save product
          </Button>
        </div>
      </div>
    </form>
  );
}

function CategoryForm() {
  const save = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(
          api.post("/categories", {
            name: v["name"],
            code: v["code"],
            description: v["description"],
          }),
          "Category saved",
        );
        e.currentTarget.reset();
      }}
      className="border-t p-4"
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Name" name="name" required />
        <Field label="Code" name="code" required />
        <Field label="Description" name="description" />
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm">
          <Save />
          Add category
        </Button>
      </div>
    </form>
  );
}

function UnitForm() {
  const save = useSave();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const v = Object.fromEntries(new FormData(e.currentTarget).entries());
        save(api.post("/units", { name: v["name"], code: v["code"] }), "Unit saved");
        e.currentTarget.reset();
      }}
      className="border-t p-4"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Name" name="name" required />
        <Field label="Code" name="code" required />
      </div>
      <div className="mt-3 flex justify-end">
        <Button type="submit" size="sm">
          <Save />
          Add unit
        </Button>
      </div>
    </form>
  );
}
