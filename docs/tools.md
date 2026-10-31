# Tools

41 tools: 21 are always on, and 20 are off until you set `NOMBA_ENABLE_SENSITIVE_TOOLS=true` (see [security.md](security.md)). The table marks which is which.

Every tool carries MCP annotations (`readOnlyHint`, `destructiveHint`, `openWorldHint`) so clients can ask for confirmation. List and filter tools take paging arguments; check the response for more pages before treating a list as complete.

### Accounts & Terminals (5 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_get_parent_account` | No | Get parent account details (ID, name, type, status, linked banks) | `GET /v1/accounts/parent` |
| `nomba_get_parent_balance` | No | Get current balance of parent account (NGN) | `GET /v1/accounts/parent/balance` |
| `nomba_list_terminals` | No | List all POS terminals assigned to the account | `GET /v1/accounts/terminals` |
| `nomba_assign_terminal` | Yes | Assign a POS terminal by ID and serial number | `POST /v1/terminals/assign` |
| `nomba_unassign_terminal` | Yes | Unassign a POS terminal | `POST /v1/terminals/unassign` |

### Sub-Accounts (7 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_create_sub_account` | Yes | Create a new sub-account with name, optional email/phone | `POST /v1/accounts` |
| `nomba_list_sub_accounts` | No | List all sub-accounts with pagination | `GET /v1/accounts` |
| `nomba_get_sub_account` | No | Get details of a specific sub-account | `GET /v1/accounts/{accountId}` |
| `nomba_get_sub_account_balance` | No | Get current balance of a sub-account | `GET /v1/accounts/{accountId}/balance` |
| `nomba_update_sub_account` | Yes | Update sub-account name, email, or phone | `PUT /v1/accounts/{accountId}` |
| `nomba_suspend_sub_account` | Yes | Suspend a sub-account (blocks all transactions) | `PUT /v1/accounts/{accountId}/suspend` |
| `nomba_reactivate_sub_account` | Yes | Reactivate a previously suspended sub-account | `PUT /v1/accounts/{accountId}/reactivate` |

### Transfers (4 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_list_banks` | No | Fetch all Nigerian bank codes and names | `GET /v1/transfers/banks` |
| `nomba_lookup_bank_account` | No | Validate account number and get holder name (call before transfers) | `POST /v1/transfers/bank-account-lookup` |
| `nomba_transfer_to_bank` | Yes | Transfer funds to an external Nigerian bank account | `POST /v1/transfers/to-banks` |
| `nomba_transfer_between_accounts` | Yes | Transfer funds between Nomba accounts (e.g., parent to sub-account) | `POST /v1/transfers/between-accounts` |

### Online Checkout (5 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_create_checkout_order` | Yes | Create payment link (card, bank transfer, or USSD) | `POST /v1/checkout/order` |
| `nomba_charge_tokenized_card` | Yes | Charge a previously saved card for recurring payments | `POST /v1/checkout/charge-tokenized-card` |
| `nomba_refund_transaction` | Yes | Process full or partial refund for a checkout transaction | `POST /v1/checkout/refund` |
| `nomba_get_checkout_transaction` | No | Get checkout transaction details and status | `GET /v1/checkout/order/{orderReference}` |
| `nomba_cancel_transaction` | Yes | Cancel an incomplete/pending checkout transaction | `POST /v1/checkout/cancel-transaction` |

### Virtual Accounts (5 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_create_virtual_account` | Yes | Create a new virtual bank account | `POST /v1/accounts/virtual` |
| `nomba_get_virtual_account` | No | Get virtual account details and balance | `GET /v1/accounts/virtual/{accountId}` |
| `nomba_update_virtual_account` | Yes | Update account name or callback URL | `PATCH /v1/accounts/virtual/{accountId}` |
| `nomba_expire_virtual_account` | Yes | Permanently deactivate a virtual account | `POST /v1/accounts/virtual/{accountId}/expire` |
| `nomba_list_virtual_accounts` | No | List all virtual accounts with pagination | `GET /v1/accounts/virtual` |

### Transactions (4 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_list_bank_transactions` | No | List transaction history with optional date filtering | `GET /v1/transactions/bank` |
| `nomba_requery_transaction` | No | Check transaction status by session ID | `POST /v1/transactions/accounts` |
| `nomba_get_transaction` | No | Get full details of a single transaction | `GET /v1/transactions/{transactionId}` |
| `nomba_filter_transactions` | No | Filter transactions by type (CREDIT/DEBIT), date range | `GET /v1/transactions/filter` |

### Bills - Electricity (3 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_get_electricity_providers` | No | List available electricity distribution companies | `GET /v1/bills/electricity/providers` |
| `nomba_lookup_electricity_customer` | No | Validate meter number and get customer name | `POST /v1/bills/electricity/customer-lookup` |
| `nomba_buy_electricity` | Yes | Purchase electricity tokens (prepaid) or pay bill (postpaid) | `POST /v1/bills/electricity/pay` |

### Bills - Cable TV (3 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_get_cable_providers` | No | List available cable TV providers (DSTV, GOtv, Startimes) | `GET /v1/bills/cabletv/providers` |
| `nomba_lookup_cable_customer` | No | Validate smartcard/IUC number and get customer name | `POST /v1/bills/cabletv/customer-lookup` |
| `nomba_pay_cable_subscription` | Yes | Pay for a cable TV subscription | `POST /v1/bills/cabletv/pay` |

### Bills - Betting (2 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_get_betting_providers` | No | List available betting platforms | `GET /v1/bills/betting/providers` |
| `nomba_fund_betting_account` | Yes | Fund a customer's betting account | `POST /v1/bills/betting/pay` |

### Airtime & Data (3 tools)

| Tool | Needs `NOMBA_ENABLE_SENSITIVE_TOOLS` | Description | API endpoint |
|------|-------|-------------|----------|
| `nomba_buy_airtime` | Yes | Purchase airtime for a Nigerian phone number (MTN, Airtel, Glo, 9mobile) | `POST /v1/bills/airtime/pay` |
| `nomba_list_data_plans` | No | List available data plans for a network provider | `GET /v1/bills/data/plans` |
| `nomba_buy_data` | Yes | Purchase a data bundle for a phone number | `POST /v1/bills/data/pay` |

## Resource

`nomba://banks` is the Nigerian bank code list, fetched once and cached for 24 hours. Reading it avoids repeat calls to `nomba_list_banks`.

## Example prompts

- "What's my Nomba account balance?"
- "Show me my last 10 transactions."
- "Look up account 0123456789 at Access Bank."
- "List my sub-accounts."
- With sensitive tools on: "Buy 1000 Naira airtime for 08012345678." or "Transfer 5000 Naira to account 0123456789 at GTBank."
