# Nomba MCP

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io) server that connects Claude to the [Nomba](https://nomba.com) banking and payments API. This gives Claude the ability to check account balances, send money, generate payment links, manage virtual accounts, buy airtime, pay utility bills, and more -- all through natural language.

## Table of Contents

- [How It Works](#how-it-works)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
  - [Environment Variables](#environment-variables)
  - [Claude Desktop](#claude-desktop)
  - [Claude Code](#claude-code)
- [Architecture](#architecture)
- [Tools Reference](#tools-reference)
  - [Accounts & Terminals](#accounts--terminals)
  - [Sub-Accounts](#sub-accounts)
  - [Transfers](#transfers)
  - [Online Checkout](#online-checkout)
  - [Virtual Accounts](#virtual-accounts)
  - [Transactions](#transactions)
  - [Bills & Utilities](#bills--utilities)
  - [Airtime & Data](#airtime--data)
- [Resources](#resources)
- [Example Prompts](#example-prompts)
- [Development](#development)
- [Troubleshooting](#troubleshooting)

---

## How It Works

This server acts as a bridge between Claude and the Nomba API. It runs as a local process that communicates with Claude over stdio (standard input/output) using the MCP protocol. When you ask Claude something like "What's my Nomba balance?", Claude calls the appropriate tool on this server, which makes the authenticated API request to Nomba and returns the result.

```
You <-> Claude <-> MCP Server (this project) <-> Nomba API
```

Authentication is handled automatically. The server obtains an OAuth2 access token on the first request and refreshes it transparently before expiry.

## Prerequisites

- **Node.js 18+** (uses native `fetch`)
- **Nomba API credentials** -- obtain these from your [Nomba Developer Dashboard](https://developer.nomba.com):
  - Client ID
  - Client Secret
  - Parent Account ID (UUID)

## Installation

No build step required. Just configure your MCP client with `npx`:

```bash
npx nomba-mcp
```

Or install globally:

```bash
npm install -g nomba-mcp
```

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `NOMBA_CLIENT_ID` | Yes | -- | Your client ID from the Nomba developer dashboard |
| `NOMBA_CLIENT_SECRET` | Yes | -- | Your client secret from the Nomba developer dashboard |
| `NOMBA_ACCOUNT_ID` | Yes | -- | Your parent account ID (UUID format) |
| `NOMBA_BASE_URL` | No | `https://sandbox.nomba.com` | API base URL. Set to `https://api.nomba.com` for production |

> **Important:** The server defaults to the **sandbox** environment. All transactions in sandbox mode use test data and do not move real money. Set `NOMBA_BASE_URL=https://api.nomba.com` only when you are ready to go live.

### Claude Desktop

Add the following to your Claude Desktop configuration file:

- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nomba": {
      "command": "npx",
      "args": ["-y", "nomba-mcp"],
      "env": {
        "NOMBA_CLIENT_ID": "your_client_id",
        "NOMBA_CLIENT_SECRET": "your_client_secret",
        "NOMBA_ACCOUNT_ID": "your_account_id",
        "NOMBA_BASE_URL": "https://api.nomba.com"
      }
    }
  }
}
```

Restart Claude Desktop after saving. The Nomba tools will appear in the tools menu (hammer icon).

### Claude Code

Add a `.mcp.json` file to your project root (or use global settings):

```json
{
  "mcpServers": {
    "nomba": {
      "command": "npx",
      "args": ["-y", "nomba-mcp"],
      "env": {
        "NOMBA_CLIENT_ID": "your_client_id",
        "NOMBA_CLIENT_SECRET": "your_client_secret",
        "NOMBA_ACCOUNT_ID": "your_account_id",
        "NOMBA_BASE_URL": "https://api.nomba.com"
      }
    }
  }
}
```

---

## Architecture

```
src/
├── index.ts              # Entry point: validates env vars, creates server, connects stdio
├── client.ts             # NombaClient: OAuth2 token management + HTTP request wrapper
├── utils.ts              # Shared helpers: jsonResponse, errorResponse, logToolCall, buildParams
├── tools/
│   ├── accounts.ts       # Parent account details, balance, terminals, terminal assign/unassign
│   ├── sub-accounts.ts   # Sub-account CRUD, balance, suspend, reactivate
│   ├── transfers.ts      # Bank list, account lookup, bank/internal transfers
│   ├── checkout.ts       # Payment links, tokenized cards, refunds
│   ├── virtual-accounts.ts  # Virtual account CRUD + listing
│   ├── transactions.ts   # Transaction history, details, filtering, status requery
│   ├── bills/
│   │   ├── index.ts      # Re-exports all bill tool registrations
│   │   ├── electricity.ts  # Electricity providers, meter lookup, token purchase
│   │   ├── betting.ts    # Betting providers, account funding
│   │   └── cable.ts      # Cable TV providers, smartcard lookup, subscription payment
│   └── airtime.ts        # Airtime + data bundles
├── resources/
│   └── bank-list.ts      # Cached bank code list (MCP resource, 24h TTL)
└── **/*.test.ts          # 36 tests (Vitest) — co-located with source files
```

**Key design decisions:**

- **Automatic authentication** -- The `NombaClient` class handles the full OAuth2 lifecycle. Tokens are obtained on the first API call and refreshed 60 seconds before expiry. A promise lock prevents concurrent refresh requests when multiple tools execute in parallel.
- **401 auto-retry** -- If a request fails with a 401, the server clears the stale token, re-authenticates, and retries once. This handles token revocation gracefully without infinite loops.
- **Structured error handling** -- API errors are parsed into `NombaApiError` with status, code, and description. Every tool catches errors and returns them with `isError: true`, so Claude can report the failure and suggest next steps rather than crashing. Raw API bodies are never leaked.
- **Audit logging** -- Every tool invocation is logged to stderr via `logToolCall()` with timestamp, tool name, and parameters (long values are truncated).
- **Tool name prefixing** -- All tools are prefixed with `nomba_` to avoid collisions with other MCP servers that may be running simultaneously.
- **Stdio transport** -- The server communicates over stdin/stdout using JSON-RPC. All logging uses `console.error` to avoid corrupting the protocol stream.

---

## Tools Reference

### Accounts & Terminals

#### `nomba_get_parent_account`

Fetch the parent account details for the authenticated Nomba business.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | -- | -- | No parameters required |

**Returns:** Account ID, name, type, status, BVN, and linked bank accounts.

**API Endpoint:** `GET /v1/accounts/parent`

---

#### `nomba_get_parent_balance`

Fetch the current balance of the parent Nomba business account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | -- | -- | No parameters required |

**Returns:** Available balance in NGN.

**API Endpoint:** `GET /v1/accounts/parent/balance`

---

#### `nomba_list_terminals`

List all POS terminals assigned to the parent Nomba account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | -- | -- | No parameters required |

**Returns:** Terminal IDs, serial numbers, and labels.

**API Endpoint:** `GET /v1/accounts/terminals`

---

#### `nomba_assign_terminal`

Assign a POS terminal to the parent Nomba account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `terminalId` | string | Yes | The terminal ID to assign |
| `serialNumber` | string | Yes | The terminal serial number |

**Returns:** Assignment confirmation.

**API Endpoint:** `POST /v1/terminals/assign`

---

#### `nomba_unassign_terminal`

Unassign a POS terminal from the parent Nomba account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `terminalId` | string | Yes | The terminal ID to unassign |

**Returns:** Unassignment confirmation.

**API Endpoint:** `POST /v1/terminals/unassign`

---

### Sub-Accounts

Sub-accounts are child accounts under your parent Nomba account. They can have their own balances and make transactions independently.

#### `nomba_create_sub_account`

Create a new sub-account under the parent Nomba account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountName` | string | Yes | Name for the sub-account |
| `email` | string | No | Email address for the sub-account holder |
| `phoneNumber` | string | No | Phone number for the sub-account holder |

**Returns:** New sub-account details including account ID.

**API Endpoint:** `POST /v1/accounts`

---

#### `nomba_list_sub_accounts`

List all sub-accounts under the parent Nomba account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Results per page (max 50) |
| `cursor` | string | No | Pagination cursor from a previous response |

**Returns:** Array of sub-accounts with pagination cursor.

**API Endpoint:** `GET /v1/accounts`

---

#### `nomba_get_sub_account`

Fetch details of a specific sub-account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | The sub-account ID |

**Returns:** Sub-account details including name, status, and metadata.

**API Endpoint:** `GET /v1/accounts/{accountId}`

---

#### `nomba_get_sub_account_balance`

Fetch the current balance of a specific sub-account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | The sub-account ID |

**Returns:** Available balance in NGN.

**API Endpoint:** `GET /v1/accounts/{accountId}/balance`

---

#### `nomba_update_sub_account`

Update the details of an existing sub-account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | The sub-account ID to update |
| `accountName` | string | No | New account name |
| `email` | string | No | New email address |
| `phoneNumber` | string | No | New phone number |

**Returns:** Updated sub-account details.

**API Endpoint:** `PUT /v1/accounts/{accountId}`

---

#### `nomba_suspend_sub_account`

Suspend a sub-account. Suspended accounts cannot make or receive transactions.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | The sub-account ID to suspend |

**Returns:** Suspension confirmation.

**API Endpoint:** `PUT /v1/accounts/{accountId}/suspend`

> **Warning:** Suspended accounts are blocked from all transactions until reactivated.

---

#### `nomba_reactivate_sub_account`

Reactivate a previously suspended sub-account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | The sub-account ID to reactivate |

**Returns:** Reactivation confirmation.

**API Endpoint:** `PUT /v1/accounts/{accountId}/reactivate`

---

### Transfers

#### `nomba_list_banks`

Fetch the list of all Nigerian bank codes and names. Call this first to get the correct `bankCode` before making transfers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | -- | -- | No parameters required |

**Returns:** Array of `{ code, name }` objects for all Nigerian banks.

**API Endpoint:** `GET /v1/transfers/banks`

---

#### `nomba_lookup_bank_account`

Validate a bank account by looking up the account holder's name. Always call this before initiating a transfer to confirm the recipient.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountNumber` | string | Yes | 10-digit Nigerian bank account number |
| `bankCode` | string | Yes | Bank code from `nomba_list_banks` |

**Returns:** Account holder name, account number, and bank details.

**API Endpoint:** `POST /v1/transfers/bank-account-lookup`

---

#### `nomba_transfer_to_bank`

Transfer funds from the Nomba account to an external Nigerian bank account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Amount in Naira (must be positive) |
| `accountNumber` | string | Yes | Recipient 10-digit bank account number |
| `bankCode` | string | Yes | Recipient bank code |
| `narration` | string | No | Transfer description/narration |

**Returns:** Transaction ID, status, and transfer details.

**API Endpoint:** `POST /v1/transfers/to-banks`

> **Tip:** Always call `nomba_lookup_bank_account` first to verify the recipient before transferring.

---

#### `nomba_transfer_between_accounts`

Transfer funds between two Nomba accounts (e.g., parent to sub-account).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Amount in Naira (must be positive) |
| `destinationAccountId` | string | Yes | Destination Nomba account ID (UUID) |
| `narration` | string | No | Transfer description/narration |

**Returns:** Transaction ID and transfer status.

**API Endpoint:** `POST /v1/transfers/between-accounts`

---

### Online Checkout

#### `nomba_create_checkout_order`

Create a checkout payment order and get a hosted payment link. The customer can pay via card, bank transfer, or USSD.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Payment amount in Naira |
| `customerEmail` | string | Yes | Customer's email address |
| `callbackUrl` | string | Yes | URL to redirect the customer to after payment |
| `orderReference` | string | No | Your unique order reference/ID |
| `customerId` | string | No | Your internal customer identifier |
| `tokenizeCard` | boolean | No | Save the customer's card for future charges |

**Returns:** A `checkoutLink` URL for the customer and an `orderReference`.

**API Endpoint:** `POST /v1/checkout/order`

---

#### `nomba_charge_tokenized_card`

Charge a previously saved/tokenized card. Use this for recurring payments or returning customers.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `amount` | number | Yes | Amount in Naira to charge |
| `tokenizedCardId` | string | Yes | Tokenized card ID from a previous checkout |
| `customerEmail` | string | Yes | Customer's email address |

**Returns:** Transaction details and charge status.

**API Endpoint:** `POST /v1/checkout/charge-tokenized-card`

---

#### `nomba_refund_transaction`

Process a full or partial refund for a completed checkout transaction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transactionId` | string | Yes | The transaction ID to refund |
| `amount` | number | No | Amount to refund in Naira. Omit for full refund |

**Returns:** Refund confirmation and status.

**API Endpoint:** `POST /v1/checkout/refund`

---

#### `nomba_get_checkout_transaction`

Retrieve the details and status of a checkout transaction.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderReference` | string | Yes | The order reference from checkout creation |

**Returns:** Full transaction details including payment status, amount, and timestamps.

**API Endpoint:** `GET /v1/checkout/order/{orderReference}`

---

#### `nomba_cancel_transaction`

Cancel an incomplete/pending checkout transaction. Only works for transactions that have not been completed.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `orderReference` | string | Yes | The order reference of the transaction to cancel |

**Returns:** Cancellation confirmation.

**API Endpoint:** `POST /v1/checkout/cancel-transaction`

---

### Virtual Accounts

Virtual accounts are temporary or permanent bank accounts created under your parent Nomba account. They are useful for receiving payments from specific customers or for specific purposes.

#### `nomba_create_virtual_account`

Create a new virtual bank account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountName` | string | Yes | Name for the account holder (8-64 characters) |
| `accountRef` | string | No | Your unique reference for this account (16-64 characters) |

**Returns:** Account details including bank name, account number, and account name.

**API Endpoint:** `POST /v1/accounts/virtual`

---

#### `nomba_get_virtual_account`

Fetch details of a specific virtual account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | The virtual account ID (UUID) |

**Returns:** Account name, bank details, status, and balance.

**API Endpoint:** `GET /v1/accounts/virtual/{accountId}`

---

#### `nomba_update_virtual_account`

Update an existing virtual account's details.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | The virtual account ID (UUID) to update |
| `accountName` | string | No | New account name (8-64 characters) |
| `callbackUrl` | string | No | Webhook URL for payment notifications |

**Returns:** Updated account details.

**API Endpoint:** `PATCH /v1/accounts/virtual/{accountId}`

---

#### `nomba_expire_virtual_account`

Expire/deactivate a virtual account so it can no longer receive payments.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `accountId` | string | Yes | The virtual account ID (UUID) to expire |

**Returns:** Expiration confirmation.

**API Endpoint:** `POST /v1/accounts/virtual/{accountId}/expire`

> **Warning:** This action cannot be undone. The account will permanently stop accepting payments.

---

#### `nomba_list_virtual_accounts`

List all virtual accounts under the parent Nomba account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Results per page (max 50) |
| `cursor` | string | No | Pagination cursor from a previous response |

**Returns:** Array of virtual accounts with a pagination cursor for the next page.

**API Endpoint:** `GET /v1/accounts/virtual`

---

### Transactions

#### `nomba_list_bank_transactions`

Fetch bank transaction history for the parent account with optional date filtering and pagination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `limit` | number | No | Results per page (max 50) |
| `cursor` | string | No | Pagination cursor from a previous response |
| `dateFrom` | string | No | Start date in UTC (e.g., `2024-01-01T00:00:00Z`) |
| `dateTo` | string | No | End date in UTC (e.g., `2024-12-31T23:59:59Z`) |

**Returns:** Array of transactions with amounts, types (CREDIT/DEBIT), statuses, wallet balances, and metadata.

**API Endpoint:** `GET /v1/transactions/bank`

---

#### `nomba_requery_transaction`

Check the status of a specific transaction using its session ID. Useful for verifying if a transfer or payment was successful.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sessionId` | string | Yes | The session ID of the transaction |

**Returns:** Transaction status and details.

**API Endpoint:** `POST /v1/transactions/accounts`

---

#### `nomba_get_transaction`

Fetch details of a single transaction by its transaction ID.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `transactionId` | string | Yes | The transaction ID to look up |

**Returns:** Full transaction details including amount, type, status, and metadata.

**API Endpoint:** `GET /v1/transactions/{transactionId}`

---

#### `nomba_filter_transactions`

Filter transactions on the parent account with advanced filters. Supports filtering by type, date range, and pagination.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `type` | string | No | Filter by transaction type: `CREDIT` or `DEBIT` |
| `limit` | number | No | Results per page (max 50) |
| `cursor` | string | No | Pagination cursor from a previous response |
| `dateFrom` | string | No | Start date in UTC (e.g., `2024-01-01T00:00:00Z`) |
| `dateTo` | string | No | End date in UTC (e.g., `2024-12-31T23:59:59Z`) |

**Returns:** Filtered array of transactions with pagination cursor.

**API Endpoint:** `GET /v1/transactions/filter`

---

### Bills & Utilities

#### Electricity

##### `nomba_get_electricity_providers`

Fetch available electricity distribution companies (DisCos).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | -- | -- | No parameters required |

**Returns:** List of providers with codes and names.

**API Endpoint:** `GET /v1/bills/electricity/providers`

---

##### `nomba_lookup_electricity_customer`

Validate an electricity meter number and get the customer's name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `meterNumber` | string | Yes | The electricity meter number |
| `providerCode` | string | Yes | Provider code from `nomba_get_electricity_providers` |
| `meterType` | string | Yes | `"prepaid"` or `"postpaid"` |

**Returns:** Customer name and meter validation details.

**API Endpoint:** `POST /v1/bills/electricity/customer-lookup`

---

##### `nomba_buy_electricity`

Purchase electricity tokens (prepaid) or pay an electricity bill (postpaid).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `meterNumber` | string | Yes | The electricity meter number |
| `providerCode` | string | Yes | Electricity provider code |
| `meterType` | string | Yes | `"prepaid"` or `"postpaid"` |
| `amount` | number | Yes | Amount in Naira |

**Returns:** Purchase confirmation and token details (for prepaid).

**API Endpoint:** `POST /v1/bills/electricity/pay`

> **Tip:** Always call `nomba_lookup_electricity_customer` first to verify the meter details.

---

#### Betting

##### `nomba_get_betting_providers`

Fetch available betting platforms.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | -- | -- | No parameters required |

**Returns:** List of betting providers with codes.

**API Endpoint:** `GET /v1/bills/betting/providers`

---

##### `nomba_fund_betting_account`

Fund a customer's betting account.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `customerId` | string | Yes | Customer's betting account ID/username |
| `providerCode` | string | Yes | Betting provider code |
| `amount` | number | Yes | Amount in Naira |

**Returns:** Funding confirmation and transaction details.

**API Endpoint:** `POST /v1/bills/betting/pay`

---

#### Cable TV

##### `nomba_get_cable_providers`

Fetch available cable TV providers (DSTV, GOtv, Startimes, etc.).

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| *(none)* | -- | -- | No parameters required |

**Returns:** List of cable TV providers with codes.

**API Endpoint:** `GET /v1/bills/cabletv/providers`

---

##### `nomba_lookup_cable_customer`

Validate a cable TV smartcard/IUC number and get the customer's name.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `smartcardNumber` | string | Yes | The smartcard or IUC number |
| `providerCode` | string | Yes | Cable TV provider code |

**Returns:** Customer name and smartcard validation details.

**API Endpoint:** `POST /v1/bills/cabletv/customer-lookup`

---

##### `nomba_pay_cable_subscription`

Pay for a cable TV subscription.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `smartcardNumber` | string | Yes | The smartcard or IUC number |
| `providerCode` | string | Yes | Cable TV provider code |
| `productCode` | string | Yes | Subscription plan/bouquet code |
| `amount` | number | Yes | Amount in Naira |

**Returns:** Payment confirmation and subscription details.

**API Endpoint:** `POST /v1/bills/cabletv/pay`

> **Tip:** Always call `nomba_lookup_cable_customer` first to verify the smartcard number.

---

### Airtime & Data

#### `nomba_buy_airtime`

Purchase airtime/credit for a Nigerian phone number. Supports MTN, Airtel, Glo, and 9mobile.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phoneNumber` | string | Yes | Nigerian phone number (e.g., `08012345678` or `2348012345678`) |
| `amount` | number | Yes | Amount of airtime in Naira |
| `network` | string | No | Network provider (`MTN`, `AIRTEL`, `GLO`, `9MOBILE`). Auto-detected if omitted |

**Returns:** Airtime purchase confirmation.

**API Endpoint:** `POST /v1/bills/airtime/pay`

---

#### `nomba_list_data_plans`

Fetch available data bundle plans for a network provider.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `network` | string | Yes | Network provider (`MTN`, `AIRTEL`, `GLO`, `9MOBILE`) |

**Returns:** List of plans with names, data amounts, prices, and plan codes.

**API Endpoint:** `GET /v1/bills/data/plans`

---

#### `nomba_buy_data`

Purchase a data bundle for a Nigerian phone number.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `phoneNumber` | string | Yes | Nigerian phone number (e.g., `08012345678` or `2348012345678`) |
| `dataPlanCode` | string | Yes | Data plan code from `nomba_list_data_plans` |
| `network` | string | Yes | Network provider (`MTN`, `AIRTEL`, `GLO`, `9MOBILE`) |

**Returns:** Data purchase confirmation.

**API Endpoint:** `POST /v1/bills/data/pay`

> **Tip:** Always call `nomba_list_data_plans` first to get available plans and their codes.

---

## Resources

The server exposes one MCP resource:

### `nomba://banks`

A cached list of all Nigerian bank codes and names in JSON format. This data changes infrequently, so the server fetches it once and caches it in memory for 24 hours before re-fetching.

Clients can read this resource instead of calling the `nomba_list_banks` tool when they need to reference bank codes without making an API call each time.

---

## Example Prompts

Here are example prompts you can use with Claude once the server is connected:

**Account Management:**
- "What's my Nomba account balance?"
- "Show me my account details"
- "List all my POS terminals"

**Sub-Accounts:**
- "Create a sub-account called 'Lagos Branch'"
- "List all my sub-accounts"
- "What's the balance on sub-account abc-123?"
- "Suspend sub-account abc-123"

**Terminals:**
- "Assign terminal TID123 with serial number SN456"
- "Unassign terminal TID123"

**Transfers:**
- "What's the bank code for GTBank?"
- "Look up account 0123456789 at GTBank"
- "Transfer 5000 Naira to account 0123456789 at Access Bank with narration 'Payment for services'"

**Payments:**
- "Create a payment link for 10,000 Naira for customer@email.com"
- "Check the status of order reference ABC123"
- "Refund transaction XYZ456"

**Virtual Accounts:**
- "Create a virtual account named 'John Doe Payments'"
- "List all my virtual accounts"
- "Expire virtual account abc-def-123"

**Transactions:**
- "Show me my last 10 transactions"
- "Show me all credit transactions from January 2024"
- "Get the details of transaction TXN123"
- "Check the status of transaction session ABC123"

**Bills:**
- "List electricity providers"
- "Buy 5000 Naira electricity for meter 12345678 on Ikeja Electric prepaid"
- "List cable TV providers"
- "Pay DSTV subscription for smartcard 10234567890"

**Airtime & Data:**
- "Buy 1000 Naira airtime for 08012345678"
- "What MTN data plans are available?"
- "Buy the 1GB MTN data plan for 08012345678"

---

## Development

```bash
git clone <repo-url>
cd nomba-mcp
npm install
npm run build
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `build/` and make entry point executable |
| `npm run dev` | Watch mode -- recompile on file changes |
| `npm start` | Run the compiled server |
| `npm test` | Run all tests (Vitest) |
| `npm run test:watch` | Run tests in watch mode |
| `npm run lint` | Lint source files (ESLint) |
| `npm run format` | Format source files (Prettier) |
| `npm run type-check` | Type-check without emitting files |

### Testing

The project includes 36 tests covering:

- **`src/utils.test.ts`** -- Utility functions (jsonResponse, errorResponse, buildParams, logToolCall)
- **`src/client.test.ts`** -- OAuth2 token lifecycle, 401 auto-retry, error parsing, HTTP methods
- **`src/tools/tools.test.ts`** -- Representative tool handler tests, registration counts, cache TTL

```bash
npm test
```

### CI

GitHub Actions runs lint, type-check, tests, and build on every push/PR across Node 18, 20, and 22.

### Testing with MCP Inspector

The [MCP Inspector](https://github.com/modelcontextprotocol/inspector) provides a browser-based UI for testing tools interactively:

```bash
NOMBA_CLIENT_ID=your_id \
NOMBA_CLIENT_SECRET=your_secret \
NOMBA_ACCOUNT_ID=your_account_id \
npx @modelcontextprotocol/inspector node build/index.js
```

This opens a browser where you can see all registered tools, invoke them with parameters, and inspect the responses.

### Adding New Tools

1. Create or edit a file in `src/tools/`
2. Follow the existing pattern using `server.registerTool()`
3. Import and call the registration function in `src/index.ts`
4. Run `npm run build` to compile

---

## Troubleshooting

### "Missing required environment variables"

The server exits with this message if `NOMBA_CLIENT_ID`, `NOMBA_CLIENT_SECRET`, or `NOMBA_ACCOUNT_ID` are not set. Make sure they are configured in your Claude Desktop/Code MCP server config under the `env` key.

### "Token issue failed (401)"

Your client credentials are invalid. Verify your `NOMBA_CLIENT_ID` and `NOMBA_CLIENT_SECRET` on the [Nomba Developer Dashboard](https://developer.nomba.com). Also ensure your `NOMBA_ACCOUNT_ID` matches the parent account associated with those credentials.

### "Token issue failed (403)"

Your account may not have the required permissions. Check your Nomba dashboard for API access settings.

### Tools not appearing in Claude

- **Claude Desktop:** Restart the application after updating `claude_desktop_config.json`
- **Claude Code:** Restart the MCP server or reload your settings
- Verify your config uses `"command": "npx"` with `"args": ["-y", "nomba-mcp"]`

### "Nomba API ... failed (429)"

You've hit the rate limit. The Nomba API uses a fixed-window rate limit strategy (default 75 requests/second). Wait a moment and retry.

### Sandbox vs Production

The server defaults to the sandbox environment (`https://sandbox.nomba.com`). Sandbox transactions use test data and do not affect real accounts or move real money. To switch to production:

```json
"NOMBA_BASE_URL": "https://api.nomba.com"
```

---

## License

[MIT](LICENSE)
