import { and, count, desc, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "@/lib/db";
import { affiliateItems, aiUsageEvents, blogPosts, type BlogPostStatus } from "@/lib/db/schema";
import { toPublicPick, type PublicPick } from "@/lib/shop/public-pick";
import { BLOG_PAGE_SIZE } from "./config";
import type { GenDeps, GeneratedDraft } from "./generate";
import type { BlogStore } from "./service";

export type BlogPost = typeof blogPosts.$inferSelect;

export async function publishedPage(page: number) {
  const p = Math.max(1, Math.floor(page) || 1);
  const where = eq(blogPosts.status, "published");
  const [rows, [{ n }]] = await Promise.all([
    db.select().from(blogPosts).where(where).orderBy(desc(blogPosts.publishedAt)).limit(BLOG_PAGE_SIZE).offset((p - 1) * BLOG_PAGE_SIZE),
    db.select({ n: count() }).from(blogPosts).where(where),
  ]);
  return { rows, page: p, pages: Math.max(1, Math.ceil(n / BLOG_PAGE_SIZE)), total: n };
}

export async function allPublished(limit = 1000) {
  return db.select().from(blogPosts).where(eq(blogPosts.status, "published")).orderBy(desc(blogPosts.publishedAt)).limit(limit);
}

/** Drafts and rejected posts are invisible publicly. */
export async function publishedBySlug(slug: string): Promise<BlogPost | null> {
  const [row] = await db.select().from(blogPosts).where(and(eq(blogPosts.slug, slug), eq(blogPosts.status, "published"))).limit(1);
  return row ?? null;
}

export async function postById(id: string): Promise<BlogPost | null> {
  const [row] = await db.select().from(blogPosts).where(eq(blogPosts.id, id)).limit(1);
  return row ?? null;
}

export async function postsByStatus(status: BlogPostStatus, limit = 100) {
  return db.select().from(blogPosts).where(eq(blogPosts.status, status)).orderBy(desc(status === "published" ? blogPosts.publishedAt : blogPosts.createdAt)).limit(limit);
}

export async function statusCounts(): Promise<Record<BlogPostStatus, number>> {
  const rows = await db.select({ status: blogPosts.status, n: count() }).from(blogPosts).groupBy(blogPosts.status);
  const out = { draft: 0, published: 0, rejected: 0 };
  for (const r of rows) out[r.status as BlogPostStatus] = r.n;
  return out;
}

/** Active picks by id (public fields only: never price or rating). Inactive picks drop out of posts. */
export async function picksByIds(ids: string[]): Promise<Map<string, PublicPick>> {
  const clean = ids.filter((i) => /^[0-9a-f-]{36}$/i.test(i));
  if (!clean.length) return new Map();
  const rows = await db.select().from(affiliateItems).where(and(inArray(affiliateItems.id, clean), eq(affiliateItems.active, true)));
  return new Map(rows.map((r) => [r.id, toPublicPick(r)]));
}

export async function aiDraftsSince(since: Date): Promise<{ n: number; last: Date | null }> {
  const rows = await db.select({ createdAt: blogPosts.createdAt }).from(blogPosts).where(and(eq(blogPosts.source, "ai"), gte(blogPosts.createdAt, since))).orderBy(desc(blogPosts.createdAt));
  return { n: rows.length, last: rows[0]?.createdAt ?? null };
}

export const blogStore: BlogStore = {
  get: postById,
  async update(id, from, patch) {
    const rows = await db.update(blogPosts).set({ ...patch, updatedAt: new Date() }).where(and(eq(blogPosts.id, id), inArray(blogPosts.status, from))).returning({ id: blogPosts.id });
    return rows.length > 0;
  },
  async slugTaken(slug, exceptId) {
    const [r] = await db.select({ id: blogPosts.id }).from(blogPosts).where(and(eq(blogPosts.slug, slug), ne(blogPosts.id, exceptId))).limit(1);
    return Boolean(r);
  },
  async activePickIds() {
    const rows = await db.select({ id: affiliateItems.id }).from(affiliateItems).where(eq(affiliateItems.active, true));
    return new Set(rows.map((r) => r.id));
  },
};

/** Real dependencies for the generator. Rejected posts still count for dedupe so a declined topic isn't rewritten. */
export function generatorDeps(): GenDeps {
  return {
    picks: async () => (await db.select({ id: affiliateItems.id, title: affiliateItems.title, category: affiliateItems.category }).from(affiliateItems).where(eq(affiliateItems.active, true))),
    existing: async () => db.select({ topicKey: blogPosts.topicKey, slug: blogPosts.slug, title: blogPosts.title }).from(blogPosts),
    insertDraft: async (d: GeneratedDraft) => {
      const [row] = await db.insert(blogPosts).values({ ...d, status: "draft", source: "ai" }).returning({ id: blogPosts.id, slug: blogPosts.slug });
      return row;
    },
    // Shows up on /admin/ai next to listing suggestions (actor "blog").
    recordUsage: (e) => db.insert(aiUsageEvents).values({ ...e, actorRole: "blog", imageCount: 0, billedVia: "free_staff" }).catch(() => null),
  };
}
