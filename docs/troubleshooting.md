# Troubleshooting

## A tool I expect isn't there

Money-moving tools are off by default. Set `NOMBA_ENABLE_SENSITIVE_TOOLS=true` and restart your client. Otherwise, restart the client after any config change and check the command is `npx` with args `["-y", "nomba-mcp"]`.

## "Missing required environment variables"

Set `NOMBA_CLIENT_ID`, `NOMBA_CLIENT_SECRET` and `NOMBA_ACCOUNT_ID` in the `env` block of the server config.

## "NOMBA_BASE_URL must use HTTPS"

Use an `https://` URL. `NOMBA_ALLOW_INSECURE=true` is for a local fake API only.

## "Base URL points to production"

Set `NOMBA_PRODUCTION_CONFIRMED=true` if you mean to use `api.nomba.com`.

## 401 on token issue

The client ID or secret is wrong, or you're using sandbox credentials against production (or the reverse). Check them in the Nomba dashboard.

## 403 on token issue

The account may lack the API permissions for that client. Check access in the dashboard.

## "Rate limited, retry after N s"

Nomba returned 429. Wait the number of seconds shown and retry.

## "Invalid API path"

A tool argument tried to change the request path (for example `../` or an encoded dot). Use the plain ID returned by Nomba.

## "Amount exceeds per-transaction limit" / "session spending cap"

Raise `NOMBA_MAX_TRANSACTION` or `NOMBA_SESSION_SPENDING_CAP`, or restart the server to reset the session total.

## The server won't start

It needs Node 24 or later: run `node --version`.
