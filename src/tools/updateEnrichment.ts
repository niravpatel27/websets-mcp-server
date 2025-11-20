import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_CONFIG } from "./config.js";
import { WebsetEnrichment } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";
import { ExaApiClient, handleApiError } from "../utils/api.js";

export function registerUpdateEnrichmentTool(server: McpServer, config?: { exaApiKey?: string }): void {
  server.tool(
    "update_enrichment",
    "Update an enrichment's metadata. You can associate custom key-value pairs with the enrichment.",
    {
      websetId: z.string().describe("The ID or externalId of the webset"),
      enrichmentId: z.string().describe("The ID of the enrichment to update"),
      metadata: z.record(z.string(), z.string().max(1000)).describe("Key-value pairs to associate with this enrichment. Each value must be a string.")
    },
    async ({ websetId, enrichmentId, metadata }) => {
      const requestId = `update_enrichment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, 'update_enrichment');
      
      logger.start(`Updating enrichment ${enrichmentId} from webset: ${websetId}`);
      
      try {
        const client = new ExaApiClient(config?.exaApiKey || process.env.EXA_API_KEY || '');

        const params = { metadata };
        
        logger.log("Sending update enrichment request to API");
        
        const response = await client.patch<WebsetEnrichment>(
          API_CONFIG.ENDPOINTS.WEBSET_ENRICHMENT_BY_ID(websetId, enrichmentId),
          params
        );
        
        logger.log(`Updated enrichment: ${response.id}`);

        const result = {
          content: [{
            type: "text" as const,
            text: JSON.stringify(response, null, 2)
          }]
        };
        
        logger.complete();
        return result;
      } catch (error) {
        return handleApiError(error, logger, 'updating enrichment');
      }
    }
  );
}
