type Saved = { name: string; street1: string; street2: string | null; city: string; state: string; zip: string; phone: string | null } | null;

/** Return-address form (server component). Values are only ever rendered to the signed-in account owner. */
export function ShipFromForm({ action, saved }: { action: string; saved: Saved }) {
  const f = (name: keyof NonNullable<Saved>, label: string, opts: { required?: boolean; cls?: string; auto?: string } = {}) => (
    <label className={`space-y-1 text-sm ${opts.cls ?? ""}`}>
      <span className="block">{label}{opts.required ? "" : " (optional)"}</span>
      <input name={name} defaultValue={saved?.[name] ?? ""} required={opts.required} autoComplete={opts.auto} className="field-input w-full" />
    </label>
  );
  return (
    <form action={action} method="post" className="grid gap-3 sm:grid-cols-6" data-testid="ship-from-form">
      {f("name", "Name", { required: true, cls: "sm:col-span-6", auto: "name" })}
      {f("street1", "Street", { required: true, cls: "sm:col-span-4", auto: "address-line1" })}
      {f("street2", "Apt / suite", { cls: "sm:col-span-2", auto: "address-line2" })}
      {f("city", "City", { required: true, cls: "sm:col-span-3", auto: "address-level2" })}
      {f("state", "State", { required: true, cls: "sm:col-span-1", auto: "address-level1" })}
      {f("zip", "ZIP", { required: true, cls: "sm:col-span-2", auto: "postal-code" })}
      {f("phone", "Phone", { cls: "sm:col-span-3", auto: "tel" })}
      <div className="sm:col-span-6"><button type="submit" className="btn btn-primary" data-testid="save-ship-from">{saved ? "Update return address" : "Save return address"}</button></div>
      <p className="text-xs text-slate-600 sm:col-span-6">Printed as the return address on USPS labels you buy. Private: never shown on the shop.</p>
    </form>
  );
}
