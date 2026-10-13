import Link from "next/link";

export type EmptyAction = { href: string; label: string; external?: boolean; primary?: boolean };

/** Every empty view offers at least one next step. */
export function EmptyState({ title, body, actions, icon = "🖖" }: { title: string; body?: React.ReactNode; actions: EmptyAction[]; icon?: string }) {
  return (
    <div className="panel flex flex-col items-center px-6 py-12 text-center">
      <span aria-hidden className="mb-3 text-4xl">{icon}</span>
      <h3 className="t-h3">{title}</h3>
      {body ? <p className="muted mt-2 max-w-md">{body}</p> : null}
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {actions.map((a, i) =>
          a.external ? (
            <a key={a.href} href={a.href} className={`btn ${a.primary ?? i === 0 ? "btn-primary" : "btn-outline"}`}>{a.label}</a>
          ) : (
            <Link key={a.href} href={a.href} className={`btn ${a.primary ?? i === 0 ? "btn-primary" : "btn-outline"}`}>{a.label}</Link>
          ),
        )}
      </div>
    </div>
  );
}
