import { z } from "zod";

/**
 * Every external dependency is optional so the design engine can run locally
 * with zero cloud accounts. Features degrade explicitly rather than crashing.
 */
const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  // Database
  DATABASE_URL: z.string().default("postgresql://localhost:5432/gdp"),

  // Storage: "fs" for local dev, "s3" for R2/S3
  STORAGE_DRIVER: z.enum(["fs", "s3"]).default("fs"),
  STORAGE_FS_ROOT: z.string().default("./storage-dev"),
  STORAGE_PUBLIC_URL: z.string().default("/api/assets"),
  S3_ENDPOINT: z.string().optional(),
  S3_REGION: z.string().default("auto"),
  S3_BUCKET: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),

  // LLM providers (§29-§31 model routing)
  LLM_PROVIDER: z.enum(["anthropic", "openai", "mock"]).default("mock"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  MODEL_BRIEF: z.string().default("claude-haiku-4-5-20251001"),
  MODEL_PLANNER: z.string().default("claude-sonnet-5"),
  MODEL_CRITIC: z.string().default("claude-haiku-4-5-20251001"),
  MODEL_EDITOR: z.string().default("claude-sonnet-5"),
  EMBEDDING_PROVIDER: z.enum(["openai", "local", "mock"]).default("local"),
  EMBEDDING_MODEL: z.string().default("text-embedding-3-small"),
  EMBEDDING_DIM: z.coerce.number().int().default(1536),

  // Vision service (background removal + asset analysis)
  VISION_SERVICE_URL: z.string().optional(),

  // Queue
  REDIS_URL: z.string().default("redis://localhost:6379"),
  QUEUE_ENABLED: z.coerce.boolean().default(false),

  // Engine tuning (§66 anti-slop threshold)
  VQS_THRESHOLD: z.coerce.number().default(82),
  CANDIDATES_PER_GENERATION: z.coerce.number().int().default(10),
  CONCEPTS_SHOWN: z.coerce.number().int().default(3),
  FONT_DIR: z.string().default("./assets/fonts"),

  // Commerce & Payments (D-02, D-03, D-06)
  APP_URL: z.string().default("http://localhost:3000"),
  PAYMENT_PROVIDER: z.enum(["stripe", "dev", "paystack", "flutterwave"]).default("dev"),
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  PAYSTACK_SECRET_KEY: z.string().optional(),
  PAYSTACK_WEBHOOK_SECRET: z.string().optional(),
  FLUTTERWAVE_SECRET_KEY: z.string().optional(),
  FLUTTERWAVE_WEBHOOK_SECRET: z.string().optional(),
  PACK_PRICE_CENTS: z.coerce.number().int().default(299),
  BUNDLE_PRICE_CENTS: z.coerce.number().int().default(999),
});

export type Env = z.infer<typeof EnvSchema>;

let cached: Env | null = null;

export function env(): Env {
  if (cached) return cached;
  const parsed = EnvSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${JSON.stringify(parsed.error.flatten().fieldErrors)}`);
  }
  cached = parsed.data;
  return cached;
}

/** Test helper — forget the memoised env. */
export function resetEnv(): void {
  cached = null;
}
