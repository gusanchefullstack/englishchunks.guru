type ObjectUrls = Pick<typeof URL, "createObjectURL" | "revokeObjectURL">;

/**
 * On-device replay copies of the learner's own recordings ("Hear yourself", FR-075).
 * Memory only: one object URL per item, revoked as soon as it is replaced or cleared.
 * Never write these clips to browser storage or send them anywhere.
 */
export class OwnClips {
  private readonly urls = new Map<string, string>();

  constructor(private readonly api: ObjectUrls = URL) {}

  /** Keeps `blob` as the item's latest clip, releasing the one it replaces. */
  set(key: string, blob: Blob): string {
    this.release(key);
    const url = this.api.createObjectURL(blob);
    this.urls.set(key, url);
    return url;
  }

  get(key: string): string | undefined {
    return this.urls.get(key);
  }

  get size(): number {
    return this.urls.size;
  }

  /** Releases every clip (step ends, practice ends, page is left). */
  clear(): void {
    for (const key of [...this.urls.keys()]) this.release(key);
  }

  private release(key: string) {
    const url = this.urls.get(key);
    if (url === undefined) return;
    this.api.revokeObjectURL(url);
    this.urls.delete(key);
  }
}
