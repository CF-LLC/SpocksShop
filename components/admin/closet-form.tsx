import { productConditions } from "@/lib/types";

type Values = {
  title?: string; sku?: string; slug?: string; description?: string; categoryId?: string | null; brand?: string | null;
  condition?: string; conditionNotes?: string | null; price?: number; originalPrice?: number | null; purchaseCost?: number | null;
  weightLb?: string | null; quantity?: number; status?: string; featured?: boolean; requiresApproval?: boolean;
};

const statuses = [
  ["draft", "Draft (hidden)"],
  ["listed", "Live in shop"],
  ["reserved", "Reserved"],
  ["pending_approval", "Pending approval (held)"],
  ["sold", "Sold"],
  ["archived", "Archived"],
] as const;

const label = "block text-sm font-medium text-slate-800";
const input = "field-input mt-1 w-full";

/** Mobile-first: one column on phones, the essentials (title, price, qty, status) first; details tucked away. */
export function ClosetForm({ action, values = {}, categories, submitLabel, isNew = false }: {
  action: string; values?: Values; categories: { id: string; name: string }[]; submitLabel: string; isNew?: boolean;
}) {
  return (
    <form action={action} method="post" className="space-y-4" data-testid="closet-form">
      <label className={label}>Title<input name="title" required maxLength={200} defaultValue={values.title} className={input} placeholder="e.g. Vintage Pyrex mixing bowl" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={label}>Price ($)<input name="price" type="number" inputMode="decimal" step="0.01" min="0.01" required defaultValue={values.price} className={input} /></label>
        <label className={label}>Quantity<input name="quantity" type="number" inputMode="numeric" min="0" required defaultValue={values.quantity ?? 1} className={input} /></label>
      </div>
      <label className={label}>Condition
        <select name="condition" defaultValue={values.condition ?? "Good"} className={input}>
          {productConditions.map((c) => <option key={c}>{c}</option>)}
        </select>
      </label>
      <label className={label}>Description<textarea name="description" rows={4} defaultValue={values.description} className={input} placeholder="Size, measurements, flaws, story…" /></label>
      <label className={label}>Status
        <select name="status" defaultValue={values.status ?? (isNew ? "listed" : "draft")} className={input} aria-describedby="status-hint">
          {statuses.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <span id="status-hint" className="mt-1 block text-xs font-normal text-slate-600">Live items need a price and a quantity of at least 1.</span>
      </label>

      <label className="flex min-h-[44px] items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm" data-testid="requires-approval">
        <input type="hidden" name="requiresApprovalField" value="1" />
        <input type="checkbox" name="requiresApproval" className="mt-0.5 h-5 w-5" defaultChecked={values.requiresApproval ?? isNew} />
        <span><span className="font-medium text-slate-900">Requires my approval</span>
          <span className="block text-xs text-slate-600">Checkout only authorizes the card. You accept (charge) or decline (release) in Orders within 6 days. Use for items also listed on Depop.</span></span>
      </label>

      <details className="rounded-xl border border-slate-200 bg-white p-3" open={!isNew}>
        <summary className="min-h-[44px] cursor-pointer py-2 font-medium">More details</summary>
        <div className="mt-2 grid gap-4 sm:grid-cols-2">
          <label className={label}>Category
            <select name="categoryId" defaultValue={values.categoryId ?? ""} className={input}>
              <option value="">None</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </label>
          <label className={label}>Brand<input name="brand" defaultValue={values.brand ?? ""} className={input} /></label>
          <label className={`${label} sm:col-span-2`}>Condition notes<input name="conditionNotes" defaultValue={values.conditionNotes ?? ""} className={input} /></label>
          <label className={label}>Original price ($)<input name="originalPrice" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={values.originalPrice ?? ""} className={input} /></label>
          <label className={label}>Purchase cost ($, admin only)<input name="purchaseCost" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={values.purchaseCost ?? ""} className={input} /></label>
          <label className={label}>Weight (lb, for shipping)<input name="weightLb" type="number" inputMode="decimal" step="0.01" min="0" defaultValue={values.weightLb ?? ""} className={input} /></label>
          <label className={label}>SKU{isNew ? " (blank = auto)" : ""}<input name="sku" required={!isNew} defaultValue={values.sku} className={`${input} font-mono`} /></label>
          <label className={label}>URL slug (optional)<input name="slug" defaultValue={values.slug} placeholder="from title" className={input} /></label>
          <label className="flex min-h-[44px] items-center gap-3 text-sm"><input type="checkbox" name="featured" className="h-5 w-5" defaultChecked={values.featured} /> Featured</label>
        </div>
      </details>

      <div className="sticky bottom-2 z-10 rounded-2xl bg-white/90 p-2 backdrop-blur">
        <button type="submit" className="btn btn-primary w-full">{submitLabel}</button>
      </div>
    </form>
  );
}
