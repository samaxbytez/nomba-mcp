# Changelog

## [Unreleased]

Aligns every tool with the official API reference (https://developer.nomba.com/nomba-api-reference/introduction). Before this, many tools called endpoints or sent bodies that don't match the docs.

### Fixed
- **Endpoint paths**: balance (`/v1/accounts/balance`), bank lookup (`/v1/transfers/bank/lookup`), requery (`GET /v1/transactions/requery/{sessionId}`), single transaction (`/v1/transactions/accounts/single`), filter (`POST /v1/transactions/accounts`), tokenized card charge (`/v1/checkout/tokenized-card-payment`), checkout status (`/v1/checkout/transaction`), cancel order (`/v1/checkout/order/cancel`), virtual account update (`PUT`), expire (`DELETE`) and list (`POST /v1/accounts/virtual/list`), all bills under `/v1/bill/*` and `/v2/bill/*`
- **Transfers** use `/v2/transfers/bank` and `/v2/transfers/wallet` and send the required `accountName`, `merchantTxRef` and `receiverAccountId`
- **Outflows** (transfers, airtime, data, bills) always send a `merchantTxRef` (generated if not given) and return it with the result
- **Request bodies** match the documented field names: terminals use `serialNumber`; electricity uses `disco`/`customerId`; cable uses `cableTvType`/`customerId`; betting uses `bettingProvider`; data uses `productId`; tokenized charges use `tokenKey` inside an `order`
- `nomba_filter_transactions` filters by the documented status/type/source enums (the old CREDIT/DEBIT filter didn't exist)

### Added
- `nomba_list_cable_plans`, `nomba_lookup_betting_customer`, `nomba_list_sub_account_terminals`
- Pagination on `nomba_list_terminals`; filters on `nomba_list_virtual_accounts`; `expectedAmount` on virtual account create/update
- `NombaClient.delete()`, plus query params on `post()`
- Contract test pinning every tool to its documented method and path (`src/tools/endpoints.test.ts`)

### Changed (breaking)
- `nomba_buy_airtime` and `nomba_buy_data` now require `network`; `nomba_buy_data` requires `amount` (the plan price) so the spending guard can check it
- `nomba_transfer_to_bank` requires `accountName` (from `nomba_lookup_bank_account`)
- `nomba_charge_tokenized_card` requires `callbackUrl`
- Virtual account tools take `identifier` (accountRef or account number) instead of `accountId`; `callbackUrl` removed from update (not supported by the API)
- `nomba_get_sub_account` takes `accountRef` instead of `accountId`
- `nomba_assign_terminal` / `nomba_unassign_terminal` take `serialNumber` (and optional `terminalLabel`) instead of `terminalId`
- Cable and electricity lookups no longer take `meterType`/`productCode`; amounts are whole Naira

### Removed
- `nomba_create_sub_account`, `nomba_list_sub_accounts`, `nomba_update_sub_account`, `nomba_suspend_sub_account`, `nomba_reactivate_sub_account`: not in the public API (the docs say sub-accounts are created and managed from the dashboard)

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
