import { renderMermaidSVG } from "beautiful-mermaid";
import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";

/**
 * Renders a Mermaid diagram to SVG during the build.
 *
 * This is a server component and `beautiful-mermaid` has no DOM dependency, so
 * the diagram is already inline SVG by the time the page reaches a browser: no
 * Mermaid bundle is shipped, nothing hydrates, and there is no layout shift
 * while a diagram draws itself.
 *
 * Colors are emitted as `var(--color-fd-*)` references rather than resolved
 * values, which is what lets one build-time SVG follow the reader's light or
 * dark theme.
 */
export function Mermaid({ chart }: { chart: string }) {
  let svg: string;
  try {
    svg = renderMermaidSVG(chart, {
      bg: "var(--color-fd-background)",
      fg: "var(--color-fd-foreground)",
      transparent: true,
      interactive: false,
    });
  } catch {
    // beautiful-mermaid covers flowchart, sequence, state, class, ER, and XY
    // charts. Anything it cannot parse falls back to its source instead of
    // failing the build.
    return (
      <CodeBlock title="Mermaid">
        <Pre>{chart}</Pre>
      </CodeBlock>
    );
  }

  return (
    <div
      className="my-6 overflow-x-auto rounded-lg border bg-fd-card p-4 [&_svg]:mx-auto [&_svg]:h-auto [&_svg]:max-w-full"
      // SAFETY: `svg` is markup produced by beautiful-mermaid from diagram
      // source committed in this repository, not from user input.
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
