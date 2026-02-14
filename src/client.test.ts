import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NombaClient, NombaApiError } from "./client.js";

const BASE_CONFIG = {
  baseUrl: "https://sandbox.nomba.com",
  clientId: "test-client-id",
  clientSecret: "test-secret",
  accountId: "test-account-id",
};

function tokenResponse(expiresAt?: string) {
  return {
    code: "00",
    description: "success",
    data: {
      access_token: "test-token-123",
      refresh_token: "refresh-456",
      expiresAt: expiresAt ?? new Date(Date.now() + 3600_000).toISOString(),
    },
  };
}

function mockOk(body: unknown): Response {
  return {
    ok: true,
    status: 200,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as Response;
}

function mockError(status: number, body: unknown): Response {
  return {
    ok: false,
    status,
    json: async () => body,
    text: async () =>
      typeof body === "string" ? body : JSON.stringify(body),
  } as Response;
}

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockFetch = vi.fn();
  vi.stubGlobal("fetch", mockFetch);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function createClient(overrides?: Partial<typeof BASE_CONFIG>) {
  return new NombaClient({ ...BASE_CONFIG, ...overrides });
}

describe("NombaClient - token management", () => {
  it("issues token on first request", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse())) // token issue
      .mockResolvedValueOnce(mockOk({ data: "result" })); // API call

    const client = createClient();
    await client.get("/v1/accounts/parent");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    // First call is token issue
    const tokenCall = mockFetch.mock.calls[0];
    expect(tokenCall[0]).toBe("https://sandbox.nomba.com/v1/auth/token/issue");
  });

  it("reuses token within expiry window", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse())) // token
      .mockResolvedValueOnce(mockOk({ data: "r1" })) // call 1
      .mockResolvedValueOnce(mockOk({ data: "r2" })); // call 2

    const client = createClient();
    await client.get("/v1/test1");
    await client.get("/v1/test2");

    // Only 1 token issue call + 2 API calls = 3 total
    expect(mockFetch).toHaveBeenCalledTimes(3);
  });

  it("refreshes token when expired", async () => {
    // Token that expires in 30s (within 60s buffer)
    const soonExpiry = new Date(Date.now() + 30_000).toISOString();
    const laterExpiry = new Date(Date.now() + 3600_000).toISOString();

    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse(soonExpiry))) // 1st token
      .mockResolvedValueOnce(mockOk({ data: "r1" })) // 1st API call
      .mockResolvedValueOnce(mockOk(tokenResponse(laterExpiry))) // 2nd token
      .mockResolvedValueOnce(mockOk({ data: "r2" })); // 2nd API call

    const client = createClient();
    await client.get("/v1/test1");
    await client.get("/v1/test2"); // should trigger new token

    // 2 token issues + 2 API calls = 4
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it("concurrent requests share single token promise", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse())) // 1 token issue
      .mockResolvedValueOnce(mockOk({ data: "r1" }))
      .mockResolvedValueOnce(mockOk({ data: "r2" }))
      .mockResolvedValueOnce(mockOk({ data: "r3" }));

    const client = createClient();
    await Promise.all([
      client.get("/v1/a"),
      client.get("/v1/b"),
      client.get("/v1/c"),
    ]);

    // 1 token + 3 calls = 4 total (not 3 tokens + 3 calls)
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });
});

describe("NombaClient - 401 retry", () => {
  it("retries once on 401", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse())) // 1st token
      .mockResolvedValueOnce(mockError(401, { code: "UNAUTHORIZED" })) // 401
      .mockResolvedValueOnce(mockOk(tokenResponse())) // 2nd token (retry)
      .mockResolvedValueOnce(mockOk({ data: "success" })); // retry succeeds

    const client = createClient();
    const result = await client.get("/v1/test");
    expect(result).toEqual({ data: "success" });
  });

  it("throws on double 401 (no infinite loop)", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse())) // 1st token
      .mockResolvedValueOnce(mockError(401, { code: "UNAUTHORIZED" })) // 401
      .mockResolvedValueOnce(mockOk(tokenResponse())) // 2nd token
      .mockResolvedValueOnce(
        mockError(401, { code: "UNAUTHORIZED", description: "still bad" })
      ); // 401 again

    const client = createClient();
    await expect(client.get("/v1/test")).rejects.toThrow(NombaApiError);
  });
});

