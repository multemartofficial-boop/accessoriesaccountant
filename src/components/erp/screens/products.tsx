import { useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ActionDialog,
  DataTable,
  Field,
  PageHeader,
  Panel,
  TabsBar,
  type TableRowData,
} from "../ui";
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

export function ProductsScreen() {
  const [tab, setTab] = useState("Product list");
  const [editing, setEditing] = useState<Product | null>(null);
  const save = useSave();
  const { data: products } = useData<Product[]>(["products"], "/products");
  const { data: categories } = useData<Category[]>(["categories"], "/categories");
  const { data: units } = useData<Unit[]>(["units"], "/units");
  const { data: rates } = useData<{ id: number; name: string }[]>(["tax-rates"], "/vat/rates");

  const rows = (products ?? []).map((p) => ({
    id: p.id,
    sku: p.sku,
    product: p.name,
    category: p.category.name,
    color: p.color ?? "—",
    size: p.size ?? "—",
    unit: p.unit.name,
    purchase: money(p.purchasePrice),
    sales: money(p.salesPrice),
    status:
      num(p.totalStock) <= 0
        ? "Out of Stock"
        : num(p.totalStock) < num(p.minStock)
          ? "Low Stock"
          : "In Stock",
  }));

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
          <DataTable
            columns={[
              { key: "sku", label: "SKU" },
              { key: "product", label: "Product" },
              { key: "category", label: "Category" },
              { key: "color", label: "Color" },
              { key: "size", label: "Size" },
              { key: "unit", label: "Unit" },
              { key: "purchase", label: "Purchase", align: "right" },
              { key: "sales", label: "Sales", align: "right" },
              { key: "status", label: "Status", status: true },
            ]}
            rows={rows}
            onRowClick={(row: TableRowData) => {
              setEditing(products?.find((p) => p.id === Number(row["id"])) ?? null);
              setTab("Add / edit product");
            }}
            onEdit={(row) => {
              setEditing(products?.find((p) => p.id === Number(row["id"])) ?? null);
              setTab("Add / edit product");
            }}
            onDelete={(row) => save(api.del(`/products/${row["id"]}`), "Product deleted")}
          />
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
