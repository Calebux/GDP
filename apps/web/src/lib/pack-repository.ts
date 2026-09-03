import { createLogger } from "@gdp/core";
import type { ConceptPreview, Pack, PackOrder, PackStatus } from "@gdp/core";
import type { DesignDocument } from "@gdp/design-schema";
import { db, dbAvailable, packConcepts, packs, orders, generationJobs } from "@gdp/db";
import { eq, desc } from "drizzle-orm";

const log = createLogger("pack-repository");

export interface StoredConcept {
  preview: ConceptPreview;
  doc: DesignDocument;
}

export interface StoredPack {
  pack: Pack;
  concepts: StoredConcept[];
}

export interface GenerationJobInfo {
  id: string;
  packId: string;
  type: "concepts" | "packaging";
  status: "queued" | "processing" | "completed" | "failed";
  progress: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

// In-memory fallback stores (D-16: local-first degradation when DB is offline)
const memoryPacks = new Map<string, StoredPack>();
const memoryOrders = new Map<string, PackOrder>();
const memoryJobs = new Map<string, GenerationJobInfo>();

export class PackRepository {
  async savePack(pack: Pack, concepts: StoredConcept[]): Promise<void> {
    memoryPacks.set(pack.id, { pack, concepts });

    if (await dbAvailable()) {
      try {
        const database = db();
        await database.insert(packs).values({
          id: pack.id,
          userId: pack.userId ?? null,
          brief: pack.brief,
          status: pack.status,
          selectedConceptId: pack.selectedConceptId ?? null,
          requestedFormats: pack.requestedFormats,
          downloadKey: pack.downloadKey ?? null,
          createdAt: new Date(pack.createdAt),
          updatedAt: new Date(pack.updatedAt),
        });

        for (const item of concepts) {
          await database.insert(packConcepts).values({
            id: item.preview.id,
            packId: pack.id,
            title: item.preview.title,
            description: item.preview.description,
            visualDirection: item.preview.visualDirection,
            vqs: item.preview.vqs,
            document: item.doc,
            previewKey: item.preview.previewUrl,
            thumbnailKey: item.preview.thumbnailUrl,
            status: item.preview.status,
            createdAt: new Date(),
          });
        }
      } catch (err) {
        log.warn("Failed saving pack to PostgreSQL, kept in memory fallback", { error: String(err) });
      }
    }
  }

  async getPack(id: string): Promise<Pack | null> {
    const memory = memoryPacks.get(id);
    if (memory) return memory.pack;

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database.select().from(packs).where(eq(packs.id, id)).limit(1);
        const row = rows[0];
        if (!row) return null;

        const conceptRows = await database.select().from(packConcepts).where(eq(packConcepts.packId, id));
        const concepts: ConceptPreview[] = conceptRows.map((c) => ({
          id: c.id,
          title: c.title,
          description: c.description,
          visualDirection: c.visualDirection,
          previewUrl: c.previewKey,
          thumbnailUrl: c.thumbnailKey,
          vqs: c.vqs,
          status: c.status as ConceptPreview["status"],
        }));

        const pack: Pack = {
          id: row.id,
          userId: row.userId ?? undefined,
          brief: row.brief as any,
          status: row.status as PackStatus,
          concepts,
          selectedConceptId: row.selectedConceptId ?? undefined,
          requestedFormats: (row.requestedFormats as any) ?? [],
          downloadKey: row.downloadKey ?? undefined,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        };

        return pack;
      } catch (err) {
        log.warn("Error querying pack from PostgreSQL", { error: String(err) });
      }
    }

