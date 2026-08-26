# eGov Business docs

System documentation for eGov Business: architecture, registration flows, and the eGov
partner API integration points. Built with [Fumadocs](https://fumadocs.dev) on Next.js 16 and
exported as static HTML.

```bash
bun run dev:docs     # http://localhost:3001
bun --filter egov-docs build
```

The build writes plain files to `out/`. Nothing here needs a server at request time, so it
deploys as static assets.

## Layout

| Path                         | Contents                                                |
| ---------------------------- | ------------------------------------------------------- |
| `content/docs/`              | The pages, as MDX. This is the only place to edit prose |
| `content/docs/*/meta.json`   | Sidebar titles and page ordering                        |
| `src/components/mermaid.tsx` | Build-time Mermaid rendering                            |
| `src/lib/source.ts`          | The Fumadocs content loader                             |
| `src/lib/shared.ts`          | Site name, GitHub links, SDK docs URL                   |
| `source.config.ts`           | MDX pipeline, including the Mermaid remark plugin       |

## Diagrams

Write a plain ` ```mermaid ` fence. `remarkMdxMermaid` turns it into the `<Mermaid>` component
and [`beautiful-mermaid`](https://www.npmjs.com/package/beautiful-mermaid) renders it to SVG
**during the build**, inside a server component.

That means no Mermaid runtime reaches the browser, nothing hydrates, and there is no layout
shift while a diagram draws itself. Diagram labels stay real, selectable text in the HTML.
Colors are emitted as `var(--color-fd-*)` references rather than resolved values, so one
build-time SVG follows the reader's light or dark theme.

Because the fences are ordinary Mermaid, the same diagrams also render on GitHub if you read
the MDX directly.

Supported diagram types are flowchart, sequence, state, class, ER, and XY charts. Anything
`beautiful-mermaid` cannot parse falls back to a code block showing the source instead of
failing the build — so if a diagram appears as code, that is what happened.

## Adding a page

1. Create the `.mdx` file under `content/docs/`, with `title` and `description` frontmatter.
2. Add its slug to the `pages` array in the sibling `meta.json`.
3. `bun run format:fix`, then build.

## Agent-readable output

The build also emits `/llms.txt`, `/llms-full.txt`, and a `.md` version of every page, so the
docs can be fed to an agent without scraping HTML.
