export function AdminNotice({ ok, error }: { ok?: string; error?: string }) {
  if (error) return <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">{error}</p>;
  if (ok) return <p role="status" className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">{ok}</p>;
  return null;
}

export type NoticeParams = Promise<{ ok?: string; error?: string }>;
