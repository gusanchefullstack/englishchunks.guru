import { describe, expect, it, vi } from "vitest";
import { OwnClips } from "@/lib/own-clips";

function fakeUrls() {
  let n = 0;
  const live = new Set<string>();
  return {
    live,
    createObjectURL: vi.fn(() => {
      const url = `blob:test/${++n}`;
      live.add(url);
      return url;
    }),
    revokeObjectURL: vi.fn((url: string) => void live.delete(url)),
  };
}

const clip = () => new Blob(["audio"], { type: "audio/webm" });

describe("OwnClips (FR-075 on-device replay)", () => {
  it("keeps one clip per item and returns its URL", () => {
    const urls = fakeUrls();
    const clips = new OwnClips(urls);
    const a = clips.set("chunk", clip());
    const b = clips.set("ex1", clip());
    expect(clips.get("chunk")).toBe(a);
    expect(clips.get("ex1")).toBe(b);
    expect(clips.get("ex2")).toBeUndefined();
    expect(clips.size).toBe(2);
  });

  it("releases the previous clip when the item is recorded again", () => {
    const urls = fakeUrls();
    const clips = new OwnClips(urls);
    const first = clips.set("chunk", clip());
    const second = clips.set("chunk", clip());
    expect(urls.revokeObjectURL).toHaveBeenCalledWith(first);
    expect(clips.get("chunk")).toBe(second);
    expect([...urls.live]).toEqual([second]);
  });

  it("releases every clip on clear and can be cleared twice", () => {
    const urls = fakeUrls();
    const clips = new OwnClips(urls);
    clips.set("s1", clip());
    clips.set("s2", clip());
    clips.clear();
    clips.clear();
    expect(urls.live.size).toBe(0);
    expect(urls.revokeObjectURL).toHaveBeenCalledTimes(2);
    expect(clips.size).toBe(0);
    expect(clips.get("s1")).toBeUndefined();
  });
});
