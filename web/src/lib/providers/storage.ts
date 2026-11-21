import "server-only";
import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  GetObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { e2eMode } from "@/lib/e2e";
import { env } from "@/lib/env";

export type PutOptions = {
  contentType: string;
  /**
   * Who may read it. The bucket itself is private either way: "public" objects (shared TTS,
   * avatars) are readable by anyone holding a link we hand out, "private" ones (per-learner
   * sentence audio) only by their owner. It sets the default Cache-Control.
   */
  visibility: "public" | "private";
  cacheControl?: string;
};

/** Key prefixes anyone may fetch through /media/<key> (stable URLs, e.g. user.image). */
export const PUBLIC_MEDIA_PREFIXES = ["avatars/", "media/"] as const;

/** Object storage (Cloudflare R2). Never used for learner recordings (FR-019). */
export interface StorageProvider {
  put(key: string, body: Uint8Array, opts: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  /** Short-lived read URL. Stable within an hour, so browsers can reuse their cached copy. */
  signedGetUrl(key: string, expiresInSeconds?: number): Promise<string>;
  /** Stable app URL for a PUBLIC_MEDIA_PREFIXES key; redirects to a signed URL. */
  publicUrl(key: string): string;
}

const SIGNING_WINDOW_S = 3600;

/** Same signed URL for every request in the current hour, still valid `expiresIn` after it ends. */
function signingWindow(expiresInSeconds: number, now = Date.now()) {
  const start = Math.floor(now / 1000 / SIGNING_WINDOW_S) * SIGNING_WINDOW_S;
  return { signingDate: new Date(start * 1000), expiresIn: SIGNING_WINDOW_S + expiresInSeconds };
}

export function mediaPath(key: string) {
  return `/media/${key}`;
}

class R2Storage implements StorageProvider {
  private s3: S3Client;
  private bucket: string;

  constructor() {
    const e = env();
    this.s3 = new S3Client({
      endpoint: `https://${e.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      region: "auto",
      credentials: { accessKeyId: e.R2_ACCESS_KEY_ID, secretAccessKey: e.R2_SECRET_ACCESS_KEY },
    });
    this.bucket = e.R2_BUCKET;
  }

  async put(key: string, body: Uint8Array, opts: PutOptions) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: opts.contentType,
        CacheControl:
          opts.cacheControl ??
          (opts.visibility === "public"
            ? "public, max-age=31536000, immutable"
            : "private, max-age=3600"),
      }),
    );
  }

  async delete(key: string) {
    await this.s3.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }

  async deletePrefix(prefix: string) {
    if (!prefix.endsWith("/")) throw new Error("prefix must end with '/'");
    let deleted = 0;
    let token: string | undefined;
    do {
      const page = await this.s3.send(
        new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }),
      );
      const keys = (page.Contents ?? []).flatMap((o) => (o.Key ? [{ Key: o.Key }] : []));
      if (keys.length) {
        await this.s3.send(
          new DeleteObjectsCommand({ Bucket: this.bucket, Delete: { Objects: keys } }),
        );
        deleted += keys.length;
      }
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
    return deleted;
  }

  async signedGetUrl(key: string, expiresInSeconds = 300) {
    return getSignedUrl(
      this.s3,
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      signingWindow(expiresInSeconds),
    );
  }

  publicUrl(key: string) {
    return mediaPath(key);
  }
}

/** In-memory storage for tests and local development without R2. */
export class MemoryStorage implements StorageProvider {
  readonly objects = new Map<string, { body: Uint8Array } & PutOptions>();
  async put(key: string, body: Uint8Array, opts: PutOptions) {
    this.objects.set(key, { body, ...opts });
  }
  async delete(key: string) {
    this.objects.delete(key);
  }
  async deletePrefix(prefix: string) {
    let n = 0;
    for (const k of [...this.objects.keys()])
      if (k.startsWith(prefix) && this.objects.delete(k)) n++;
    return n;
  }
  async signedGetUrl(key: string) {
    return `https://signed.test/${key}?sig=test`;
  }
  publicUrl(key: string) {
    return mediaPath(key);
  }
}

let provider: StorageProvider | undefined;

export function storage(): StorageProvider {
  provider ??= e2eMode() ? new MemoryStorage() : new R2Storage();
  return provider;
}

/** Test-only override. */
export function setStorage(next: StorageProvider | undefined) {
  provider = next;
}
