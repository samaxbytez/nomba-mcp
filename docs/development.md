# Development

Requires Node 24 or later.

```bash
git clone https://github.com/samaxbytez/nomba-mcp.git
cd nomba-mcp
npm ci --ignore-scripts
```

| Command | What it does |
|---------|--------------|
| `npm run build` | Bundle `src/index.ts` into `build/index.js` with esbuild (the SDK and zod are bundled in) |
| `npm test` | Unit tests (vitest) |
| `npm run lint` / `npm run type-check` | ESLint / `tsc --noEmit` |
| `npm run smoke` | Start the built server over MCP and check version, tool count, annotations, gating and zero runtime dependencies |
| `node scripts/attack.mjs` | Hostile-input run against a fake API (see [security.md](security.md)) |

Run lint, type-check, test, build, smoke and the attack script before pushing; CI runs the same.

## Layout

- `src/index.ts`: entry point; wraps the server with the tool policy
- `src/client.ts`: API client (OAuth2 token and refresh, path confinement, no redirects, timeouts)
- `src/policy.ts`: which tools are gated, and their annotations
- `src/spending-guard.ts`, `src/redact.ts`, `src/utils.ts`
- `src/tools/`: one file per area; `src/resources/bank-list.ts`
- `scripts/`: `bundle.mjs`, `smoke.mjs`, `attack.mjs`

## Adding a tool

1. Register it with `server.registerTool` in `src/tools/`. IDs that go in a request path must use `safeId`.
2. Money-moving or account-changing? Add its name to `SENSITIVE_TOOLS` in `src/policy.ts` (and to `OPEN_WORLD_TOOLS` if it sends money out), and update `SENSITIVE_COUNT` in `scripts/smoke.mjs`.
3. Add tests, then update [tools.md](tools.md) and the tool counts in the README.

## Dependencies

The SDK and zod are bundled, so a version change to either changes what users run. Treat it as a releasable change. Dependabot proposes updates weekly with a 7-day cooldown; review each one.

## Releasing

See [RELEASING.md](../RELEASING.md).
