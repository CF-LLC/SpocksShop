"use client";

import { useRef, useState } from "react";
import { ImportPreviewGrid } from "@/components/admin/affiliate-import-preview";
import { importPreviewCards } from "@/lib/admin/affiliate-catalog";

function previewFromText(text: string) {
  const trimmed = text.trim();
  if (!trimmed) return null;
  try {
    return importPreviewCards(JSON.parse(trimmed));
  } catch {
    return { ok: false as const, errors: ["That isn't valid JSON."] };
  }
}

export function AffiliateImportForm() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [json, setJson] = useState("");
  const [fileText, setFileText] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const preview = previewFromText(fileText ?? json);

  return (
    <form action="/api/admin/affiliate/import" method="post" encType="multipart/form-data" className="surface-panel space-y-3 rounded-2xl p-4">
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        JSON
        <textarea name="json" rows={14} value={json} onChange={(e) => setJson(e.target.value)} placeholder='[{ "title": "Spock rubber duck", "asin": "B0D9NS9RT5" }]' className="field-input w-full font-mono text-xs" />
      </label>
      <label className="grid gap-1 text-sm font-semibold text-slate-700">
        Or a .json file
        <input
          ref={fileRef}
          type="file"
          name="file"
          accept="application/json,.json"
          className="text-sm"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) { setFileText(null); setFileName(null); return; }
            setFileName(file.name);
            setFileText(await file.text());
          }}
        />
      </label>
      {fileName ? (
        <p className="text-sm text-slate-600">
          Using {fileName}. Import reads the file, not the text box.{" "}
          <button
            type="button"
            className="btn-text"
            onClick={() => { if (fileRef.current) fileRef.current.value = ""; setFileText(null); setFileName(null); }}
          >Clear file</button>
        </p>
      ) : null}
      {preview && !preview.ok ? <p role="alert" className="text-sm text-red-800">{preview.errors.slice(0, 3).join(" · ")}</p> : null}
      {preview && preview.ok ? (
        <div className="space-y-2">
          <p className="text-sm text-slate-700">{preview.cards.length} {preview.cards.length === 1 ? "pick" : "picks"} in this preview. Dollar amounts in the file are stored as an internal note only and are not shown here.</p>
          <ImportPreviewGrid cards={preview.cards} />
        </div>
      ) : null}
      <div className="flex flex-wrap gap-3">
        <button type="submit" name="intent" value="preview" className="btn btn-outline">Preview</button>
        <button type="submit" name="intent" value="import" className="btn btn-primary">Import</button>
      </div>
      <p className="text-xs text-slate-500">Preview checks the database (what would be added or updated) without writing. Import upserts by ASIN or link and never deletes.</p>
    </form>
  );
}
