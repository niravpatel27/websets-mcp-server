import { z } from "zod";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_CONFIG } from "./config.js";
import { createRequestLogger } from "../utils/logger.js";

export function registerDeleteEnrichmentTool(server: McpServer, config?: { exaApiKey?: string }): void {
  server.tool(
    "delete_enrichment",
    "Delete an enrichment from a webset. This will remove all enriched data for this enrichment from all items.",
    {
      websetId: z.string().describe("The ID or externalId of the webset"),
      enrichmentId: z.string().describe("The ID of the enrichment to delete")
    },
    async ({ websetId, enrichmentId }) => {
      const requestId = `delete_enrichment-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, 'delete_enrichment');
      
      logger.start(`Deleting enrichment ${enrichmentId} from webset: ${websetId}`);
      
      try {
        const axiosInstance = axios.create({
          baseURL: API_CONFIG.BASE_URL,
          headers: {
            'accept': 'application/json',
            'x-api-key': config?.exaApiKey || process.env.EXA_API_KEY || ''
          },
          timeout: 30000
        });
        
        logger.log("Sending delete enrichment request to API");
        
        await axiosInstance.delete(
          API_CONFIG.ENDPOINTS.WEBSET_ENRICHMENT_BY_ID(websetId, enrichmentId)
        );
        
        logger.log(`Deleted enrichment: ${enrichmentId}`);

        const result = {
          content: [{
            type: "text" as const,
            text: `Successfully deleted enrichment ${enrichmentId} from webset ${websetId}`
          }]
        };
        
        logger.complete();
        return result;
      } catch (error) {
        logger.error(error);
        
        if (axios.isAxiosError(error)) {
          const statusCode = error.response?.status || 'unknown';
          const errorMessage = error.response?.data?.message || error.message;
          
          logger.log(`API error (${statusCode}): ${errorMessage}`);
          return {
            content: [{
              type: "text" as const,
              text: `Error deleting enrichment (${statusCode}): ${errorMessage}`
            }],
            isError: true,
          };
        }
        
        return {
          content: [{
            type: "text" as const,
            text: `Error deleting enrichment: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}

