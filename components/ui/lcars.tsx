export function LcarsBar({ className = "" }: { className?: string }) {
  return (
    <div className={`lcars-bar ${className}`} aria-hidden>
      <span />
      <span />
      <span />
    </div>
  );
}

export function SectionHeader({ eyebrow, title, children, id, action }: { eyebrow?: string; title: string; children?: React.ReactNode; id?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="max-w-2xl">
        {eyebrow ? <p className="t-eyebrow mb-2">{eyebrow}</p> : null}
        <h2 id={id} className="t-h2">{title}</h2>
        {children ? <div className="muted mt-2">{children}</div> : null}
      </div>
      {action}
    </header>
  );
}
