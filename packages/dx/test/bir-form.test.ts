import { describe, expect, test } from "bun:test";
import { createHash } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { createFileStorage } from "@omsimos/utils/files";

import { BirError, createBirFormService } from "../src/bir/index.js";

const templatePaths = {
  "1901": fileURLToPath(
    new URL("../../../apps/egov-biz/public/forms/bir-form-1901.pdf", import.meta.url),
  ),
  "1905": fileURLToPath(
    new URL("../../../apps/egov-biz/public/forms/bir-form-1905.pdf", import.meta.url),
  ),
};

const actor = { egovUserId: "egov-citizen-123" };
const artifactId = "7b8624a6-d258-42de-998d-7b5acaa58986";

function ownerHash(egovUserId: string) {
  return createHash("sha256").update(egovUserId).digest("hex");
}

describe("BIR form fill and save", () => {
  test("fills Form 1901, saves it privately, and reads it for its owner", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "egov-bir-"));
    try {
      const storage = createFileStorage({ environment: {}, filesystemRoot: rootDirectory });
      const bir = createBirFormService({
        generateId: () => artifactId,
        storage,
        templatePaths,
      });

      const artifact = await bir.fillOutAndSaveForm({
        actor,
        form: {
          type: "1901",
          data: {
            taxpayerInformation: {
              rdoCode: "043",
              taxpayerName: { firstName: "Juan", lastName: "Dela Cruz" },
            },
          },
        },
      });

      expect(artifact).toEqual({
        artifactId,
        filename: "BIR-Form-1901.pdf",
        formType: "1901",
        mediaType: "application/pdf",
        pageCount: 4,
        size: expect.any(Number),
      });
      expect(artifact.size).toBeGreaterThan(100_000);

      const saved = await bir.getSavedForm({ actor, artifactId });
      expect(saved).toMatchObject(artifact);
      expect(new TextDecoder().decode(saved.bytes.slice(0, 5))).toBe("%PDF-");

      const key = `bir/${ownerHash(actor.egovUserId)}/${artifactId}.pdf`;
      const stored = await storage.get(key);
      expect(stored?.metadata).toEqual({ "form-type": "1901", "page-count": "4" });
      expect(key).not.toContain(actor.egovUserId);

      await expect(
        bir.getSavedForm({ actor: { egovUserId: "another-citizen" }, artifactId }),
      ).rejects.toEqual(expect.objectContaining<Partial<BirError>>({ code: "FORM_NOT_FOUND" }));
    } finally {
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });

  test("fills and saves Form 1905 through the same interface", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "egov-bir-"));
    try {
      const storage = createFileStorage({ environment: {}, filesystemRoot: rootDirectory });
      const bir = createBirFormService({
        generateId: () => artifactId,
        storage,
        templatePaths,
      });

      const artifact = await bir.fillOutAndSaveForm({
        actor,
        form: {
          type: "1905",
          data: {
            taxpayerInformation: {
              rdoCode: "043",
              registeredName: "Juan Dela Cruz",
              tin: "123-456-789-00000",
            },
          },
        },
      });

      expect(artifact).toMatchObject({
        artifactId,
        filename: "BIR-Form-1905.pdf",
        formType: "1905",
        mediaType: "application/pdf",
        pageCount: 4,
      });
      expect((await bir.getSavedForm({ actor, artifactId })).formType).toBe("1905");
    } finally {
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });

  test("validates authorization and never saves a form that failed to render", async () => {
    const rootDirectory = await mkdtemp(join(tmpdir(), "egov-bir-"));
    try {
      const storage = createFileStorage({ environment: {}, filesystemRoot: rootDirectory });
      const bir = createBirFormService({
        generateId: () => artifactId,
        storage,
        templatePaths,
      });

      await expect(
        bir.fillOutAndSaveForm({
          actor: { egovUserId: " " },
          form: { type: "1901", data: {} },
        }),
      ).rejects.toEqual(expect.objectContaining<Partial<BirError>>({ code: "INVALID_ACTOR" }));

      await expect(
        bir.fillOutAndSaveForm({
          actor,
          form: {
            type: "1901",
            data: { taxpayerInformation: { taxpayerName: { firstName: "Juan 李" } } },
          },
        }),
      ).rejects.toThrow("cannot render Unicode character");

      const key = `bir/${ownerHash(actor.egovUserId)}/${artifactId}.pdf`;
      expect(await storage.get(key)).toBeUndefined();
      await expect(bir.getSavedForm({ actor, artifactId: "not-a-uuid" })).rejects.toEqual(
        expect.objectContaining<Partial<BirError>>({ code: "FORM_NOT_FOUND" }),
      );
    } finally {
      await rm(rootDirectory, { force: true, recursive: true });
    }
  });
});
