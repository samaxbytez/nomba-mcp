# Security

## Threat model

The risk is **indirect prompt injection**. Text that Nomba returns (transaction narrations, account names, references, customer names) can be written by third parties. If an assistant reads it, an attacker could try to make the assistant pay someone. So every tool argument is treated as attacker-controlled, and the tools that move money are off unless you turn them on.

## What protects you

- **Money tools are off by default.** Transfers, airtime, data, electricity, cable, betting, refunds, card charges, checkout orders, sub-account and virtual-account changes, and terminal assignment (20 tools, listed in [tools.md](tools.md)) are not registered unless `NOMBA_ENABLE_SENSITIVE_TOOLS=true`. With it off, the assistant has no tool that can send money.
- **Spending limits.** Once money tools are enabled, a per-transaction maximum, a session cap and duplicate detection (same amount and recipient within 60 seconds) apply to transfers, airtime, bills, betting, card charges and refunds. The amount is reserved before the call, so parallel calls can't slip past the cap, and it stays counted after a timeout or 5xx because the money may have moved. Data bundles and full refunds have no known price, so they are limited by count (`NOMBA_MAX_UNPRICED_PURCHASES`).
- **Recipient allowlist.** Set `NOMBA_ALLOWED_RECIPIENTS` and transfers can only go to the accounts you list, however the request is phrased. Unset, any recipient is allowed.
- **Callback hosts.** Set `NOMBA_ALLOWED_CALLBACK_HOSTS` so injected text can't redirect payment notifications or customers to an attacker's URL.
- **Annotations.** Tools declare `readOnlyHint`, `destructiveHint` and `openWorldHint`, so clients can ask you to confirm. Whether a client enforces this is up to the client.
- **Request confinement.** Paths must be relative, can't contain `../` or encoded dots, and must resolve under the configured API origin and base path. IDs in paths accept only letters, digits, `_` and `-`.
- **No redirects.** The client never follows a redirect, so a hostile response can't send your account ID or credentials to another host.
- **Timeouts.** Every request times out after 30 seconds.
- **Redaction.** BVN, account numbers and card tokens are masked in responses and logs. Credentials are not logged or echoed in errors. Non-JSON error bodies are never passed on.
- **HTTPS and production opt-in.** A non-HTTPS URL or the production API needs an explicit override.
- **No runtime dependencies.** The published package is one bundled file, with licences in `build/THIRD_PARTY_LICENSES.txt`.

## Testing

`scripts/attack.mjs` runs the built server over MCP stdio against a fake API and an "evil" listener, firing hostile values (traversal, encoded dots, absolute URLs, CRLF, NUL, 5 KB strings, `__proto__` keys) at every string argument. It checks that every request stays under the base path, no headers or query keys are injected, nothing reaches the evil host even when the API redirects there, and no money-moving request can be produced with sensitive tools off. It runs in CI.

## What this does not cover

- The recipient allowlist is optional. Without it, injected text could send money to any account up to your limits, so set it or keep limits low and confirm every transfer in your client. It covers transfers only, not airtime, bills or betting.
- The caps live in the server process and reset on restart; they are best-effort protection, not a hard boundary.
- Tool responses still pass names and account details into the model's context; redaction covers BVN, account numbers and card tokens only.
- Enabling sensitive tools means an assistant can spend up to your limits. Prompt injection can't be ruled out, so keep the limits low, confirm each action in your client, and use sandbox credentials while testing.
- The harness uses a fake API. It has not been run against Nomba's live behaviour.
- Anyone who can read your MCP config can read your client secret. Use user-level config or a password prompt.

## Reporting a vulnerability

Open a private security advisory on the GitHub repository rather than a public issue.
