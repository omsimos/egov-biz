import { readSession } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

const dataImagePattern = /^data:(image\/(?:avif|gif|jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/;

function headers(contentType: string) {
  return {
    "Cache-Control": "private, no-store",
    "Content-Type": contentType,
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(request: Request) {
  const session = readSession(request);
  if (!session) return new Response(null, { status: 401 });

  const source = session.rawProfile.photo.trim();
  if (!source) return new Response(null, { status: 404 });

  const dataImage = dataImagePattern.exec(source);
  if (dataImage?.[1] && dataImage[2]) {
    const bytes = Buffer.from(dataImage[2].replaceAll(/\s/g, ""), "base64");
    if (bytes.byteLength > 5_000_000) return new Response(null, { status: 413 });
    return new Response(bytes, { headers: headers(dataImage[1]) });
  }

  try {
    const url = new URL(source);
    if (url.protocol !== "https:") return new Response(null, { status: 404 });

    const upstream = await fetch(url, {
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    const contentType = upstream.headers.get("content-type")?.split(";")[0]?.trim() ?? "";
    const contentLength = Number.parseInt(upstream.headers.get("content-length") ?? "0", 10);
    if (!upstream.ok || !contentType.startsWith("image/") || contentLength > 5_000_000) {
      return new Response(null, { status: 404 });
    }
    return new Response(upstream.body, { headers: headers(contentType) });
  } catch {
    return new Response(null, { status: 404 });
  }
}
