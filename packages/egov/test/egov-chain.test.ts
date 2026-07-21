import { describe, expect, test } from "bun:test";

import {
  createEgovChainClient,
  EGOV_CHAIN_RPC_URL,
  EgovChainRpcError,
  eGovChainApi,
  egovChainCatalog,
} from "../src/eGovChain/index.js";

describe("eGovChain", () => {
  test("uses the documented public RPC and JSON-RPC envelope", async () => {
    let capturedRequest: Request | undefined;
    const client = createEgovChainClient({
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json({ id: 1, jsonrpc: "2.0", result: "0x343b" });
      },
    });

    const chainId = await client.chainId();

    expect(chainId).toBe("0x343b");
    expect(capturedRequest?.url).toBe(`${EGOV_CHAIN_RPC_URL}/`);
    expect(await capturedRequest?.json()).toEqual({
      id: 1,
      jsonrpc: "2.0",
      method: "eth_chainId",
      params: [],
    });
  });

  test("surfaces JSON-RPC errors returned with HTTP 200", async () => {
    const client = createEgovChainClient({
      fetch: async () =>
        Response.json({
          error: { code: -32_600, message: "Invalid request" },
          id: 1,
          jsonrpc: "2.0",
        }),
    });

    await expect(client.request("invalid_method")).rejects.toBeInstanceOf(EgovChainRpcError);
  });

  test("publishes every participant and guestbook request from the portal", () => {
    expect(egovChainCatalog.endpoints.length).toBeGreaterThanOrEqual(70);
    expect(eGovChainApi.catalog).toBe(egovChainCatalog);
  });
});
