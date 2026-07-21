import { describe, expect, test } from "bun:test";

import { createEMessageClientFromEnv, emessageCatalog } from "../src/services/emessage.js";

describe("eMessage", () => {
  test("uses EMESSAGE_ACCESS_TOKEN for the documented SMS request", async () => {
    let capturedRequest: Request | undefined;
    const client = createEMessageClientFromEnv({
      baseUrl: "https://message.example.test",
      env: { EMESSAGE_ACCESS_TOKEN: "message-token" },
      fetch: async (input, init) => {
        capturedRequest = new Request(input, init);
        return Response.json(
          { data: { message: "SMS was successfully created." } },
          { status: 201 },
        );
      },
    });

    await client.sendSms({ message: "Hello", number: "+639090000000" });

    expect(capturedRequest?.url).toBe("https://message.example.test/messaging/v1/sms/push");
    expect(capturedRequest?.headers.get("x-emessage-auth")).toBe("message-token");
    expect(await capturedRequest?.json()).toEqual({
      message: "Hello",
      number: "+639090000000",
    });
  });

  test("publishes the Push SMS endpoint", () => {
    expect(emessageCatalog.endpoints.map(({ id }) => id)).toEqual(["push-sms"]);
  });
});
