# Configuration

All settings are environment variables set in your MCP client's `env` block.

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NOMBA_CLIENT_ID` | Yes | none | Client ID from the Nomba developer dashboard |
| `NOMBA_CLIENT_SECRET` | Yes | none | Client secret from the dashboard |
| `NOMBA_ACCOUNT_ID` | Yes | none | Parent account ID (UUID) |
| `NOMBA_BASE_URL` | No | `https://sandbox.nomba.com` | API base URL. `https://api.nomba.com` is production |
| `NOMBA_ENABLE_SENSITIVE_TOOLS` | No | off | `true` registers the 20 money-moving and account-changing tools. See [tools.md](tools.md) |
| `NOMBA_MAX_TRANSACTION` | No | `100000` | Largest single amount (NGN) a tool accepts |
| `NOMBA_SESSION_SPENDING_CAP` | No | `500000` | Total NGN the server will spend in one session |
| `NOMBA_MAX_UNPRICED_PURCHASES` | No | `10` | Data bundles and full refunds have no known price, so they are limited by count per session |
| `NOMBA_ALLOWED_CALLBACK_HOSTS` | No | none | Comma-separated hosts (and their subdomains) that callback URLs may use. Unset means any HTTPS host. Set it before enabling sensitive tools |
| `NOMBA_ALLOWED_RECIPIENTS` | No | none | Comma-separated recipients transfers may go to: `bankCode:accountNumber` for bank transfers (for example `058:0123456789`) and a Nomba account ID for internal transfers. Unset means any recipient. Set it before enabling sensitive tools |
| `NOMBA_PRODUCTION_CONFIRMED` | No | none | Must be `true` when the base URL is `api.nomba.com` |
| `NOMBA_ALLOW_INSECURE` | No | none | `true` allows a non-HTTPS base URL (local fake API only) |

Limits must be positive numbers; a zero, negative or non-numeric value stops the server at start rather than falling back to the default. The base URL host must be `sandbox.nomba.com` or `api.nomba.com` (case-insensitive) unless `NOMBA_ALLOW_INSECURE=true`.

Sandbox and production use different credentials. The server uses whichever base URL you set, so keep one config per environment rather than switching the URL under the same credentials.