    return null;
  }

  async getStoredConcept(packId: string, conceptId: string): Promise<StoredConcept | null> {
    const memory = memoryPacks.get(packId);
    if (memory) {
      const match = memory.concepts.find((c) => c.preview.id === conceptId);
      if (match) return match;
    }

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database
          .select()
          .from(packConcepts)
          .where(eq(packConcepts.id, conceptId))
          .limit(1);
        const c = rows[0];
        if (!c) return null;

        return {
          preview: {
            id: c.id,
            title: c.title,
            description: c.description,
            visualDirection: c.visualDirection,
            previewUrl: c.previewKey,
            thumbnailUrl: c.thumbnailKey,
            vqs: c.vqs,
            status: c.status as ConceptPreview["status"],
          },
          doc: c.document as unknown as DesignDocument,
        };
      } catch (err) {
        log.warn("Error querying concept from PostgreSQL", { error: String(err) });
      }
    }

    return null;
  }

  async updatePack(id: string, partial: Partial<Pack>): Promise<Pack | null> {
    const existing = await this.getPack(id);
    if (!existing) return null;

    const updated: Pack = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    const stored = memoryPacks.get(id);
    if (stored) {
      stored.pack = updated;
      if (partial.concepts) {
        // preserve existing docs if concepts are updated
        for (const c of partial.concepts) {
          const cIndex = stored.concepts.findIndex((item) => item.preview.id === c.id);
          if (cIndex !== -1) {
            const currentItem = stored.concepts[cIndex];
            if (currentItem) {
              currentItem.preview = c;
            }
          }
        }
      }
    }

    if (await dbAvailable()) {
      try {
        const database = db();
        await database
          .update(packs)
          .set({
            status: updated.status,
            selectedConceptId: updated.selectedConceptId ?? null,
            requestedFormats: updated.requestedFormats,
            downloadKey: updated.downloadKey ?? null,
            updatedAt: new Date(updated.updatedAt),
          })
          .where(eq(packs.id, id));
      } catch (err) {
        log.warn("Error updating pack in PostgreSQL", { error: String(err) });
      }
    }

    return updated;
  }

  async saveOrder(order: PackOrder): Promise<void> {
    memoryOrders.set(order.id, order);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database.insert(orders).values({
          id: order.id,
          packId: order.packId,
          userId: order.userId ?? null,
          amount: order.amount,
          currency: order.currency,
          provider: order.provider,
          providerSessionId: order.providerSessionId,
          status: order.status,
          createdAt: new Date(order.createdAt),
          updatedAt: new Date(order.updatedAt),
        });
      } catch (err) {
        log.warn("Error saving order to PostgreSQL", { error: String(err) });
      }
    }
  }

  async getOrder(id: string): Promise<PackOrder | null> {
    const memory = memoryOrders.get(id);
    if (memory) return memory;

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database.select().from(orders).where(eq(orders.id, id)).limit(1);
        const r = rows[0];
        if (!r) return null;
        return {
          id: r.id,
          packId: r.packId,
          userId: r.userId ?? undefined,
          amount: r.amount,
          currency: r.currency,
          provider: r.provider as "stripe" | "dev",
          providerSessionId: r.providerSessionId,
          status: r.status as PackOrder["status"],
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      } catch (err) {
        log.warn("Error getting order from PostgreSQL", { error: String(err) });
      }
    }

    return null;
  }

  async getOrderByPackId(packId: string): Promise<PackOrder | null> {
    for (const ord of memoryOrders.values()) {
      if (ord.packId === packId) return ord;
    }

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database
          .select()
          .from(orders)
          .where(eq(orders.packId, packId))
          .orderBy(desc(orders.createdAt))
          .limit(1);
        const r = rows[0];
        if (!r) return null;
        return {
          id: r.id,
          packId: r.packId,
          userId: r.userId ?? undefined,
          amount: r.amount,
          currency: r.currency,
          provider: r.provider as "stripe" | "dev",
          providerSessionId: r.providerSessionId,
          status: r.status as PackOrder["status"],
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      } catch (err) {
        log.warn("Error querying order for pack from PostgreSQL", { error: String(err) });
      }
    }

    return null;
  }

  async getOrderByProviderSessionId(sessionId: string): Promise<PackOrder | null> {
    for (const ord of memoryOrders.values()) {
      if (ord.providerSessionId === sessionId) return ord;
    }

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database
          .select()
          .from(orders)
          .where(eq(orders.providerSessionId, sessionId))
          .limit(1);
        const r = rows[0];
        if (!r) return null;
        return {
          id: r.id,
          packId: r.packId,
          userId: r.userId ?? undefined,
          amount: r.amount,
          currency: r.currency,
          provider: r.provider as "stripe" | "dev",
          providerSessionId: r.providerSessionId,
          status: r.status as PackOrder["status"],
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        };
      } catch (err) {
        log.warn("Error finding order by sessionId from PostgreSQL", { error: String(err) });
      }
    }

    return null;
  }

  async updateOrder(id: string, partial: Partial<PackOrder>): Promise<PackOrder | null> {
    const existing = await this.getOrder(id);
    if (!existing) return null;

    const updated: PackOrder = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    memoryOrders.set(id, updated);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database
          .update(orders)
          .set({
            status: updated.status,
            updatedAt: new Date(updated.updatedAt),
          })
          .where(eq(orders.id, id));
      } catch (err) {
        log.warn("Error updating order in PostgreSQL", { error: String(err) });
      }
    }

    return updated;
  }

  async saveJob(job: GenerationJobInfo): Promise<void> {
    memoryJobs.set(job.id, job);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database.insert(generationJobs).values({
          id: job.id,
          packId: job.packId,
          type: job.type,
          status: job.status,
          progress: job.progress,
          error: job.error ?? null,
          createdAt: new Date(job.createdAt),
          updatedAt: new Date(job.updatedAt),
        });
      } catch (err) {
        log.warn("Error saving job in PostgreSQL", { error: String(err) });
      }
    }
  }

  async updateJob(id: string, partial: Partial<GenerationJobInfo>): Promise<GenerationJobInfo | null> {
    const existing = memoryJobs.get(id);
    if (!existing) return null;

    const updated: GenerationJobInfo = {
      ...existing,
      ...partial,
      updatedAt: new Date().toISOString(),
    };

    memoryJobs.set(id, updated);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database
          .update(generationJobs)
          .set({
            status: updated.status,
            progress: updated.progress,
            error: updated.error ?? null,
            updatedAt: new Date(updated.updatedAt),
          })
          .where(eq(generationJobs.id, id));
      } catch (err) {
        log.warn("Error updating job in PostgreSQL", { error: String(err) });
      }
    }

    return updated;
  }

  async getLatestJob(packId: string): Promise<GenerationJobInfo | null> {
    for (const job of Array.from(memoryJobs.values()).reverse()) {
      if (job.packId === packId) return job;
    }
    return null;
  }
}

export const packRepository = new PackRepository();
