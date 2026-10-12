import { readFileSync, readdirSync } from "fs";
import { join } from "path";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const sql = postgres(url, { max: 1 });

await sql`
  CREATE TABLE IF NOT EXISTS schema_migrations (
    filename text PRIMARY KEY,
    applied_at timestamptz NOT NULL DEFAULT now()
  )
`;

const dir = join(process.cwd(), "drizzle");
const files = readdirSync(dir)
  .filter((name) => name.endsWith(".sql"))
  .sort();

for (const file of files) {
  const applied = await sql`select filename from schema_migrations where filename = ${file}`;
  if (applied.length > 0) {
    console.log(`skip ${file}`);
    continue;
  }
  const body = readFileSync(join(dir, file), "utf8");
  await sql.begin(async (tx) => {
    await tx.unsafe(body);
    await tx`insert into schema_migrations (filename) values (${file})`;
  });
  console.log(`applied ${file}`);
}

await sql.end();
console.log("migrations complete");
