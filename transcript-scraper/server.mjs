import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { getYouTubeTranscript } from "./lib/youtube-transcript.mjs";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));
const publicDirectory = join(rootDirectory, "public");
const port = Number(process.env.PORT ?? 4173);
const hostname = process.env.HOST ?? "127.0.0.1";
const maximumBodySize = 10_000;
const transcriptCache = new Map();

const publicFiles = new Map([
  ["/", "index.html"],
  ["/app.js", "app.js"],
  ["/styles.css", "styles.css"],
]);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function sendJson(response, statusCode, value) {
  response.writeHead(statusCode, {
    "cache-control": "no-store",
    "content-type": "application/json; charset=utf-8",
  });
  response.end(JSON.stringify(value));
}

async function readJsonBody(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > maximumBodySize) throw new Error("Request is too large");
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new Error("Request body must be valid JSON");
  }
}

async function handleTranscriptRequest(request, response) {
  try {
    const body = await readJsonBody(request);
    const result = await getYouTubeTranscript(body.url);
    transcriptCache.delete(result.videoId);
    transcriptCache.set(result.videoId, result);

    if (transcriptCache.size > 20) {
      transcriptCache.delete(transcriptCache.keys().next().value);
    }

    sendJson(response, 200, { ok: true, result });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Extraction failed";
    const statusCode = /valid YouTube|does not contain|does not expose/.test(message)
      ? 400
      : 502;
    sendJson(response, statusCode, { error: message, ok: false });
  }
}

function handleDownloadRequest(pathname, response) {
  const match = pathname.match(
    /^\/api\/transcript\/([A-Za-z0-9_-]{11})\.(srt|json)$/,
  );
  if (!match) return false;

  const [, videoId, format] = match;
  const result = transcriptCache.get(videoId);

  if (!result) {
    sendJson(response, 404, {
      error: "Extract this transcript again before downloading it",
      ok: false,
    });
    return true;
  }

  const filename = `${videoId}-${result.languageCode}.${format}`;
  const contents = format === "srt"
    ? result.srt
    : `${JSON.stringify({ ...result, srt: undefined }, null, 2)}\n`;

  response.writeHead(200, {
    "cache-control": "no-store",
    "content-disposition": `attachment; filename="${filename}"`,
    "content-type": format === "srt"
      ? "application/x-subrip; charset=utf-8"
      : "application/json; charset=utf-8",
    "x-content-type-options": "nosniff",
  });
  response.end(contents);
  return true;
}

async function handleStaticRequest(pathname, response) {
  const filename = publicFiles.get(pathname);
  if (!filename) {
    response.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const file = await readFile(join(publicDirectory, filename));
  response.writeHead(200, {
    "cache-control": "no-store",
    "content-type": contentTypes[extname(filename)],
  });
  response.end(file);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", `http://${request.headers.host}`);

  if (request.method === "POST" && url.pathname === "/api/transcript") {
    await handleTranscriptRequest(request, response);
    return;
  }

  if (request.method === "GET") {
    if (handleDownloadRequest(url.pathname, response)) return;
    await handleStaticRequest(url.pathname, response);
    return;
  }

  response.writeHead(405, {
    allow: "GET, POST",
    "content-type": "text/plain; charset=utf-8",
  });
  response.end("Method not allowed");
});

server.listen(port, hostname, () => {
  console.log(`YouTube Transcript Client: http://${hostname}:${port}`);
});
