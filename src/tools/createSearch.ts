import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_CONFIG } from "./config.js";
import { WebsetSearch, CreateSearchParams } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";
import { ExaApiClient, handleApiError } from "../utils/api.js";

export function registerCreateSearchTool(server: McpServer, config?: { exaApiKey?: string }): void {
  server.tool(
    "create_search",
    `Create a new search to find and add items to a webset. The search will discover entities matching your query and criteria.

IMPORTANT PARAMETER FORMATS:
- entity: MUST be an object like {type: "company"} (NOT a string)
- criteria: MUST be array of objects like [{description: "..."}] (NOT array of strings)

Example call:
{
  "websetId": "webset_123",
  "query": "AI startups in San Francisco",
  "entity": {"type": "company"},
  "criteria": [{"description": "Founded after 2020"}],
  "count": 10
}`,
    {
      websetId: z.string().describe("The ID or externalId of the webset"),
      query: z.string().describe("Natural language query describing what to search for (e.g., 'AI startups in San Francisco')"),
      count: z.number().int().min(1).optional().describe("Number of items to find (default: 10, min: 1)"),
      entity: z.object({
        type: z.enum(['company', 'person', 'article', 'research_paper', 'custom']).describe("Type of entity to search for")
      }).optional().describe("Entity type to search for. Must be an object with a 'type' field. Example: {type: 'company'}"),
      criteria: z.array(z.object({
        description: z.string()
      })).optional().describe("Additional criteria for evaluating search results. Each criterion is an object with a 'description' field. Example: [{description: 'Company is profitable'}, {description: 'Has raised Series A or later'}]"),
      behavior: z.enum(['override', 'append']).optional().describe("'override' replaces existing items, 'append' adds to them (default: override)"),
      recall: z.boolean().optional().describe("Whether to compute recall metrics for the search"),
      metadata: z.record(z.string(), z.string()).optional().describe("Key-value pairs to associate with this search")
    },
    async ({ websetId, query, count, entity, criteria, behavior, recall, metadata }) => {
      const requestId = `create_search-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, 'create_search');
      
      logger.start(`Creating search for webset: ${websetId}`);
      
      try {
        const client = new ExaApiClient(config?.exaApiKey || process.env.EXA_API_KEY || '');

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
        logger.log(`Parameters: ${JSON.stringify(params, null, 2)}`);
        
        const response = await client.post<WebsetSearch>(
          API_CONFIG.ENDPOINTS.WEBSET_SEARCHES(websetId),
          params
        );
        
        logger.log(`Created search: ${response.id}`);

        const result = {
          content: [{
            type: "text" as const,
            text: JSON.stringify(response, null, 2)
          }]
        };
        
        logger.complete();
        return result;
      } catch (error) {
        return handleApiError(error, logger, 'creating search', (statusCode) => {
          if (statusCode === 400) {
            return '\n\nCommon issues:\n' +
              '- criteria must be array of objects: [{description: "criterion"}]\n' +
              '- entity must be object: {type: "company"}\n' +
              '- count must be a positive number\n' +
              '- behavior must be "override" or "append"\n\n' +
              'Example:\n' +
              '{\n' +
              '  "websetId": "webset_123",\n' +
              '  "query": "AI startups in San Francisco",\n' +
              '  "entity": {"type": "company"},\n' +
              '  "criteria": [{"description": "Founded after 2020"}],\n' +
              '  "count": 10\n' +
              '}';
          }
          return '';
        });
      }
    }
  );
}
