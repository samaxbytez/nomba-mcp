# Releasing

Publishing is automated; you never run `npm publish` or create tags by hand.

## Steps

1. Merge your PRs to `main`. Main squash-merges, so each PR title must be a valid Conventional Commit.
2. Open a `chore: release X.Y.Z` PR that bumps the version with `npm version X.Y.Z --no-git-tag-version` and adds a `## [X.Y.Z] - YYYY-MM-DD` section to `CHANGELOG.md` (Breaking, Security, Added, Fixed, Changed, in plain language).
3. Merge it. `publish.yml` builds it (lint, type-check, test, build, smoke), then waits. Open the run in **Actions** and approve the **npm-publish** deployment. Only then does it publish to npm with provenance and create the `vX.Y.Z` tag and GitHub Release.

## Choosing the version

| Change since the last release | Bump |
|-------------------------------|------|
| `feat!:` or a `BREAKING CHANGE:` footer | major |
| `feat:` | minor |
| `fix:` / `perf:` | patch |
| A bundled package changed version | patch |
| only `chore:` `docs:` `refactor:` `test:` `ci:` | no release |

The published file contains the MCP SDK and zod, so a Dependabot bump of either changes what users run and counts as a releasable patch.

## After publishing

Check the registry directly (a local `npm view` can be stale):

```bash
curl -s https://registry.npmjs.org/nomba-mcp | node -e 'const d=JSON.parse(require("fs").readFileSync(0));const v=d["dist-tags"].latest;console.log(v,d.versions[v].dependencies??"no dependencies",d.versions[v].dist.attestations?"provenance":"NO provenance")'
```

Then confirm the tag and GitHub Release exist, and in an empty directory run `npm install nomba-mcp` (expect 1 package, 0 vulnerabilities).

## One-time setup (repo owner)

- GitHub: create an environment named `npm-publish` with yourself as required reviewer, so a stolen login can't publish on its own.
- npm: on npmjs.com, add a Trusted Publisher for `nomba-mcp` pointing at repo `samaxbytez/nomba-mcp`, workflow `publish.yml`, environment `npm-publish`. No npm token is stored anywhere.
