import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

export const revalidate = false;

// staticGET writes the search index as a static asset at build time, which is
// what the static client on the browser side fetches.
export const { staticGET: GET } = createFromSource(source, {
  language: "english",
});
