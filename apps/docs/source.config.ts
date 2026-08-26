import { remarkMdxMermaid } from "fumadocs-core/mdx-plugins";
import { defineConfig, defineDocs } from "fumadocs-mdx/config";

export const docs = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      // Keeps the processed Markdown around so /llms.txt, /llms-full.txt, and
      // the per-page .md route can serve it to agents and to the copy button.
      includeProcessedMarkdown: true,
    },
  },
});

export default defineConfig({
  mdxOptions: {
    // The function form receives the Fumadocs preset's plugins, so appending
    // keeps Shiki highlighting, heading anchors, and the search structure
    // extractor. Passing a bare array here would replace all of them.
    //
    // remarkMdxMermaid runs first so a ```mermaid fence becomes a <Mermaid>
    // element before the code-block plugins try to highlight a language Shiki
    // does not know.
    remarkPlugins: (plugins) => [remarkMdxMermaid, ...plugins],
  },
});
