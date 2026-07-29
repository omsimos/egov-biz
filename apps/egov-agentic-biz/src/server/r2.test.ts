import { describe, expect, test } from "bun:test";
import { birFormObjectKey, r2Config } from "@/server/r2";

describe("Cloudflare R2 artifact storage", () => {
  const accountId = "a".repeat(32);
  const completeEnvironment = {
    R2_ACCESS_KEY: "access",
    R2_BASE_URL: `https://${accountId}.r2.cloudflarestorage.com/egov`,
    R2_SECRET_KEY: "secret",
  };

  test("reads the endpoint and bucket from R2_BASE_URL", () => {
    expect(r2Config(completeEnvironment)).toEqual({
      accessKeyId: "access",
      bucket: "egov",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      secretAccessKey: "secret",
    });
  });

  test("supports a trailing slash and jurisdiction-specific endpoint", () => {
    expect(
      r2Config({
        ...completeEnvironment,
        R2_BASE_URL: `https://${accountId}.eu.r2.cloudflarestorage.com/egov/`,
      }),
    ).toMatchObject({
      bucket: "egov",
      endpoint: `https://${accountId}.eu.r2.cloudflarestorage.com`,
    });
  });

  test("requires the configured access key, secret, and bucket-qualified base URL", () => {
    expect(() => r2Config({})).toThrow("R2_ACCESS_KEY");
    expect(() => r2Config({ R2_ACCESS_KEY: "access" })).toThrow("R2_BASE_URL");
    expect(() =>
      r2Config({
        R2_ACCESS_KEY: "access",
        R2_BASE_URL: completeEnvironment.R2_BASE_URL,
      }),
    ).toThrow("R2_SECRET_KEY");
  });

  test("rejects insecure, non-R2, and bucket-less base URLs", () => {
    expect(() =>
      r2Config({
        ...completeEnvironment,
        R2_BASE_URL: `http://${accountId}.r2.cloudflarestorage.com/egov`,
      }),
    ).toThrow("HTTPS Cloudflare R2");
    expect(() =>
      r2Config({
        ...completeEnvironment,
        R2_BASE_URL: "https://storage.example.test/egov",
      }),
    ).toThrow("HTTPS Cloudflare R2");
    expect(() =>
      r2Config({
        ...completeEnvironment,
        R2_BASE_URL: `https://${accountId}.r2.cloudflarestorage.com`,
      }),
    ).toThrow("bucket name");
  });

  test("uses an owner-scoped object key without exposing the owner ID", () => {
    const artifactId = "9c27a942-44ed-4748-8273-4ae662e59a7d";
    const first = birFormObjectKey("citizen-a", artifactId);
    const second = birFormObjectKey("citizen-b", artifactId);

    expect(first).toMatch(/^bir-forms\/[0-9a-f]{64}\/9c27a942-44ed-4748-8273-4ae662e59a7d\.pdf$/);
    expect(first).not.toContain("citizen-a");
    expect(first).not.toBe(second);
  });
});
