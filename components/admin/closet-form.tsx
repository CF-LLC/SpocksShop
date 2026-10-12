import { productConditions } from "@/lib/types";

type Values = {
  title?: string; sku?: string; slug?: string; description?: string; categoryId?: string | null; brand?: string | null;
  condition?: string; conditionNotes?: string | null; price?: number; originalPrice?: number | null; purchaseCost?: number | null;
  weightLb?: string | null; quantity?: number; status?: string; featured?: boolean;
};

const statuses = ["draft", "listed", "reserved", "sold", "archived"];

export function ClosetForm({ action, values = {}, categories, submitLabel }: {
  action: string; values?: Values; categories: { id: string; name: string }[]; submitLabel: string;
}) {
  return (
    <form action={action} method="post" className="grid gap-4 sm:grid-cols-2">
      <label className="text-sm sm:col-span-2">Title<input name="title" required defaultValue={values.title} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">SKU<input name="sku" required defaultValue={values.sku} className="field-input mt-1 w-full font-mono" /></label>
      <label className="text-sm">Slug (optional)<input name="slug" defaultValue={values.slug} placeholder="from title" className="field-input mt-1 w-full" /></label>
      <label className="text-sm sm:col-span-2">Description<textarea name="description" rows={4} defaultValue={values.description} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">Category
        <select name="categoryId" defaultValue={values.categoryId ?? ""} className="field-input mt-1 w-full">
          <option value="">None</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </label>
      <label className="text-sm">Brand<input name="brand" defaultValue={values.brand ?? ""} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">Condition
        <select name="condition" defaultValue={values.condition ?? "Good"} className="field-input mt-1 w-full">
          {productConditions.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className="text-sm">Condition notes<input name="conditionNotes" defaultValue={values.conditionNotes ?? ""} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">Price ($)<input name="price" type="number" step="0.01" min="0.01" required defaultValue={values.price} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">Original price ($)<input name="originalPrice" type="number" step="0.01" min="0" defaultValue={values.originalPrice ?? ""} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">Purchase cost ($, admin only)<input name="purchaseCost" type="number" step="0.01" min="0" defaultValue={values.purchaseCost ?? ""} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">Weight (lb)<input name="weightLb" type="number" step="0.01" min="0" defaultValue={values.weightLb ?? ""} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">Quantity on hand<input name="quantity" type="number" min="0" required defaultValue={values.quantity ?? 1} className="field-input mt-1 w-full" /></label>
      <label className="text-sm">Status
        <select name="status" defaultValue={values.status ?? "draft"} className="field-input mt-1 w-full">
          {statuses.map((s) => <option key={s}>{s}</option>)}
        </select>
      </label>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="featured" defaultChecked={values.featured} /> Featured</label>
      <div className="sm:col-span-2"><button type="submit" className="btn btn-primary">{submitLabel}</button></div>
    </form>
  );
}
