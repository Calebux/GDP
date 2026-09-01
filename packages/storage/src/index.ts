import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { createLogger, env } from "@gdp/core";

const log = createLogger("storage");

export interface PutInput {
  key?: string;
  prefix?: string;
  body: Buffer;
  contentType: string;
  extension?: string;
}

export interface PutResult {
  key: string;
  url: string;
  bytes: number;
  checksum: string;
}

export interface Storage {
  put(input: PutInput): Promise<PutResult>;
  get(key: string): Promise<Buffer>;
  url(key: string): string;
  exists(key: string): Promise<boolean>;
  remove(key: string): Promise<void>;
  dataUri(key: string, contentType?: string): Promise<string>;
}

const EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/svg+xml": "svg",
  "application/pdf": "pdf",
  "application/json": "json",
};

function makeKey(input: PutInput): string {
  if (input.key) return input.key;
  const extension = input.extension ?? EXTENSIONS[input.contentType] ?? "bin";
  const prefix = input.prefix ?? "uploads";
  return `${prefix}/${randomUUID()}.${extension}`;
}

const checksumOf = (body: Buffer): string => createHash("sha256").update(body).digest("hex").slice(0, 32);

/** Local filesystem driver — the default, so the platform runs with no cloud account. */
class FsStorage implements Storage {
  constructor(
    private readonly root: string,
    private readonly publicBase: string,
  ) {}

  private pathFor(key: string): string {
    const safe = key.replace(/\.\./g, "").replace(/^\/+/, "");
    return path.join(path.resolve(this.root), safe);
  }

  async put(input: PutInput): Promise<PutResult> {
    const key = makeKey(input);
    const file = this.pathFor(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, input.body);
    return { key, url: this.url(key), bytes: input.body.byteLength, checksum: checksumOf(input.body) };
  }

  async get(key: string): Promise<Buffer> {
    return readFile(this.pathFor(key));
  }

  url(key: string): string {
    return `${this.publicBase.replace(/\/$/, "")}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    try {
      await stat(this.pathFor(key));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    await rm(this.pathFor(key), { force: true });
  }

  async dataUri(key: string, contentType = "image/png"): Promise<string> {
    const buffer = await this.get(key);
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }
}

/** S3/R2 driver — same interface, loaded lazily so local dev needs no AWS SDK config. */
class S3Storage implements Storage {
  private client: import("@aws-sdk/client-s3").S3Client | null = null;

  constructor(
    private readonly bucket: string,
    private readonly publicBase: string,
  ) {}

  private async s3(): Promise<import("@aws-sdk/client-s3").S3Client> {
    if (this.client) return this.client;
    const { S3Client } = await import("@aws-sdk/client-s3");
    const e = env();
    this.client = new S3Client({
      region: e.S3_REGION,
      ...(e.S3_ENDPOINT ? { endpoint: e.S3_ENDPOINT, forcePathStyle: true } : {}),
      ...(e.S3_ACCESS_KEY_ID && e.S3_SECRET_ACCESS_KEY
        ? { credentials: { accessKeyId: e.S3_ACCESS_KEY_ID, secretAccessKey: e.S3_SECRET_ACCESS_KEY } }
        : {}),
    });
    return this.client;
  }

  async put(input: PutInput): Promise<PutResult> {
    const { PutObjectCommand } = await import("@aws-sdk/client-s3");
    const key = makeKey(input);
    const client = await this.s3();
    await client.send(
      new PutObjectCommand({ Bucket: this.bucket, Key: key, Body: input.body, ContentType: input.contentType }),
    );
    return { key, url: this.url(key), bytes: input.body.byteLength, checksum: checksumOf(input.body) };
  }

  async get(key: string): Promise<Buffer> {
    const { GetObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.s3();
    const response = await client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key }));
    const bytes = await response.Body?.transformToByteArray();
    if (!bytes) throw new Error(`Asset not found: ${key}`);
    return Buffer.from(bytes);
  }

  url(key: string): string {
    return `${this.publicBase.replace(/\/$/, "")}/${key}`;
  }

  async exists(key: string): Promise<boolean> {
    const { HeadObjectCommand } = await import("@aws-sdk/client-s3");
    try {
      const client = await this.s3();
      await client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return true;
    } catch {
      return false;
    }
  }

  async remove(key: string): Promise<void> {
    const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
    const client = await this.s3();
    await client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async dataUri(key: string, contentType = "image/png"): Promise<string> {
    const buffer = await this.get(key);
    return `data:${contentType};base64,${buffer.toString("base64")}`;
  }
}

let instance: Storage | null = null;

export function storage(): Storage {
  if (instance) return instance;
  const e = env();
  if (e.STORAGE_DRIVER === "s3" && e.S3_BUCKET) {
    log.info("using S3 storage", { bucket: e.S3_BUCKET });
    instance = new S3Storage(e.S3_BUCKET, e.STORAGE_PUBLIC_URL);
  } else {
    log.info("using local filesystem storage", { root: e.STORAGE_FS_ROOT });
    instance = new FsStorage(e.STORAGE_FS_ROOT, e.STORAGE_PUBLIC_URL);
  }
  return instance;
}

export function resetStorage(): void {
  instance = null;
}
