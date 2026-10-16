import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { z } from "zod";
import {
  recordingMimeTypes,
  ScoreResult,
  Unusable,
  unusableReasons,
} from "@/lib/contracts/scoring";
import { fakeScore } from "../mocks/handlers";

type JsonSchema = {
  type?: string;
  required?: string[];
  properties?: Record<string, JsonSchema>;
  enum?: string[];
  items?: JsonSchema;
  maxItems?: number;
};
const spec = parse(
  readFileSync(
    new URL(
      "../../../specs/001-chunk-learning-app/contracts/scoring-service.openapi.yaml",
      import.meta.url,
    ),
    "utf8",
  ),
) as {
  components: { schemas: Record<string, JsonSchema> };
  paths: Record<
    string,
    Record<string, { requestBody: { content: Record<string, { schema: JsonSchema }> } }>
  >;
};

const zodJson = (schema: z.ZodType) => z.toJSONSchema(schema, { io: "input" }) as JsonSchema;

describe("scoring contract: web Zod schemas ↔ OpenAPI", () => {
  it("ScoreResult has the same required fields and component keys", () => {
    const api = spec.components.schemas.ScoreResult!;
    const ours = zodJson(ScoreResult);
    expect([...(ours.required ?? [])].sort()).toEqual([...(api.required ?? [])].sort());
    expect(Object.keys(ours.properties!.components!.properties!).sort()).toEqual(
      Object.keys(api.properties!.components!.properties!).sort(),
    );
    expect(ours.properties!.weakest_sounds!.maxItems).toBe(
      api.properties!.weakest_sounds!.maxItems,
    );
  });

  it("Unusable reasons match exactly", () => {
    expect([...unusableReasons].sort()).toEqual(
      [...spec.components.schemas.Unusable!.properties!.reason!.enum!].sort(),
    );
    expect(zodJson(Unusable).required).toEqual(spec.components.schemas.Unusable!.required);
  });

  it("accepted recording MIME types match the request schema", () => {
    const form = spec.paths["/v1/score"]!.post!.requestBody.content["multipart/form-data"]!.schema;
    expect([...recordingMimeTypes].sort()).toEqual([...form.properties!.mime_type!.enum!].sort());
  });

  it("the MSW fake response satisfies the client schema", () => {
    expect(ScoreResult.safeParse(fakeScore()).success).toBe(true);
  });
});
