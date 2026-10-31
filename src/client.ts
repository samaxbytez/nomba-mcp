import { TOKEN_BUFFER_MS, REQUEST_TIMEOUT_MS } from "./utils.js";

interface NombaClientConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  accountId: string;
}

interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}

interface NombaApiResponse<T> {
  code: string;
  description: string;
  data: T;
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expiresAt: string;
}

export class NombaApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly description: string;

  constructor(status: number, code: string, description: string) {
    super(`Nomba API error (${status}): ${code} - ${description}`);
    this.name = "NombaApiError";
    this.status = status;
    this.code = code;
    this.description = description;
  }
}

function parseApiError(status: number, body: string): NombaApiError {
  try {
    const parsed = JSON.parse(body);
    const code = parsed?.code ?? "UNKNOWN";
    const description = parsed?.description ?? parsed?.message ?? "Unknown error";
    return new NombaApiError(status, code, description);
  } catch {
    // Don't expose raw body — it may contain echoed credentials
    return new NombaApiError(status, "UNKNOWN", `HTTP ${status} error`);
  }
}

export class NombaClient {
  private config: NombaClientConfig;
  private tokenData: TokenData | null = null;
  private tokenPromise: Promise<string> | null = null;

  constructor(config: NombaClientConfig) {
    this.config = config;

    if (!config.baseUrl.startsWith("https://")) {
      if (process.env.NOMBA_ALLOW_INSECURE === "true") {
        console.error("WARNING: NOMBA_ALLOW_INSECURE=true — using non-HTTPS base URL.");
      } else {
        throw new Error(
          "NOMBA_BASE_URL must use HTTPS. Set NOMBA_ALLOW_INSECURE=true to override for local development."
        );
      }
    }
  }

  // Only relative API paths may be requested, and the resolved URL must stay on
  // the configured origin and under its base path (the regex alone misses %2e%2e/).
  private resolveUrl(path: string): URL {
    if (
      !path.startsWith("/") ||
      path.startsWith("//") ||
      path.includes("\\") ||
      path.includes("../") ||
      /%2e|%2f|%5c/i.test(path)
    ) {
      throw new Error("Invalid API path");
    }
    const base = new URL(this.config.baseUrl);
    const url = new URL(path, base);
    const basePath = base.pathname.replace(/\/$/, "");
    if (url.origin !== base.origin || !(url.pathname + "/").startsWith(basePath + "/")) {
      throw new Error("Invalid API path");
    }
    return url;
  }

  private async fetchToken(path: string, body: Record<string, string>): Promise<TokenData> {
    const response = await fetch(`${this.config.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accountId: this.config.accountId,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error",
    });

    if (!response.ok) {
      // Never expose credentials in error messages
      throw parseApiError(response.status, await response.text());
    }

    const data = ((await response.json()) as NombaApiResponse<TokenResponse> | null)?.data;
    const expiresAt = new Date(data?.expiresAt ?? NaN);
    if (!data?.access_token || Number.isNaN(expiresAt.getTime())) {
      throw new NombaApiError(response.status, "BAD_TOKEN_RESPONSE", "Token response was missing fields");
    }
    return { accessToken: data.access_token, refreshToken: data.refresh_token, expiresAt };
  }

  private issueToken(): Promise<TokenData> {
    return this.fetchToken("/v1/auth/token/issue", {
      grant_type: "client_credentials",
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
    });
  }

  private async renewToken(): Promise<TokenData> {
    const refresh = this.tokenData?.refreshToken;
    if (refresh) {
      try {
        return await this.fetchToken("/v1/auth/token/refresh", {
          grant_type: "refresh_token",
          refresh_token: refresh,
        });
      } catch {
        // fall through to a fresh token
      }
    }
    return this.issueToken();
  }

  private async ensureToken(): Promise<string> {
    if (
      this.tokenData &&
      this.tokenData.expiresAt >= new Date(Date.now() + TOKEN_BUFFER_MS)
    ) {
      return this.tokenData.accessToken;
    }

    // One renewal at a time; every waiter gets the token from the promise itself,
    // so a concurrent 401 clearing this.tokenData can't leave them with null.
    this.tokenPromise ??= this.renewToken()
      .then((data) => {
        this.tokenData = data;
        return data.accessToken;
      })
      .finally(() => {
        this.tokenPromise = null;
      });
    return this.tokenPromise;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
    _retry = false
  ): Promise<T> {
    const token = await this.ensureToken();
    const url = this.resolveUrl(path);

    if (params) {
      for (const [k, v] of Object.entries(params)) {
        url.searchParams.set(k, v);
      }
    }

    const response = await fetch(url.toString(), {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        accountId: this.config.accountId,
        "Content-Type": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      redirect: "error",
    });

    if (!response.ok) {
      // On 401, clear token and retry once
      if (response.status === 401 && !_retry) {
        // Only drop the token that was rejected, not a newer one another request fetched.
        if (this.tokenData?.accessToken === token) this.tokenData = null;
        return this.request<T>(method, path, body, params, true);
      }

      if (response.status === 429) {
        const retryAfter = response.headers?.get("retry-after");
        throw new NombaApiError(
          429,
          "RATE_LIMITED",
          retryAfter ? `Rate limited, retry after ${retryAfter}s` : "Rate limited"
        );
      }

      const errorBody = await response.text();
      throw parseApiError(response.status, errorBody);
    }

    const json = await response.json();
    if (json == null) {
      throw new NombaApiError(
        response.status,
        "EMPTY_RESPONSE",
        "API returned empty response"
      );
    }
    return json as T;
  }

  async get<T = unknown>(path: string, params?: Record<string, string>): Promise<T> {
    return this.request<T>("GET", path, undefined, params);
  }

  async post<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("POST", path, body);
  }

  async put<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PUT", path, body);
  }

  async patch<T = unknown>(path: string, body: unknown): Promise<T> {
    return this.request<T>("PATCH", path, body);
  }
}
