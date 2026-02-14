import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { NombaClient } from "../client.js";
import { CACHE_TTL_MS } from "../utils.js";

export function registerBankListResource(
  server: McpServer,
  client: NombaClient
): void {
  let cache: { data: string; expiresAt: number } | null = null;

  server.registerResource(
    "bank-list",
    "nomba://banks",
    {
      description:
        "List of all Nigerian bank codes and names. Cached for 24 hours.",
      mimeType: "application/json",
    },
    async () => {
      if (!cache || Date.now() >= cache.expiresAt) {
        const result = await client.get("/v1/transfers/banks");
        cache = {
          data: JSON.stringify(result, null, 2),
          expiresAt: Date.now() + CACHE_TTL_MS,
        };
      }
      return {
        contents: [
          {
            uri: "nomba://banks",
            mimeType: "application/json",
            text: cache.data,
          },
        ],
      };
    }
  );
}
