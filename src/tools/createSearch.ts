import { z } from "zod";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_CONFIG } from "./config.js";
import { WebsetSearch, CreateSearchParams } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";

export function registerCreateSearchTool(server: McpServer, config?: { exaApiKey?: string }): void {
  server.tool(
    "create_search",
    "Create a new search to find and add items to a webset. The search will discover entities matching your query and criteria.",
    {
      websetId: z.string().describe("The ID or externalId of the webset"),
      query: z.string().describe("Natural language query describing what to search for (e.g., 'AI startups in San Francisco')"),
      count: z.number().optional().describe("Number of items to find (default: 10, min: 1)"),
      entity: z.object({
        type: z.enum(['company', 'person', 'article', 'research_paper', 'custom']).describe("Type of entity to search for")
      }).optional().describe("Entity type to search for"),
      criteria: z.array(z.object({
        description: z.string()
      })).optional().describe("Additional criteria for evaluating search results"),
      behavior: z.enum(['override', 'append']).optional().describe("'override' replaces existing items, 'append' adds to them (default: override)"),
      recall: z.boolean().optional().describe("Whether to compute recall metrics for the search"),
      metadata: z.record(z.string(), z.string()).optional().describe("Key-value pairs to associate with this search")
    },
    async ({ websetId, query, count, entity, criteria, behavior, recall, metadata }) => {
      const requestId = `create_search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, 'create_search');
      
      logger.start(`Creating search for webset: ${websetId}`);
      
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

        const params: CreateSearchParams = {
          query,
          ...(count && { count }),
          ...(entity && { entity }),
          ...(criteria && { criteria }),
          ...(behavior && { behavior }),
          ...(recall !== undefined && { recall }),
          ...(metadata && { metadata })
        };
        
        logger.log("Sending create search request to API");
        
        const response = await axiosInstance.post<WebsetSearch>(
          API_CONFIG.ENDPOINTS.WEBSET_SEARCHES(websetId),
          params
        );
        
        logger.log(`Created search: ${response.data.id}`);

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
              text: `Error creating search (${statusCode}): ${errorMessage}`
            }],
            isError: true,
          };
        }
        
        return {
          content: [{
            type: "text" as const,
            text: `Error creating search: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}

