# Changelog

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
- Published as `@nomba-inc/mcp-server` on npm
