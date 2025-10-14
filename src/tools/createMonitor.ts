import { z } from "zod";
import axios from "axios";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { API_CONFIG } from "./config.js";
import { WebsetMonitor, CreateMonitorParams } from "../types.js";
import { createRequestLogger } from "../utils/logger.js";

export function registerCreateMonitorTool(server: McpServer, config?: { exaApiKey?: string }): void {
  server.tool(
    "create_monitor",
    "Create a monitor to automatically update a webset on a schedule. Monitors run search operations to find new items.",
    {
      websetId: z.string().describe("The ID or externalId of the webset"),
      cron: z.string().describe("Cron expression for the schedule (e.g., '0 9 * * 1' for every Monday at 9am). Must be valid Unix cron with 5 fields."),
      timezone: z.string().optional().describe("IANA timezone (e.g., 'America/New_York'). Defaults to 'Etc/UTC'"),
      query: z.string().optional().describe("The search query to use. Defaults to the last search query used."),
      count: z.number().optional().describe("Maximum number of results to find per run")
    },
    async ({ websetId, cron, timezone, query, count }) => {
      const requestId = `create_monitor-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      const logger = createRequestLogger(requestId, 'create_monitor');
      
      logger.start(`Creating monitor for webset: ${websetId}`);
      
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

        const params: CreateMonitorParams = {
          websetId,
          cadence: {
            cron,
            ...(timezone && { timezone })
          },
          behavior: {
            type: 'search',
            config: {
              ...(query && { query }),
              ...(count && { count })
            }
          }
        };
        
        logger.log("Sending create monitor request to API");
        
        const response = await axiosInstance.post<WebsetMonitor>(
          API_CONFIG.ENDPOINTS.MONITORS,
          params
        );
        
        logger.log(`Created monitor: ${response.data.id}`);

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
              text: `Error creating monitor (${statusCode}): ${errorMessage}`
            }],
            isError: true,
          };
        }
        
        return {
          content: [{
            type: "text" as const,
            text: `Error creating monitor: ${error instanceof Error ? error.message : String(error)}`
          }],
          isError: true,
        };
      }
    }
  );
}
