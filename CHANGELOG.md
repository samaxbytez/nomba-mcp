# Changelog

## [2.0.0] - 2026-10-31

### Breaking

- **Money-moving and account-changing tools are off by default.** Transfers, airtime, data, electricity, cable, betting, refunds, card charges, checkout orders, sub-account and virtual-account changes and terminal assignment (20 tools) are only available when you set `NOMBA_ENABLE_SENSITIVE_TOOLS=true`. Text from Nomba (narrations, account names) can be written by third parties, so an injected instruction could otherwise get an assistant to pay someone. 21 read-only tools stay on.
- **Node 24 or later** is required.
- **Stricter start-up checks:** a zero, negative or non-numeric `NOMBA_MAX_TRANSACTION` or `NOMBA_SESSION_SPENDING_CAP` now stops the server instead of silently using the default, and the base URL host must be `sandbox.nomba.com` or `api.nomba.com` unless `NOMBA_ALLOW_INSECURE=true`.

### Security

- Redirects from the API are never followed, so a hostile response can't send your account ID or credentials to another host.
- Request paths are confined to the API origin and base path (absolute URLs, `../` and encoded dots are rejected).
- The spending guard now reserves an amount before the call, so parallel calls can't bypass the session cap, and keeps it after a timeout. Refunds are guarded and capped; data bundles and full refunds are limited by count (`NOMBA_MAX_UNPRICED_PURCHASES`).
- Optional `NOMBA_ALLOWED_RECIPIENTS` restricts transfers to listed accounts, and `NOMBA_ALLOWED_CALLBACK_HOSTS` restricts callback URLs.
- Card token IDs are masked in transaction responses.
- The package is a single bundled file with no runtime dependencies; licences ship in `build/THIRD_PARTY_LICENSES.txt`.

### Added

- Tool annotations: destructive and open-world hints on money-moving tools.
- `scripts/smoke.mjs` and `scripts/attack.mjs` (hostile-input test against a fake API), run in CI.
- Documentation in `docs/`, setup for Claude Code, Cursor, VS Code, Windsurf, Codex CLI and Gemini CLI, and `AGENTS.md`.
- Dependabot for npm and GitHub Actions.

### Fixed

- Concurrent token renewal could leave a request without a token, and a malformed token response is now reported clearly.
- Creating a payment link no longer uses up the outbound spending cap.
- Duplicate-payment detection now includes the bank or provider and treats `234…` and `0…` phone numbers as the same.
- The server reports its real version; 429 responses report Retry-After.

### Changed

- Tool results are compact JSON.
- SDK 1.32.2, zod 4.

## [1.2.0] - 2026-02-14

### Added
- **Tests**: 36 tests using Vitest covering client auth/retry, utils, and tool handlers
- **Linting**: ESLint + Prettier configuration for code consistency
- **CI**: GitHub Actions workflow running lint, type-check, tests, and build on Node 18/20/22
- **Sub-account management**: 7 new tools (`nomba_create_sub_account`, `nomba_list_sub_accounts`, `nomba_get_sub_account`, `nomba_get_sub_account_balance`, `nomba_update_sub_account`, `nomba_suspend_sub_account`, `nomba_reactivate_sub_account`)
- **Terminal management**: 2 new tools (`nomba_assign_terminal`, `nomba_unassign_terminal`)
- **Transaction tools**: 2 new tools (`nomba_get_transaction`, `nomba_filter_transactions`)
- `CHANGELOG.md` and `LICENSE` files
- `put()` method on `NombaClient`

## [1.1.0] - 2026-02-14

### Added
- `NombaApiError` class with structured error info (status, code, description)
- 401 auto-retry: clears stale token and retries once on authentication failure
- HTTPS warning on non-HTTPS base URLs
- Production API warning when using `api.nomba.com`
- Audit logging via `logToolCall()` on every tool invocation
- 24-hour cache TTL on bank list resource (was infinite)
- Shared utility helpers: `jsonResponse()`, `errorResponse()`, `buildParams()`

### Fixed
- Token expiry race condition (`>` changed to `>=`)
- Error responses no longer leak raw API bodies or credentials

### Changed
- Split `bills.ts` into `bills/electricity.ts`, `bills/betting.ts`, `bills/cable.ts`
- All tool handlers use shared helpers for consistent error handling
- Fixed `list_terminals` description (removed false "Supports pagination" claim)

## [1.0.0] - 2026-02-13

### Added
- Initial release
- 30 MCP tools covering: accounts, transfers, checkout, virtual accounts, transactions, bills (electricity, betting, cable TV), airtime, and data
- Bank list resource with caching
- OAuth2 client credentials authentication with token refresh
- Published as `nomba-mcp` on npm
