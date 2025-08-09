#!/usr/bin/env node
/**
 * n8n MCP Server - Main Entry Point
 * 
 * This file serves as the entry point for the n8n MCP Server,
 * which allows AI assistants to interact with n8n workflows through the MCP protocol.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { loadEnvironmentVariables } from './config/environment.js';
import { configureServer } from './config/server.js';

// Load environment variables
loadEnvironmentVariables();

/**
 * Main function to start the n8n MCP Server
 */
async function main() {
  try {
    console.error('Starting n8n MCP Server...');

    // Create and configure the MCP server
    const server = await configureServer();

    // Set up error handling
    server.onerror = (error: unknown) => console.error('[MCP Error]', error);

    // Set up clean shutdown
    process.on('SIGINT', async () => {
      console.error('Shutting down n8n MCP Server...');
      await server.close();
      process.exit(0);
    });

    // Connect to the server transport (stdio)
    const transport = new StdioServerTransport();
    await server.connect(transport);

    console.error('n8n MCP Server running on stdio');
  } catch (error) {
    console.error('Failed to start n8n MCP Server:', error);
    process.exit(1);
  }
}

// Start the server
main().catch(console.error);
