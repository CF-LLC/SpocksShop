// One-off / cron sweep of order-approval holds: npx tsx scripts/sweep-approval-holds.mts
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../lib/db/schema";
import { sweepApprovalHolds } from "../lib/approval/service";
import { getMailer } from "../lib/mail";
import { getStripe } from "../lib/stripe";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}
const client = postgres(url, { max: 1 });
const result = await sweepApprovalHolds({ db: drizzle(client, { schema }), stripe: getStripe(), mailer: getMailer() });
console.log("approval sweep", result);
await client.end();
