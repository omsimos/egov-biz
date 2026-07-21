import { describe, expect, test } from "bun:test";

import { createEgovTransport } from "../src/core/client.js";
import { EgovApiError } from "../src/core/errors.js";

describe("createEgovTransport", () => {
  test("builds a JSON request with merged headers and query values", async () => {
    let capturedRequest: Request | undefined;
    const transport = createEgovTransport({
      baseUrl: "https://api.example.test/v1",
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ ok: true });
      },
      headers: { authorization: "Bearer token" },
    });

    const response = await transport.request<{ ok: boolean }, { value: number }>({
      body: { value: 42 },
      headers: { "x-request-id": "request-1" },
      method: "POST",
      path: "/items",
      query: { active: true, tag: ["one", "two"] },
    });

    expect(response).toEqual({ ok: true });
    expect(capturedRequest?.url).toBe(
      "https://api.example.test/v1/items?active=true&tag=one&tag=two",
    );
    expect(capturedRequest?.headers.get("authorization")).toBe("Bearer token");
    expect(capturedRequest?.headers.get("content-type")).toBe("application/json");
    expect(capturedRequest?.headers.get("x-request-id")).toBe("request-1");
    expect(await capturedRequest?.json()).toEqual({ value: 42 });
  });

  test("throws an EgovApiError with the parsed response body", async () => {
    const transport = createEgovTransport({
      baseUrl: "https://api.example.test",
      fetch: async () =>
        Response.json({ message: "Invalid token" }, { status: 401, statusText: "Unauthorized" }),
    });

    const request = transport.request({ method: "GET", path: "/protected" });

    await expect(request).rejects.toBeInstanceOf(EgovApiError);
    await expect(request).rejects.toMatchObject({
      body: { message: "Invalid token" },
      method: "GET",
      status: 401,
      url: "https://api.example.test/protected",
    });
  });
});
