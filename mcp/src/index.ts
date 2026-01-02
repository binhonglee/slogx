#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { ConnectionManager } from './connection.js';

const connectionManager = new ConnectionManager();

const server = new Server(
  {
    name: 'slogx',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'slogx_list',
        description: 'List all slogx connections and their status. Use this first to see what services are connected.',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'slogx_connect',
        description: 'Connect to a slogx WebSocket server. Ask the user for their slogx URL if not provided (usually ws://localhost:PORT).',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'WebSocket URL (e.g., ws://localhost:8080)'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'slogx_disconnect',
        description: 'Disconnect from a slogx WebSocket server.',
        inputSchema: {
          type: 'object',
          properties: {
            url: {
              type: 'string',
              description: 'WebSocket URL to disconnect from'
            }
          },
          required: ['url']
        }
      },
      {
        name: 'slogx_search',
        description: 'Search logs by keyword. Preferred over slogx_get_logs to reduce token usage. Use this first to find relevant logs.',
        inputSchema: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'Search term to find in log messages, metadata, or stacktraces'
            },
            service: {
              type: 'string',
              description: 'Filter by service name (optional)'
            },
            level: {
              type: 'string',
              enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
              description: 'Filter by log level (optional)'
            },
            limit: {
              type: 'number',
              description: 'Max results to return (default: 20, max: 100)'
            }
          },
          required: ['query']
        }
      },
      {
        name: 'slogx_get_errors',
        description: 'Get recent error logs. Convenience method for quickly checking errors.',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Filter by service name (optional)'
            },
            limit: {
              type: 'number',
              description: 'Max results to return (default: 20, max: 50)'
            }
          },
          required: []
        }
      },
      {
        name: 'slogx_get_logs',
        description: 'Get recent logs. Use slogx_search instead when looking for specific issues. Keep limit low to minimize token usage.',
        inputSchema: {
          type: 'object',
          properties: {
            service: {
              type: 'string',
              description: 'Filter by service name (optional)'
            },
            level: {
              type: 'string',
              enum: ['DEBUG', 'INFO', 'WARN', 'ERROR'],
              description: 'Filter by log level (optional)'
            },
            limit: {
              type: 'number',
              description: 'Max results to return (default: 20, max: 50)'
            }
          },
          required: []
        }
      },
      {
        name: 'slogx_get_details',
        description: 'Get full details for a specific log entry including stacktrace and all metadata. Use after finding relevant logs via search.',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'Log entry ID from search/get results'
            }
          },
          required: ['id']
        }
      }
    ]
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  switch (name) {
    case 'slogx_list': {
      const connections = connectionManager.list();
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ connections }, null, 2)
          }
        ]
      };
    }

    case 'slogx_connect': {
      const url = (args as { url: string }).url;
      const result = await connectionManager.connect(url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }

    case 'slogx_disconnect': {
      const url = (args as { url: string }).url;
      const result = connectionManager.disconnect(url);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    }

    case 'slogx_search': {
      const { query, service, level, limit } = args as {
        query: string;
        service?: string;
        level?: string;
        limit?: number;
      };
      const effectiveLimit = Math.min(limit || 20, 100);
      const result = connectionManager.search(query, service, level, effectiveLimit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ logs: result.logs, total_matches: result.total }, null, 2)
          }
        ]
      };
    }

    case 'slogx_get_errors': {
      const { service, limit } = args as { service?: string; limit?: number };
      const effectiveLimit = Math.min(limit || 20, 50);
      const logs = connectionManager.getErrors(service, effectiveLimit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ logs }, null, 2)
          }
        ]
      };
    }

    case 'slogx_get_logs': {
      const { service, level, limit } = args as {
        service?: string;
        level?: string;
        limit?: number;
      };
      const effectiveLimit = Math.min(limit || 20, 50);
      const logs = connectionManager.getLogs(service, level, effectiveLimit);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ logs }, null, 2)
          }
        ]
      };
    }

    case 'slogx_get_details': {
      const { id } = args as { id: string };
      const entry = connectionManager.getLogById(id);
      if (!entry) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ error: `Log entry not found: ${id}` }, null, 2)
            }
          ],
          isError: true
        };
      }
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              id: entry.id,
              timestamp: entry.timestamp,
              level: entry.level,
              args: entry.args,
              stacktrace: entry.stacktrace,
              metadata: entry.metadata
            }, null, 2)
          }
        ]
      };
    }

    default:
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: `Unknown tool: ${name}` }, null, 2)
          }
        ],
        isError: true
      };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[slogx-mcp] Server started');
}

main().catch((err) => {
  console.error('[slogx-mcp] Fatal error:', err);
  process.exit(1);
});
