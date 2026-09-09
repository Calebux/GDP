import { sql } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  text,
  timestamp,
  uniqueIndex,
  vector,
} from "drizzle-orm/pg-core";

const id = () => text("id").primaryKey();
const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();

// ------------------------------------------------------------------ accounts

export const organisations = pgTable("organisations", {
  id: id(),
  name: text("name").notNull(),
  /** §47 — free | creator | pro | organisation */
  plan: text("plan").notNull().default("free"),
  country: text("country").default(""),
  createdAt: createdAt(),
});

export const users = pgTable(
  "users",
  {
    id: id(),
    email: text("email").notNull(),
    name: text("name").default(""),
    /** Curators and designers get access to the annotation tool (§38). */
    role: text("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("users_email_idx").on(table.email)],
);

export const memberships = pgTable(
  "memberships",
  {
    userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    organisationId: text("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    role: text("role").notNull().default("member"),
    createdAt: createdAt(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.organisationId] })],
);

// ---------------------------------------------------------------- brand kits

export const brandKits = pgTable(
  "brand_kits",
  {
    id: id(),
    organisationId: text("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    data: jsonb("data").notNull(),
    /** §46 — learned style preferences for this organisation. */
    preferences: jsonb("preferences").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("brand_kits_org_idx").on(table.organisationId)],
);

// -------------------------------------------------------------------- assets

export const assets = pgTable(
  "assets",
  {
    id: id(),
    organisationId: text("organisation_id").references(() => organisations.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    storageKey: text("storage_key").notNull(),
    /** Cutout produced by background removal (§7). */
    cutoutKey: text("cutout_key"),
    maskKey: text("mask_key"),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    bytes: integer("bytes").notNull().default(0),
    /** §8 — cached computer-vision analysis. */
    analysis: jsonb("analysis"),
    createdAt: createdAt(),
  },
  (table) => [index("assets_org_idx").on(table.organisationId)],
);

// ------------------------------------------------------------------ projects

export const projects = pgTable(
  "projects",
  {
    id: id(),
    organisationId: text("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    category: text("category").notNull().default("church"),
    brief: jsonb("brief").notNull(),
    brandKitId: text("brand_kit_id").references(() => brandKits.id, { onDelete: "set null" }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("projects_org_idx").on(table.organisationId)],
);

export const designs = pgTable(
  "designs",
  {
    id: id(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    format: text("format").notNull().default("ig-portrait"),
    composition: text("composition").notNull().default(""),
    styleDirection: text("style_direction").notNull().default(""),
    /** Pointer to the current version. */
    currentVersionId: text("current_version_id"),
    /** §66 — the score of the current version. */
    vqs: real("vqs").notNull().default(0),
    exported: boolean("exported").notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("designs_project_idx").on(table.projectId)],
);

/** §26 — every AI or manual modification creates a version. */
export const designVersions = pgTable(
  "design_versions",
  {
    id: id(),
    designId: text("design_id").notNull().references(() => designs.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    label: text("label").notNull().default(""),
    /** The complete DesignDocument (§62). */
    document: jsonb("document").notNull(),
    /** The patch that produced this version, when it came from an edit. */
    patch: jsonb("patch"),
    qaReport: jsonb("qa_report"),
    vqs: real("vqs").notNull().default(0),
    previewKey: text("preview_key"),
    source: text("source").notNull().default("generation"),
    createdAt: createdAt(),
  },
  (table) => [index("design_versions_design_idx").on(table.designId)],
);

/** §41 — every candidate we generated, shown or not: the preference dataset. */
export const generations = pgTable(
  "generations",
  {
    id: id(),
    projectId: text("project_id").notNull().references(() => projects.id, { onDelete: "cascade" }),
    designId: text("design_id").references(() => designs.id, { onDelete: "set null" }),
    plan: jsonb("plan").notNull(),
    document: jsonb("document").notNull(),
    dna: jsonb("dna").notNull(),
    vqs: real("vqs").notNull().default(0),
    shown: boolean("shown").notNull().default(false),
    selected: boolean("selected").notNull().default(false),
    plannerModel: text("planner_model").notNull().default(""),
    composition: text("composition").notNull().default(""),
    durationMs: integer("duration_ms").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("generations_project_idx").on(table.projectId)],
);

export const exports = pgTable(
  "exports",
  {
    id: id(),
    designId: text("design_id").notNull().references(() => designs.id, { onDelete: "cascade" }),
    versionId: text("version_id").notNull(),
    format: text("format").notNull(),
    fileFormat: text("file_format").notNull().default("png"),
    scale: real("scale").notNull().default(1),
    storageKey: text("storage_key").notNull(),
    watermarked: boolean("watermarked").notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [index("exports_design_idx").on(table.designId)],
);

// --------------------------------------------------------- reference library

/** §10 / §36 — the curated reference library. */
export const referenceDesigns = pgTable(
  "reference_designs",
  {
    id: id(),
    title: text("title").notNull().default(""),
    category: text("category").notNull(),
    subcategory: text("subcategory").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    sourceCredit: text("source_credit").notNull().default(""),
    imageKey: text("image_key").notNull().default(""),
    thumbnailKey: text("thumbnail_key").notNull().default(""),
    composition: text("composition").notNull(),
    characteristics: jsonb("characteristics").notNull().default(sql`'[]'::jsonb`),
    typography: jsonb("typography").notNull(),
    palette: jsonb("palette").notNull(),
    imageTreatment: jsonb("image_treatment").notNull().default(sql`'[]'::jsonb`),
    geometry: jsonb("geometry").notNull(),
    dna: jsonb("dna").notNull(),
    styleDirections: jsonb("style_directions").notNull().default(sql`'[]'::jsonb`),
    /** §10 — only strong references reach retrieval. */
    qualityScore: integer("quality_score").notNull().default(0),
    approved: boolean("approved").notNull().default(false),
    reviewedBy: text("reviewed_by").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [
    index("reference_category_idx").on(table.category, table.subcategory),
    index("reference_quality_idx").on(table.qualityScore),
  ],
);

/** §12 / §35 — pgvector index over reference descriptions. */
export const referenceEmbeddings = pgTable(
  "reference_embeddings",
  {
    referenceId: text("reference_id")
      .primaryKey()
      .references(() => referenceDesigns.id, { onDelete: "cascade" }),
    model: text("model").notNull(),
    dimensions: integer("dimensions").notNull(),
    embedding: vector("embedding", { dimensions: 1536 }),
    text: text("text").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [
    index("reference_embedding_idx").using("hnsw", table.embedding.op("vector_cosine_ops")),
  ],
);

// ------------------------------------------------------- behavioural signals

/** §41 — anonymous-by-default behavioural signals that train the ranker. */
export const events = pgTable(
  "events",
  {
    id: id(),
    organisationId: text("organisation_id"),
    projectId: text("project_id"),
    designId: text("design_id"),
    userId: text("user_id"),
    packId: text("pack_id"),
    sessionId: text("session_id"),
    type: text("type").notNull(),
    payload: jsonb("payload").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [
    index("events_type_idx").on(table.type),
    index("events_design_idx").on(table.designId),
    index("events_pack_idx").on(table.packId),
    index("events_session_idx").on(table.sessionId),
  ],
);

/** §48 — design credits, not tokens. */
export const creditLedger = pgTable(
  "credit_ledger",
  {
    id: id(),
    organisationId: text("organisation_id").notNull().references(() => organisations.id, { onDelete: "cascade" }),
    delta: integer("delta").notNull(),
    reason: text("reason").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    createdAt: createdAt(),
  },
  (table) => [index("credit_org_idx").on(table.organisationId)],
);

// ------------------------------------------------------------- packs & commerce (D-01, D-02, D-03)

export const packs = pgTable(
  "packs",
  {
    id: id(),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    brief: jsonb("brief").notNull(),
    status: text("status").notNull().default("created"),
    selectedConceptId: text("selected_concept_id"),
    requestedFormats: jsonb("requested_formats").notNull().default(sql`'[]'::jsonb`),
    downloadKey: text("download_key"),
    packDefinitionVersion: text("pack_definition_version").default("1.0"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("packs_user_idx").on(table.userId), index("packs_status_idx").on(table.status)],
);

export const packConcepts = pgTable(
  "pack_concepts",
  {
    id: id(),
    packId: text("pack_id").notNull().references(() => packs.id, { onDelete: "cascade" }),
    title: text("title").notNull().default(""),
    description: text("description").notNull().default(""),
    visualDirection: text("visual_direction").notNull().default(""),
    vqs: real("vqs").notNull().default(0),
    vqsVersion: text("vqs_version").default("1.0"),
    vqsReport: jsonb("vqs_report"),
    document: jsonb("document").notNull(),
    previewKey: text("preview_key").notNull(),
    thumbnailKey: text("thumbnail_key").notNull(),
    status: text("status").notNull().default("generated"),
    createdAt: createdAt(),
  },
  (table) => [index("pack_concepts_pack_idx").on(table.packId)],
);

export const orders = pgTable(
  "orders",
  {
    id: id(),
    packId: text("pack_id").notNull().references(() => packs.id, { onDelete: "cascade" }),
    userId: text("user_id").references(() => users.id, { onDelete: "set null" }),
    productId: text("product_id").notNull().default("single"),
    creditsGranted: integer("credits_granted").notNull().default(1),
    amount: integer("amount").notNull().default(299),
    currency: text("currency").notNull().default("usd"),
    provider: text("provider").notNull().default("stripe"),
    providerSessionId: text("provider_session_id").notNull().default(""),
    status: text("status").notNull().default("pending"),
    refundStatus: text("refund_status").default("none"),
    refundReason: text("refund_reason"),
    refundedAt: timestamp("refunded_at", { withTimezone: true }),
    refundAmount: integer("refund_amount").default(0),
    packDefinitionVersion: text("pack_definition_version").default("1.0"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("orders_pack_idx").on(table.packId), index("orders_status_idx").on(table.status)],
);

export const generationJobs = pgTable(
  "generation_jobs",
  {
    id: id(),
    packId: text("pack_id").notNull().references(() => packs.id, { onDelete: "cascade" }),
    type: text("type").notNull().default("concepts"),
    status: text("status").notNull().default("queued"),
    progress: integer("progress").notNull().default(0),
    error: text("error"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("generation_jobs_pack_idx").on(table.packId)],
);

// ------------------------------------------------------------- D-02 Credit Wallet & Ledger

export const creditWallets = pgTable(
  "credit_wallets",
  {
    id: id(),
    userId: text("user_id").notNull().unique(),
    balance: integer("balance").notNull().default(0),
    lifetimePurchased: integer("lifetime_purchased").notNull().default(0),
    lifetimeUsed: integer("lifetime_used").notNull().default(0),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [uniqueIndex("credit_wallets_user_idx").on(table.userId)],
);

export const creditTransactions = pgTable(
  "credit_transactions",
  {
    id: id(),
    walletId: text("wallet_id").notNull().references(() => creditWallets.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull(),
    type: text("type").notNull(), // purchase | grant | consumption | refund | adjustment
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    referenceType: text("reference_type").notNull(), // order | pack | edit | admin
    referenceId: text("reference_id").notNull(),
    description: text("description").notNull().default(""),
    createdAt: createdAt(),
  },
  (table) => [
    index("credit_tx_user_idx").on(table.userId),
    index("credit_tx_wallet_idx").on(table.walletId),
    index("credit_tx_ref_idx").on(table.referenceType, table.referenceId),
  ],
);

// ------------------------------------------------------------- D-04 Pack Versions & Post-Purchase Uploads

export const packVersions = pgTable(
  "pack_versions",
  {
    id: id(),
    packId: text("pack_id").notNull().references(() => packs.id, { onDelete: "cascade" }),
    versionNumber: integer("version_number").notNull(),
    parentVersionId: text("parent_version_id"),
    conceptId: text("concept_id").notNull(),
    label: text("label").notNull().default(""),
    document: jsonb("document").notNull(),
    patch: jsonb("patch"),
    editCategory: text("edit_category"), // TEXT_CORRECTION | DATE_TIME_CORRECTION | PHOTO_SWAP | STRUCTURAL_REGENERATION | CREATIVE_REGENERATION
    previewKey: text("preview_key").notNull(),
    downloadKey: text("download_key"),
    createdAt: createdAt(),
  },
  (table) => [
    index("pack_versions_pack_idx").on(table.packId),
    index("pack_versions_pack_num_idx").on(table.packId, table.versionNumber),
  ],
);

export const packAssets = pgTable(
  "pack_assets",
  {
    id: id(),
    packId: text("pack_id").notNull().references(() => packs.id, { onDelete: "cascade" }),
    userId: text("user_id"),
    kind: text("kind").notNull().default("subject_photo"), // subject_photo | logo
    storageKey: text("storage_key").notNull(),
    originalFilename: text("original_filename").default(""),
    mimeType: text("mime_type").notNull(),
    bytes: integer("bytes").notNull().default(0),
    width: integer("width").notNull().default(0),
    height: integer("height").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("pack_assets_pack_idx").on(table.packId)],
);

// ------------------------------------------------------------- D-05 Pack Shares & Funnel Events

export const packShares = pgTable(
  "pack_shares",
  {
    id: id(),
    packId: text("pack_id").notNull().references(() => packs.id, { onDelete: "cascade" }),
    conceptId: text("concept_id").notNull(),
    token: text("token").notNull().unique(),
    viewsCount: integer("views_count").notNull().default(0),
    referralSource: text("referral_source").default(""),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("pack_shares_token_idx").on(table.token),
    index("pack_shares_pack_idx").on(table.packId),
  ],
);

export const analyticsEvents = pgTable(
  "analytics_events",
  {
    id: id(),
    eventName: text("event_name").notNull(),
    sessionId: text("session_id"),
    userId: text("user_id"),
    packId: text("pack_id"),
    conceptId: text("concept_id"),
    shareToken: text("share_token"),
    cohortId: text("cohort_id"),
    referralSource: text("referral_source"),
    metadata: jsonb("metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: createdAt(),
  },
  (table) => [
    index("analytics_event_name_idx").on(table.eventName),
    index("analytics_pack_idx").on(table.packId),
    index("analytics_cohort_idx").on(table.cohortId),
    index("analytics_created_idx").on(table.createdAt),
  ],
);

// ------------------------------------------------------------- VQS Blind Designer Experiment

export const vqsExperiments = pgTable(
  "vqs_experiments",
  {
    id: id(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    vqsVersion: text("vqs_version").notNull().default("1.1"),
    status: text("status").notNull().default("active"), // active | closed
    targetSampleSize: integer("target_sample_size").notNull().default(50),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (table) => [index("vqs_exp_status_idx").on(table.status)],
);

export const vqsExperimentSamples = pgTable(
  "vqs_experiment_samples",
  {
    id: id(),
    experimentId: text("experiment_id").notNull().references(() => vqsExperiments.id, { onDelete: "cascade" }),
    packId: text("pack_id").notNull(),
    conceptId: text("concept_id").notNull(),
    previewKey: text("preview_key").notNull(),
    previewUrl: text("preview_url").notNull(),
    vqsScore: real("vqs_score").notNull(),
    vqsReport: jsonb("vqs_report"),
    vqsVersion: text("vqs_version").notNull().default("1.1"),
    randomOrderWeight: real("random_order_weight").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("vqs_samples_exp_idx").on(table.experimentId)],
);

export const vqsExperimentRaters = pgTable(
  "vqs_experiment_raters",
  {
    id: id(),
    experimentId: text("experiment_id").notNull().references(() => vqsExperiments.id, { onDelete: "cascade" }),
    raterToken: text("rater_token").notNull().unique(),
    pseudonym: text("pseudonym").notNull(),
    experienceYears: integer("experience_years").default(0),
    isProfessionalDesigner: boolean("is_professional_designer").default(true),
    consentGivenAt: timestamp("consent_given_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: createdAt(),
  },
  (table) => [
    uniqueIndex("vqs_raters_token_idx").on(table.raterToken),
    index("vqs_raters_exp_idx").on(table.experimentId),
  ],
);

export const vqsExperimentRatings = pgTable(
  "vqs_experiment_ratings",
  {
    id: id(),
    experimentId: text("experiment_id").notNull().references(() => vqsExperiments.id, { onDelete: "cascade" }),
    sampleId: text("sample_id").notNull().references(() => vqsExperimentSamples.id, { onDelete: "cascade" }),
    raterId: text("rater_id").notNull().references(() => vqsExperimentRaters.id, { onDelete: "cascade" }),
    visualQuality: integer("visual_quality").notNull(), // 1 to 5
    professionalism: integer("professionalism").notNull(), // 1 to 5
    clarity: integer("clarity").notNull(), // 1 to 5
    likelihoodToUse: integer("likelihood_to_use").notNull(), // 1 to 5
    willingnessToPayBracket: text("willingness_to_pay_bracket").notNull(), // "0", "1-3", "3-5", "5-10", "10+"
    qualitativeFeedback: text("qualitative_feedback").default(""),
    durationMs: integer("duration_ms").default(0),
    createdAt: createdAt(),
  },
  (table) => [
    index("vqs_ratings_exp_idx").on(table.experimentId),
    index("vqs_ratings_sample_idx").on(table.sampleId),
    index("vqs_ratings_rater_idx").on(table.raterId),
    uniqueIndex("vqs_ratings_rater_sample_idx").on(table.raterId, table.sampleId),
  ],
);

// ------------------------------------------------------------- Vision Service COGS & Metering

export const visionMetering = pgTable(
  "vision_metering",
  {
    id: id(),
    packId: text("pack_id"),
    editId: text("edit_id"),
    versionNumber: integer("version_number"),
    provider: text("provider").notNull().default("fastapi_rembg"), // fastapi_rembg | hosted_api | mock
    model: text("model").notNull().default("u2net"),
    operationType: text("operation_type").notNull(), // cutout | analysis
    inputBytes: integer("input_bytes").notNull().default(0),
    outputBytes: integer("output_bytes").notNull().default(0),
    durationMs: integer("duration_ms").notNull().default(0),
    success: boolean("success").notNull().default(true),
    estimatedCostUsd: real("estimated_cost_usd").notNull().default(0),
    actualCostUsd: real("actual_cost_usd"),
    currency: text("currency").notNull().default("usd"),
    pricingVersion: text("pricing_version").notNull().default("2026.1"),
    error: text("error"),
    createdAt: createdAt(),
  },
  (table) => [
    index("vision_metering_pack_idx").on(table.packId),
    index("vision_metering_created_idx").on(table.createdAt),
  ],
);

// ------------------------------------------------------------- D-06 Webhook Idempotency

export const processedWebhooks = pgTable(
  "processed_webhooks",
  {
    id: id(),
    provider: text("provider").notNull(), // stripe | paystack | flutterwave
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    orderId: text("order_id"),
    processedAt: createdAt(),
  },
  (table) => [
    uniqueIndex("webhook_provider_event_idx").on(table.provider, table.eventId),
    index("webhook_order_idx").on(table.orderId),
  ],
);

