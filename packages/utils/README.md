# Utilities

## BIR form generation

`@omsimos/utils/bir-form` contains the shared BIR Form 1901 and 1905 PDF
generators, their input schemas, and their rendering helpers. Applications use
these through the owner-scoped `@omsimos/dx/bir` service.

Both generators require an explicit PDF template path when rendering. The
package does not bundle the PDF templates, so the runtime that owns the
templates supplies their paths.

```ts
import { generateBir1901Pdf } from "@omsimos/utils/bir-form";

const generated = await generateBir1901Pdf(
  {
    taxpayerInformation: {
      rdoCode: "043",
      taxpayerName: { firstName: "Juan", lastName: "Dela Cruz" },
    },
  },
  templatePath,
);
```

## File storage

`@omsimos/utils/files` provides one private artifact-storage API with Cloudflare R2
and local-filesystem backends. Cloudflare R2 exposes an S3-compatible API, so the
R2 backend uses the AWS JavaScript S3 client with the configured R2 endpoint; it
does not shell out to the AWS CLI.

Backend selection is automatic:

- When `R2_BASE_URL`, `R2_ACCESS_KEY`, and `R2_SECRET_KEY` are all present, files
  are stored in the private R2 bucket named in `R2_BASE_URL`.
- When none of those variables is present, files are stored under
  `FILE_STORAGE_DIRECTORY` or `<working directory>/data/artifacts` by default.
- A partial R2 configuration throws an error rather than silently falling back
  to local disk.

```ts
import { createFileStorage } from "@omsimos/utils/files";

const files = createFileStorage();
await files.put({
  key: "bir/<owner-hash>/<artifact-id>.pdf",
  bytes: pdfBytes,
  contentType: "application/pdf",
  metadata: { "form-type": "1901" },
});

const artifact = await files.get("bir/<owner-hash>/<artifact-id>.pdf");
```

Keys are internal safe relative paths. The SDK rejects absolute paths, traversal
segments, and unsafe characters. Filesystem storage writes object bytes and
an atomic manifest beneath its configured root so concurrent writes cannot mix
bytes and metadata. That manifest retains superseded object names until a later
operation can confirm cleanup. R2 objects are private and use `private, no-store`
cache control.
