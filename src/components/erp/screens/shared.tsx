import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";

export const money = (n: number | string | null | undefined) =>
  `৳${Number(n ?? 0).toLocaleString("en-US")}`;

export const fmtDate = (d?: string | Date | null) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })
    : "—";

export const statusLabel = (s?: string | null) =>
  (s ?? "")
    .replace(/_/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());

export const num = (v: unknown) => Number(v ?? 0);

export function useData<T>(key: unknown[], path: string, enabled = true) {
  return useQuery({ queryKey: key, queryFn: () => api.get<T>(path), enabled });
}

// Runs a mutation promise: invalidates all queries on success, toasts errors.
export function useSave() {
  const qc = useQueryClient();
  return (promise: Promise<unknown>, label = "Saved successfully"): Promise<void> =>
    promise
      .then(() => {
        qc.invalidateQueries();
        toast.success(label);
      })
      .catch((err) => {
        toast.error(err instanceof Error ? err.message : "Request failed");
      });
}

export interface ProductLite {
  id: number;
  sku: string;
  name: string;
  purchasePrice: string;
  salesPrice: string;
  taxRateId: number | null;
  unit?: { name: string; code: string };
}

export interface LineItem {
  productId: number;
  quantity: string;
  rate: string;
}

// Shared line-item editor used by order/invoice/chalan forms.
export function ItemsEditor({
  products,
  items,
  onChange,
  priceField,
}: {
  products: ProductLite[];
  items: LineItem[];
  onChange: (items: LineItem[]) => void;
  priceField: "purchasePrice" | "salesPrice";
}) {
  const update = (index: number, patch: Partial<LineItem>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };
  const selectProduct = (index: number, productId: number) => {
    const product = products.find((p) => p.id === productId);
    update(index, { productId, rate: product ? String(product[priceField]) : "" });
  };

  return (
    <div className="overflow-hidden rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-table-head text-left text-[11px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-3 py-2">Item</th>
            <th className="w-24 px-3 py-2 text-right">Quantity</th>
            <th className="w-24 px-3 py-2 text-right">Rate</th>
            <th className="w-28 px-3 py-2 text-right">Total</th>
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {items.map((item, index) => (
            <tr key={index} className="border-b last:border-0">
              <td className="px-3 py-1.5">
                <select
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-xs"
                  value={item.productId || ""}
                  onChange={(e) => selectProduct(index, Number(e.target.value))}
                  required
                >
                  <option value="" disabled>
                    Select product
                  </option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.sku}
                    </option>
                  ))}
                </select>
              </td>
              <td className="px-3 py-1.5">
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-right text-xs"
                  value={item.quantity}
                  onChange={(e) => update(index, { quantity: e.target.value })}
                />
              </td>
              <td className="px-3 py-1.5">
                <input
                  type="number"
                  min="0"
                  step="any"
                  required
                  className="h-9 w-full rounded-md border border-input bg-card px-2 text-right text-xs"
                  value={item.rate}
                  onChange={(e) => update(index, { rate: e.target.value })}
                />
              </td>
              <td className="px-3 py-1.5 text-right text-xs font-semibold tabular-nums">
                {money(num(item.quantity) * num(item.rate))}
              </td>
              <td className="px-2 py-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-destructive"
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                >
                  <Trash2 className="size-4" />
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="border-t bg-surface-subtle p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange([...items, { productId: 0, quantity: "", rate: "" }])}
        >
          Add line item
        </Button>
      </div>
    </div>
  );
}

// Shared controlled select bound to entity id.
export function EntitySelect({
  label,
  value,
  onChange,
  options,
  required = true,
}: {
  label: string;
  value: number | "";
  onChange: (id: number) => void;
  options: { id: number; name: string }[];
  required?: boolean;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-semibold">
      <span>
        {label}
        {required && <span className="ml-0.5 text-destructive">*</span>}
      </span>
      <select
        className="h-11 rounded-lg border border-input bg-card px-2.5 text-sm md:h-9 md:text-xs"
        value={value}
        required={required}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        <option value="" disabled>
          Select {label.toLowerCase()}
        </option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </label>
  );
}

export function useActionDialog() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Record<string, string> | undefined>();
  return {
    open,
    setOpen,
    editing,
    create: () => {
      setEditing(undefined);
      setOpen(true);
    },
    edit: (row: Record<string, string | number>) => {
      setEditing(Object.fromEntries(Object.entries(row).map(([k, v]) => [k, String(v)])));
      setOpen(true);
    },
  };
}
