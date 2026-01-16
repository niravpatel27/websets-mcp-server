#!/usr/bin/env node

import express from 'express';
import { randomUUID } from 'node:crypto';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { isInitializeRequest } from '@modelcontextprotocol/sdk/types.js';

// Import the built MCP server module
import createMcpServer from './.smithery/shttp/module.js';

const PORT = process.env.PORT || 8080;

// Get config from environment
const config = {
  exaApiKey: process.env.EXA_API_KEY,
  enabledTools: process.env.ENABLED_TOOLS ? JSON.parse(process.env.ENABLED_TOOLS) : undefined,
  debug: process.env.DEBUG === 'true'
};

const app = express();
app.use(express.json());

// Store active transports by session ID
const transports = {};

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', name: 'websets-mcp-server', version: '1.0.1' });
});

app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    name: 'websets-mcp-server',
    endpoints: {
      health: '/health',
      mcp: '/mcp (POST/GET/DELETE)'
    }
  });
});

// MCP endpoint - handles POST, GET, DELETE
app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  let transport;

  if (sessionId && transports[sessionId]) {
    // Reuse existing session
    transport = transports[sessionId];
  } else if (!sessionId && isInitializeRequest(req.body)) {
    // New session initialization
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id) => {
        transports[id] = transport;
        console.log('Session initialized:', id);
      },
      onsessionclosed: (id) => {
        delete transports[id];
        console.log('Session closed:', id);
      }
    });

    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };

    // Create and connect the MCP server
    const mcpServer = createMcpServer({ config });
    await mcpServer.connect(transport);
  } else {
    res.status(400).json({
      jsonrpc: '2.0',
      error: { code: -32000, message: 'Invalid session or missing session ID' },
      id: null
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = transports[sessionId];
  if (transport) {
    await transport.handleRequest(req, res);
  } else {
    res.status(400).json({ error: 'Invalid session' });
  }
});

app.delete('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'];
  const transport = transports[sessionId];
  if (transport) {
    await transport.handleRequest(req, res);
  } else {
    res.status(400).json({ error: 'Invalid session' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Websets MCP Server listening on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP endpoint: http://localhost:${PORT}/mcp`);
});
