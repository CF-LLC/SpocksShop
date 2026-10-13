// After `next build`: fail if any server-only secret env NAME or its value shows up in client bundles.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
const NAMES = ["AI_API_KEY", "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "SESSION_SECRET", "DATABASE_URL"];
const values = NAMES.map((n) => process.env[n]).filter((v) => v && v.length >= 12);
const root = ".next/static";
const files = [];
const walk = (d) => readdirSync(d).forEach((f) => {
  const p = join(d, f);
  if (statSync(p).isDirectory()) walk(p);
  else if (p.endsWith(".js")) files.push(p);
});
walk(root);
const bad = [];
for (const f of files) {
  const s = readFileSync(f, "utf8");
  for (const n of NAMES) if (s.includes(n)) bad.push(`${f}: mentions ${n}`);
  if (values.some((v) => s.includes(v))) bad.push(`${f}: contains a secret value`);
}
if (bad.length) { console.error(bad.join("\n")); process.exit(1); }
console.log(`client bundle clean (${files.length} files checked)`);
