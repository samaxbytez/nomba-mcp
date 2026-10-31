# nomba-mcp

MCP server (TypeScript, stdio) over the Nomba payments API. Threat model: indirect prompt injection, so treat every tool argument as attacker-controlled. Detail: `docs/security.md`, `docs/development.md`.

## Rules
- Conventional commits; main squash-merges, so the PR title becomes the commit. Stage files by name.
- Never push to main. Branch and open a PR. Merge only when Sam says so.
- No AI attribution in commits, PRs or code comments.
- Public repo: don't name private Nomba repos.

## Before pushing
`npm run lint && npm run type-check && npm test && npm run build && npm run smoke && node scripts/attack.mjs`

## Safety invariants
- Money-moving and account-changing tools go in `SENSITIVE_TOOLS` (`src/policy.ts`) and stay unregistered unless `NOMBA_ENABLE_SENSITIVE_TOOLS=true`. Update `SENSITIVE_COUNT` in `scripts/smoke.mjs` and `docs/tools.md` with it.
- IDs in request paths use `safeId`. All requests go through `NombaClient` (relative paths only, no redirects, 30s timeout).
- Never log or return credentials. Runtime dependencies stay empty (SDK and zod are bundled).
