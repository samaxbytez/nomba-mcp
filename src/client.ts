import { TOKEN_BUFFER_MS } from "./utils.js";

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
  private tokenPromise: Promise<void> | null = null;

  constructor(config: NombaClientConfig) {
    this.config = config;

    if (!config.baseUrl.startsWith("https://")) {
      console.error(
        "WARNING: NOMBA_BASE_URL does not use HTTPS. Credentials may be exposed in transit."
      );
    }
  }

  private async issueToken(): Promise<void> {
    const url = `${this.config.baseUrl}/v1/auth/token/issue`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        accountId: this.config.accountId,
      },
      body: JSON.stringify({
        grant_type: "client_credentials",
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      // Never expose credentials in error messages
      throw parseApiError(response.status, errorBody);
    }

    const result = (await response.json()) as NombaApiResponse<TokenResponse>;
    this.tokenData = {
      accessToken: result.data.access_token,
      refreshToken: result.data.refresh_token,
      expiresAt: new Date(result.data.expiresAt),
    };
  }

  private async ensureToken(): Promise<string> {
    if (
      this.tokenData &&
      this.tokenData.expiresAt >= new Date(Date.now() + TOKEN_BUFFER_MS)
    ) {
      return this.tokenData.accessToken;
    }

    if (!this.tokenPromise) {
      this.tokenPromise = this.issueToken().finally(() => {
        this.tokenPromise = null;
      });
    }
    await this.tokenPromise;
    return this.tokenData!.accessToken;
  }

  async request<T = unknown>(
    method: string,
    path: string,
    body?: unknown,
    params?: Record<string, string>,
    _retry = false
  ): Promise<T> {
    const token = await this.ensureToken();
    const url = new URL(path, this.config.baseUrl);

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
    });

    if (!response.ok) {
      // On 401, clear token and retry once
      if (response.status === 401 && !_retry) {
        this.tokenData = null;
        return this.request<T>(method, path, body, params, true);
      }

      const errorBody = await response.text();
      throw parseApiError(response.status, errorBody);
    }

    const json = await response.json();
    if (json == null) {
      throw new NombaApiError(response.status, "EMPTY_RESPONSE", "API returned empty response");
    }
    return json as T;
  }

  async get<T = unknown>(
    path: string,
    params?: Record<string, string>
  ): Promise<T> {
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