describe("NombaClient - error handling", () => {
  it("throws NombaApiError with parsed code/description", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse()))
      .mockResolvedValueOnce(
        mockError(400, { code: "INVALID_PARAM", description: "bad request" })
      );

    const client = createClient();
    try {
      await client.get("/v1/test");
      expect.fail("should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(NombaApiError);
      const err = e as NombaApiError;
      expect(err.status).toBe(400);
      expect(err.code).toBe("INVALID_PARAM");
      expect(err.description).toBe("bad request");
    }
  });

  it("returns safe fallback for malformed error body", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse()))
      .mockResolvedValueOnce(mockError(500, "not json at all!!!"));

    const client = createClient();
    try {
      await client.get("/v1/test");
      expect.fail("should have thrown");
    } catch (e) {
      const err = e as NombaApiError;
      expect(err.code).toBe("UNKNOWN");
      expect(err.description).toBe("HTTP 500 error");
      // Must NOT contain the raw body
      expect(err.message).not.toContain("not json at all");
    }
  });

  it("throws EMPTY_RESPONSE on null JSON", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse()))
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => null,
        text: async () => "null",
      } as Response);

    const client = createClient();
    await expect(client.get("/v1/test")).rejects.toThrow("EMPTY_RESPONSE");
  });

  it("throws NombaApiError on token issue failure", async () => {
    mockFetch.mockResolvedValueOnce(
      mockError(403, { code: "FORBIDDEN", description: "bad credentials" })
    );

    const client = createClient();
    await expect(client.get("/v1/test")).rejects.toThrow(NombaApiError);
  });
});

describe("NombaClient - HTTP methods", () => {
  it("get() sends correct method, headers, and query params", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse()))
      .mockResolvedValueOnce(mockOk({ data: "ok" }));

    const client = createClient();
    await client.get("/v1/test", { foo: "bar", limit: "10" });

    const apiCall = mockFetch.mock.calls[1];
    const url = apiCall[0] as string;
    const opts = apiCall[1] as RequestInit;

    expect(url).toContain("/v1/test");
    expect(url).toContain("foo=bar");
    expect(url).toContain("limit=10");
    expect(opts.method).toBe("GET");
    expect((opts.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-token-123"
    );
    expect((opts.headers as Record<string, string>).accountId).toBe(
      "test-account-id"
    );
    expect(opts.body).toBeUndefined();
  });

  it("post() sends JSON body", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse()))
      .mockResolvedValueOnce(mockOk({ data: "ok" }));

    const client = createClient();
    await client.post("/v1/test", { amount: 100 });

    const opts = mockFetch.mock.calls[1][1] as RequestInit;
    expect(opts.method).toBe("POST");
    expect(opts.body).toBe('{"amount":100}');
  });

  it("patch() sends PATCH method", async () => {
    mockFetch
      .mockResolvedValueOnce(mockOk(tokenResponse()))
      .mockResolvedValueOnce(mockOk({ data: "ok" }));

    const client = createClient();
    await client.patch("/v1/test", { name: "new" });

    const opts = mockFetch.mock.calls[1][1] as RequestInit;
    expect(opts.method).toBe("PATCH");
  });
});

describe("NombaClient - HTTPS warning", () => {
  it("warns on non-HTTPS baseUrl", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createClient({ baseUrl: "http://localhost:3000" });
    expect(spy).toHaveBeenCalledWith(
      expect.stringContaining("HTTPS")
    );
    spy.mockRestore();
  });

  it("does not warn on HTTPS baseUrl", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    createClient({ baseUrl: "https://sandbox.nomba.com" });
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });
});
