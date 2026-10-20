import { randomUUID } from "crypto";
import { logError } from "@/lib/errors/log";
import { BLOCKED_SKIP, importDepopLinks, type ImportDeps, type LinkResult } from "./import";
import { POLITE_DELAY_MS, sleep } from "./fetch";
import { BATCH_SIZE, MAX_LINKS_PER_JOB, parseLinkList } from "./url";

/**
 * Bulk Depop import as a server-side job, so a 200-link paste (~10 minutes with the polite pause)
 * never depends on one long HTTP request. The browser polls GET /api/admin/depop/jobs/<id>.
 * Jobs live in this server process's memory (one container); a restart loses progress, but
 * re-pasting is safe because already-imported links are skipped.
 */
export type JobState = "running" | "done" | "stopped" | "failed";
export type ImportJob = {
  id: string;
  state: JobState;
  total: number;
  processed: number;
  batches: number;
  batch: number;
  tooMany: boolean;
  results: LinkResult[];
  startedAt: number;
  finishedAt: number | null;
};

const KEEP_MS = 6 * 60 * 60 * 1000;
const g = globalThis as unknown as { __depopJobs?: Map<string, ImportJob> };
const jobs = (g.__depopJobs ??= new Map<string, ImportJob>());

function sweep(now = Date.now()) {
  for (const [id, j] of jobs) if (j.finishedAt && now - j.finishedAt > KEEP_MS) jobs.delete(id);
}

export const getJob = (id: string) => jobs.get(id) ?? null;
export const runningJob = () => [...jobs.values()].find((j) => j.state === "running") ?? null;
export const _resetJobs = () => jobs.clear();

export class JobBusyError extends Error {
  constructor(readonly jobId: string) { super("An import is already running."); }
}

/** Dedupe/validate the whole paste up front, then import the unique links in batches of 20. */
export function startImportJob(text: string, deps: Omit<ImportDeps, "onResult" | "maxLinks">): { job: ImportJob; done: Promise<void> } {
  sweep();
  const busy = runningJob();
  if (busy) throw new JobBusyError(busy.id);
  const { lines, tooMany } = parseLinkList(text, MAX_LINKS_PER_JOB);
  const job: ImportJob = { id: randomUUID(), state: "running", total: lines.length, processed: 0, batches: 0, batch: 0, tooMany, results: [], startedAt: Date.now(), finishedAt: null };
  const add = (r: LinkResult) => { job.results.push(r); job.processed++; };

  const seen = new Set<string>();
  const unique: string[] = [];
  for (const { input, check } of lines) {
    if (!check.ok) add({ input, status: "error", error: check.error });
    else if (seen.has(check.url)) add({ input, status: "duplicate", id: null, title: "Listed twice in this paste" });
    else { seen.add(check.url); unique.push(input); }
  }
  const batches: string[][] = [];
  for (let i = 0; i < unique.length; i += BATCH_SIZE) batches.push(unique.slice(i, i + BATCH_SIZE));
  job.batches = batches.length;
  jobs.set(job.id, job);

  const wait = deps.wait ?? sleep;
  const done = (async () => {
    try {
      for (const [i, batch] of batches.entries()) {
        job.batch = i + 1;
        // importDepopLinks pauses between listings within a batch; keep the same pause across batch boundaries.
        if (i > 0) await wait(deps.delayMs ?? POLITE_DELAY_MS);
        const { stopped } = await importDepopLinks(batch.join("\n"), { ...deps, maxLinks: BATCH_SIZE, onResult: add });
        if (stopped) {
          for (const rest of batches.slice(i + 1).flat()) add({ input: rest, status: "error", error: BLOCKED_SKIP });
          job.state = "stopped";
          break;
        }
      }
      if (job.state === "running") job.state = "done";
    } catch (e) {
      await logError("depop-import-job", e, { jobId: job.id });
      job.state = "failed";
    } finally {
      job.finishedAt = Date.now();
    }
  })();
  return { job, done };
}

