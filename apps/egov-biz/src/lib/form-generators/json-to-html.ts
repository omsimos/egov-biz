export type JsonFormCell = {
  value?: string | number | null;
  /** Trusted static HTML (already escaped or authored by the generator). */
  html?: string;
  colspan?: number;
  rowspan?: number;
  className?: string;
};

export type JsonFormRow = {
  cells: JsonFormCell[];
  className?: string;
};

export type JsonFormNode =
  | { type: "text"; value: string | number | null; className?: string; html?: string }
  | { type: "section"; title?: string; children: JsonFormNode[]; className?: string }
  | { type: "table"; rows: JsonFormRow[]; className?: string }
  | { type: "html"; html: string; className?: string };

export type JsonHtmlForm = {
  title: string;
  style: string;
  body: JsonFormNode[];
};

export function escapeHtml(value: string | number | null | undefined): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/** Escape text and preserve intentional line breaks as <br>. */
export function escapeHtmlWithBreaks(value: string | number | null | undefined): string {
  return escapeHtml(value).replaceAll("\n", "<br>");
}

function classAttribute(className: string | undefined): string {
  return className ? ` class="${escapeHtml(className)}"` : "";
}

function renderCellContent(cell: JsonFormCell): string {
  if (cell.html != null) return cell.html;
  return escapeHtmlWithBreaks(cell.value);
}

function renderNode(node: JsonFormNode): string {
  if (node.type === "text") {
    const content = node.html != null ? node.html : escapeHtmlWithBreaks(node.value);
    return `<div${classAttribute(node.className)}>${content}</div>`;
  }

  if (node.type === "html") {
    return `<div${classAttribute(node.className)}>${node.html}</div>`;
  }

  if (node.type === "section") {
    return `<section${classAttribute(node.className)}>${node.title ? `<h2>${escapeHtml(node.title)}</h2>` : ""}${node.children.map(renderNode).join("")}</section>`;
  }

  return `<table${classAttribute(node.className)}><tbody>${node.rows
    .map(
      (row) =>
        `<tr${classAttribute(row.className)}>${row.cells
          .map((cell) => {
            const span = cell.colspan ? ` colspan="${cell.colspan}"` : "";
            const rowSpan = cell.rowspan ? ` rowspan="${cell.rowspan}"` : "";
            return `<td${classAttribute(cell.className)}${span}${rowSpan}>${renderCellContent(cell)}</td>`;
          })
          .join("")}</tr>`,
    )
    .join("")}</tbody></table>`;
}

/** Render a declarative JSON form definition into a self-contained printable HTML document. */
export function renderJsonFormHtml(form: JsonHtmlForm): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(form.title)}</title>
<style>${form.style}</style>
</head>
<body>${form.body.map(renderNode).join("")}</body>
</html>`;
}
