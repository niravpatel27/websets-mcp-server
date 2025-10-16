import { z } from "zod";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_CONFIG } from "./config.js";
import { WebsetSearch } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";

export function registerCancelSearchTool(server: McpServer, config?: { exaApiKey?: string }): void {
  server.tool(
    "cancel_search",
    "Cancel a running search operation. This will stop the search from finding more items.",
    {
      websetId: z.string().describe("The ID or externalId of the webset"),
      searchId: z.string().describe("The ID of the search to cancel")
    },
    async ({ websetId, searchId }) => {
      const requestId = `cancel_search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, 'cancel_search');
      
      logger.start(`Canceling search ${searchId} from webset: ${websetId}`);
      
      try {
        const axiosInstance = axios.create({
          baseURL: API_CONFIG.BASE_URL,
          headers: {
            'accept': 'application/json',
            'content-type': 'application/json',
            'x-api-key': config?.exaApiKey || process.env.EXA_API_KEY || ''
          },
          timeout: 30000
        });
        
        logger.log("Sending cancel search request to API");
        
        const response = await axiosInstance.post<WebsetSearch>(
          `${API_CONFIG.ENDPOINTS.WEBSET_SEARCH_BY_ID(websetId, searchId)}/cancel`
        );
        
        logger.log(`Canceled search: ${response.data.id}`);

        const result = {
          content: [{
            type: "text" as const,
            text: JSON.stringify(response.data, null, 2)
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
              text: `Error canceling search (${statusCode}): ${errorMessage}`
            }],
            isError: true,
          };
        }
        
        return {
          content: [{
            type: "text" as const,
            text: `Error canceling search: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}

