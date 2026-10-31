# Setup

Three steps: get credentials, add the server to your AI app, check it works. Start in the sandbox; nothing here moves real money until you point the server at production.

## 1. Get your Nomba credentials

You need three values from the [Nomba developer dashboard](https://developer.nomba.com):

| Value | Environment variable | Looks like |
|-------|---------------------|------------|
| Client ID | `NOMBA_CLIENT_ID` | an API client ID |
| Client secret | `NOMBA_CLIENT_SECRET` | an API client secret |
| Account ID | `NOMBA_ACCOUNT_ID` | your parent account ID (UUID) |

Create a sandbox client first. The exact dashboard menu names change, so follow Nomba's own developer docs for where to create a client; this guide has not been checked against the current dashboard.

Keep the secret out of git. Put it in your app's user-level config, not in a project file you commit.

## 2. Add the server to your AI app

The server runs locally over stdio: `npx -y nomba-mcp` (Node 24 or later). The same `env` block goes in each app.

### Claude Desktop

Edit the config file, then restart the app.

- macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "nomba": {
      "command": "npx",
      "args": ["-y", "nomba-mcp"],
      "env": {
        "NOMBA_CLIENT_ID": "your_client_id",
        "NOMBA_CLIENT_SECRET": "your_client_secret",
        "NOMBA_ACCOUNT_ID": "your_account_id"
      }
    }
  }
}
```

### Claude Code

```bash
claude mcp add nomba --scope user \
  -e NOMBA_CLIENT_ID=your_client_id \
  -e NOMBA_CLIENT_SECRET=your_client_secret \
  -e NOMBA_ACCOUNT_ID=your_account_id \
  -- npx -y nomba-mcp
```

`--scope user` keeps the secret out of the project directory.

### Cursor

`~/.cursor/mcp.json` (or `.cursor/mcp.json` in a project; don't commit secrets there):

```json
{
  "mcpServers": {
    "nomba": {
      "command": "npx",
      "args": ["-y", "nomba-mcp"],
      "env": {
        "NOMBA_CLIENT_ID": "your_client_id",
        "NOMBA_CLIENT_SECRET": "your_client_secret",
        "NOMBA_ACCOUNT_ID": "your_account_id"
      }
    }
  }
}
```

### VS Code

`.vscode/mcp.json`. The `inputs` block prompts for the secret, so it never lands in the file:

```json
{
  "inputs": [
    { "type": "promptString", "id": "nomba-secret", "description": "Nomba client secret", "password": true }
  ],
  "servers": {
    "nomba": {
      "type": "stdio",
      "command": "npx",
      "args": ["-y", "nomba-mcp"],
      "env": {
        "NOMBA_CLIENT_ID": "your_client_id",
        "NOMBA_CLIENT_SECRET": "${input:nomba-secret}",
        "NOMBA_ACCOUNT_ID": "your_account_id"
      }
    }
  }
}
```

### Windsurf

`~/.codeium/windsurf/mcp_config.json`, same shape as Cursor's `mcpServers` block.

### Codex CLI

`~/.codex/config.toml`:

```toml
[mcp_servers.nomba]
command = "npx"
args = ["-y", "nomba-mcp"]

[mcp_servers.nomba.env]
NOMBA_CLIENT_ID = "your_client_id"
NOMBA_CLIENT_SECRET = "your_client_secret"
NOMBA_ACCOUNT_ID = "your_account_id"
```

### Gemini CLI

`~/.gemini/settings.json`, same shape as Cursor's `mcpServers` block.

### ChatGPT and Grok

These only support remote HTTPS MCP servers. This server is local stdio only, so it can't be added to them.

The config paths above come from each app's documentation at the time of writing and were not all re-checked. If an app has moved its settings, use its own "add MCP server" screen with the command and env values above.

## 3. Check it works

Restart the app, then ask: **"What's my Nomba account balance?"**

You should see your parent account balance in NGN. If not, see [troubleshooting.md](troubleshooting.md).

By default only read-only tools are available, so the assistant can look but not pay. To let it move money, read [security.md](security.md) first, then set `NOMBA_ENABLE_SENSITIVE_TOOLS=true`.

## Going live

Production needs two settings together: `NOMBA_BASE_URL=https://api.nomba.com` and `NOMBA_PRODUCTION_CONFIRMED=true`. Use production credentials, not sandbox ones.

## Disconnect

Remove the `nomba` entry from your app's config (or `claude mcp remove nomba`), restart the app, and revoke the client in the Nomba dashboard if you no longer need it.
