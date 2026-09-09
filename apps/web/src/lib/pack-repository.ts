import { createLogger, newId } from "@gdp/core";
import type {
  ConceptPreview,
  CreditReferenceType,
  CreditTransaction,
  CreditTransactionType,
  CreditWallet,
  Pack,
  PackOrder,
  PackShare,
  PackStatus,
  PackVersion,
  PaymentProviderType,
} from "@gdp/core";
import type { DesignDocument } from "@gdp/design-schema";
import {
  db,
  dbAvailable,
  packConcepts,
  packs,
  orders,
  generationJobs,
  creditWallets,
  creditTransactions,
  packVersions,
  packShares,
  packAssets,
  processedWebhooks,
} from "@gdp/db";
import { eq, desc, and } from "drizzle-orm";

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
const memoryWallets = new Map<string, CreditWallet>();
const memoryTransactions = new Map<string, CreditTransaction>();
const memoryVersions = new Map<string, PackVersion[]>();
const memoryShares = new Map<string, PackShare>();
const memoryProcessedWebhooks = new Set<string>();

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
          productId: order.productId ?? "single",
          creditsGranted: order.creditsGranted ?? 1,
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
          productId: r.productId,
          creditsGranted: r.creditsGranted,
          amount: r.amount,
          currency: r.currency,
          provider: r.provider as PaymentProviderType,
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
          productId: r.productId,
          creditsGranted: r.creditsGranted,
          amount: r.amount,
          currency: r.currency,
          provider: r.provider as PaymentProviderType,
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
          productId: r.productId,
          creditsGranted: r.creditsGranted,
          amount: r.amount,
          currency: r.currency,
          provider: r.provider as PaymentProviderType,
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

  // ------------------------------------------------------------- D-02 Credit Wallet & Ledger

  async getOrCreateWallet(userId: string): Promise<CreditWallet> {
    const memory = memoryWallets.get(userId);
    if (memory) return memory;

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database.select().from(creditWallets).where(eq(creditWallets.userId, userId)).limit(1);
        if (rows[0]) {
          const w = rows[0];
          const wallet: CreditWallet = {
            id: w.id,
            userId: w.userId,
            balance: w.balance,
            lifetimePurchased: w.lifetimePurchased,
            lifetimeUsed: w.lifetimeUsed,
            createdAt: w.createdAt.toISOString(),
            updatedAt: w.updatedAt.toISOString(),
          };
          memoryWallets.set(userId, wallet);
          return wallet;
        }
      } catch (err) {
        log.warn("Error getting wallet from PostgreSQL", { error: String(err) });
      }
    }

    // Create new wallet
    const now = new Date().toISOString();
    const newWallet: CreditWallet = {
      id: newId("wal"),
      userId,
      balance: 0,
      lifetimePurchased: 0,
      lifetimeUsed: 0,
      createdAt: now,
      updatedAt: now,
    };

    memoryWallets.set(userId, newWallet);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database.insert(creditWallets).values({
          id: newWallet.id,
          userId: newWallet.userId,
          balance: 0,
          lifetimePurchased: 0,
          lifetimeUsed: 0,
          createdAt: new Date(newWallet.createdAt),
          updatedAt: new Date(newWallet.updatedAt),
        });
      } catch (err) {
        log.warn("Error creating wallet in PostgreSQL", { error: String(err) });
      }
    }

    return newWallet;
  }

  async transactCredit(params: {
    userId: string;
    type: CreditTransactionType;
    amount: number;
    referenceType: CreditReferenceType;
    referenceId: string;
    description?: string;
  }): Promise<{ success: boolean; wallet: CreditWallet; transaction?: CreditTransaction; error?: string }> {
    const wallet = await this.getOrCreateWallet(params.userId);

    // Prevent duplicate webhook / grant transactions for same reference
    if (params.type === "purchase" || params.type === "grant") {
      const existing = Array.from(memoryTransactions.values()).find(
        (t) => t.referenceType === params.referenceType && t.referenceId === params.referenceId && t.type === params.type
      );
      if (existing) {
        return { success: true, wallet, transaction: existing };
      }
    }

    // Balance integrity: Balance must NEVER drop below 0
    const newBalance = wallet.balance + params.amount;
    if (newBalance < 0) {
      return {
        success: false,
        wallet,
        error: `Insufficient credit balance. Current: ${wallet.balance}, required: ${Math.abs(params.amount)}`,
      };
    }

    const now = new Date().toISOString();
    const txId = newId("ctx");
    const transaction: CreditTransaction = {
      id: txId,
      walletId: wallet.id,
      userId: params.userId,
      type: params.type,
      amount: params.amount,
      balanceAfter: newBalance,
      referenceType: params.referenceType,
      referenceId: params.referenceId,
      description: params.description || "",
      createdAt: now,
    };

    // Update wallet stats
    wallet.balance = newBalance;
    if (params.amount > 0) {
      wallet.lifetimePurchased += params.amount;
    } else if (params.amount < 0) {
      wallet.lifetimeUsed += Math.abs(params.amount);
    }
    wallet.updatedAt = now;

    memoryWallets.set(params.userId, wallet);
    memoryTransactions.set(txId, transaction);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database
          .update(creditWallets)
          .set({
            balance: wallet.balance,
            lifetimePurchased: wallet.lifetimePurchased,
            lifetimeUsed: wallet.lifetimeUsed,
            updatedAt: new Date(wallet.updatedAt),
          })
          .where(eq(creditWallets.id, wallet.id));

        await database.insert(creditTransactions).values({
          id: transaction.id,
          walletId: transaction.walletId,
          userId: transaction.userId,
          type: transaction.type,
          amount: transaction.amount,
          balanceAfter: transaction.balanceAfter,
          referenceType: transaction.referenceType,
          referenceId: transaction.referenceId,
          description: transaction.description,
          createdAt: new Date(transaction.createdAt),
        });
      } catch (err) {
        log.warn("Error executing credit transaction in PostgreSQL", { error: String(err) });
      }
    }

    return { success: true, wallet, transaction };
  }

  async getCreditTransactions(userId: string): Promise<CreditTransaction[]> {
    const list: CreditTransaction[] = [];
    for (const t of memoryTransactions.values()) {
      if (t.userId === userId) list.push(t);
    }

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database
          .select()
          .from(creditTransactions)
          .where(eq(creditTransactions.userId, userId))
          .orderBy(desc(creditTransactions.createdAt));

        return rows.map((r) => ({
          id: r.id,
          walletId: r.walletId,
          userId: r.userId,
          type: r.type as CreditTransactionType,
          amount: r.amount,
          balanceAfter: r.balanceAfter,
          referenceType: r.referenceType as CreditReferenceType,
          referenceId: r.referenceId,
          description: r.description,
          createdAt: r.createdAt.toISOString(),
        }));
      } catch (err) {
        log.warn("Error getting credit transactions from PostgreSQL", { error: String(err) });
      }
    }

    return list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // ------------------------------------------------------------- D-04 Pack Versions

  async savePackVersion(version: PackVersion & { editCategory?: string }): Promise<void> {
    const current = memoryVersions.get(version.packId) || [];
    current.push(version);
    memoryVersions.set(version.packId, current);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database.insert(packVersions).values({
          id: version.id,
          packId: version.packId,
          versionNumber: version.versionNumber,
          parentVersionId: version.parentVersionId ?? null,
          conceptId: version.conceptId,
          label: version.label,
          document: version.document,
          patch: version.patch ?? null,
          editCategory: version.editCategory ?? null,
          previewKey: version.previewKey,
          downloadKey: version.downloadKey ?? null,
          createdAt: new Date(version.createdAt),
        });
      } catch (err) {
        log.warn("Error saving pack version to PostgreSQL", { error: String(err) });
      }
    }
  }

  async savePackAsset(asset: {
    id: string;
    packId: string;
    userId?: string;
    kind?: string;
    storageKey: string;
    originalFilename?: string;
    mimeType: string;
    bytes: number;
    width?: number;
    height?: number;
  }): Promise<void> {
    if (await dbAvailable()) {
      try {
        const database = db();
        await database.insert(packAssets).values({
          id: asset.id,
          packId: asset.packId,
          userId: asset.userId ?? null,
          kind: asset.kind ?? "subject_photo",
          storageKey: asset.storageKey,
          originalFilename: asset.originalFilename ?? "",
          mimeType: asset.mimeType,
          bytes: asset.bytes,
          width: asset.width ?? 0,
          height: asset.height ?? 0,
        });
      } catch (err) {
        log.warn("Error saving pack asset to PostgreSQL", { error: String(err) });
      }
    }
  }

  async getPackVersions(packId: string): Promise<PackVersion[]> {
    const memory = memoryVersions.get(packId);
    if (memory && memory.length > 0) {
      return [...memory].sort((a, b) => b.versionNumber - a.versionNumber);
    }

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database
          .select()
          .from(packVersions)
          .where(eq(packVersions.packId, packId))
          .orderBy(desc(packVersions.versionNumber));

        return rows.map((r) => ({
          id: r.id,
          packId: r.packId,
          versionNumber: r.versionNumber,
          parentVersionId: r.parentVersionId ?? undefined,
          conceptId: r.conceptId,
          label: r.label,
          document: r.document,
          patch: r.patch,
          previewKey: r.previewKey,
          downloadKey: r.downloadKey ?? undefined,
          downloadUrl: `/api/packs/${r.packId}/download?version=${r.versionNumber}`,
          createdAt: r.createdAt.toISOString(),
        }));
      } catch (err) {
        log.warn("Error getting pack versions from PostgreSQL", { error: String(err) });
      }
    }

    return memory ? [...memory].sort((a, b) => b.versionNumber - a.versionNumber) : [];
  }

  async getPackVersion(packId: string, versionId: string): Promise<PackVersion | null> {
    const versions = await this.getPackVersions(packId);
    return versions.find((v) => v.id === versionId || String(v.versionNumber) === versionId) || null;
  }

  // ------------------------------------------------------------- D-05 Pack Shares

  async createPackShare(share: PackShare): Promise<void> {
    memoryShares.set(share.token, share);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database.insert(packShares).values({
          id: share.id,
          packId: share.packId,
          conceptId: share.conceptId,
          token: share.token,
          viewsCount: share.viewsCount,
          createdAt: new Date(share.createdAt),
        });
      } catch (err) {
        log.warn("Error saving pack share to PostgreSQL", { error: String(err) });
      }
    }
  }

  async getPackShareByToken(token: string): Promise<PackShare | null> {
    const memory = memoryShares.get(token);
    if (memory) return memory;

    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database.select().from(packShares).where(eq(packShares.token, token)).limit(1);
        const r = rows[0];
        if (!r) return null;
        return {
          id: r.id,
          packId: r.packId,
          conceptId: r.conceptId,
          token: r.token,
          viewsCount: r.viewsCount,
          createdAt: r.createdAt.toISOString(),
        };
      } catch (err) {
        log.warn("Error getting pack share from PostgreSQL", { error: String(err) });
      }
    }

    return null;
  }

  async incrementShareViews(token: string): Promise<void> {
    const share = memoryShares.get(token);
    if (share) {
      share.viewsCount++;
    }

    if (await dbAvailable()) {
      try {
        const database = db();
        const current = await this.getPackShareByToken(token);
        if (current) {
          await database
            .update(packShares)
            .set({ viewsCount: current.viewsCount + 1 })
            .where(eq(packShares.token, token));
        }
      } catch (err) {
        log.warn("Error incrementing share views in PostgreSQL", { error: String(err) });
      }
    }
  }

  // ------------------------------------------------------- D-06 Webhook Idempotency & Reconciliation

  async isWebhookProcessed(eventId: string): Promise<boolean> {
    if (memoryProcessedWebhooks.has(eventId)) return true;
    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database
          .select()
          .from(processedWebhooks)
          .where(eq(processedWebhooks.eventId, eventId))
          .limit(1);
        return rows.length > 0;
      } catch (err) {
        log.warn("Error checking processed webhook in PostgreSQL", { error: String(err) });
      }
    }
    return false;
  }

  async recordProcessedWebhook(provider: string, eventId: string, eventType?: string, payload?: any): Promise<boolean> {
    if (await this.isWebhookProcessed(eventId)) {
      return false; // Already processed
    }
    memoryProcessedWebhooks.add(eventId);

    if (await dbAvailable()) {
      try {
        const database = db();
        await database.insert(processedWebhooks).values({
          id: `pwh_${newId("wh")}`,
          provider,
          eventId,
          eventType: eventType ?? "payment.success",
          orderId: payload?.orderId ?? null,
          processedAt: new Date(),
        });
      } catch (err) {
        log.warn("Error recording processed webhook in PostgreSQL", { error: String(err) });
      }
    }
    return true;
  }

  async getAllOrders(): Promise<PackOrder[]> {
    const list: PackOrder[] = Array.from(memoryOrders.values());
    if (await dbAvailable()) {
      try {
        const database = db();
        const rows = await database.select().from(orders).orderBy(desc(orders.createdAt));
        const dbOrders: PackOrder[] = rows.map((r) => ({
          id: r.id,
          packId: r.packId,
          userId: r.userId ?? undefined,
          productId: r.productId,
          creditsGranted: r.creditsGranted,
          amount: r.amount,
          currency: r.currency,
          provider: r.provider as PaymentProviderType,
          providerSessionId: r.providerSessionId,
          status: r.status as PackOrder["status"],
          refundReason: (r as any).refundReason ?? undefined,
          refundedAt: (r as any).refundedAt ? (r as any).refundedAt.toISOString() : undefined,
          createdAt: r.createdAt.toISOString(),
          updatedAt: r.updatedAt.toISOString(),
        }));
        const ids = new Set(dbOrders.map((o) => o.id));
        for (const m of list) {
          if (!ids.has(m.id)) dbOrders.push(m);
        }
        return dbOrders;
      } catch (err) {
        log.warn("Error getting all orders from PostgreSQL", { error: String(err) });
      }
    }
    return list;
  }
}

export const packRepository = new PackRepository();

