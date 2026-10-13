import { EmptyState } from "@/components/ui/empty-state";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl py-10">
      <h1 className="t-h1 mb-6 text-center">Page not found</h1>
      <EmptyState
        icon="🔭"
        title="Nothing at these coordinates"
        body="The page may have moved or the item may have sold."
        actions={[{ href: "/shop", label: "Browse the shop" }, { href: "/", label: "Go home" }]}
      />
    </div>
  );
}
