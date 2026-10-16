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
  /** public-read for shared TTS and avatars; private for per-learner sentence audio. */
  visibility: "public" | "private";
  cacheControl?: string;
};

/** Object storage (DigitalOcean Spaces). Never used for learner recordings (FR-019). */
export interface StorageProvider {
  put(key: string, body: Uint8Array, opts: PutOptions): Promise<void>;
  delete(key: string): Promise<void>;
  deletePrefix(prefix: string): Promise<number>;
  signedGetUrl(key: string, expiresInSeconds?: number): Promise<string>;
  publicUrl(key: string): string;
}

class SpacesStorage implements StorageProvider {
  private s3: S3Client;
  private bucket: string;
  private cdn: string;

  constructor() {
    const e = env();
    this.s3 = new S3Client({
      endpoint: e.SPACES_ENDPOINT,
      region: e.SPACES_REGION,
      credentials: { accessKeyId: e.SPACES_KEY, secretAccessKey: e.SPACES_SECRET },
      forcePathStyle: false,
    });
    this.bucket = e.SPACES_BUCKET;
    this.cdn = e.SPACES_CDN_URL.replace(/\/$/, "");
  }

  async put(key: string, body: Uint8Array, opts: PutOptions) {
    await this.s3.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: opts.contentType,
        ACL: opts.visibility === "public" ? "public-read" : "private",
        CacheControl: opts.cacheControl ?? "public, max-age=31536000, immutable",
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
    return getSignedUrl(this.s3, new GetObjectCommand({ Bucket: this.bucket, Key: key }), {
      expiresIn: expiresInSeconds,
    });
  }

  publicUrl(key: string) {
    return `${this.cdn}/${key}`;
  }
}

/** In-memory storage for tests and local development without Spaces. */
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
    return `https://cdn.test/${key}`;
  }
}

let provider: StorageProvider | undefined;

export function storage(): StorageProvider {
  provider ??= e2eMode() ? new MemoryStorage() : new SpacesStorage();
  return provider;
}

/** Test-only override. */
export function setStorage(next: StorageProvider | undefined) {
  provider = next;
}
