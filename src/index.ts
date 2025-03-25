#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerOrderTools } from './tools/orderTools.js';
import './shopifyClient.js';

// Create MCP server instance
const server = new McpServer({
  name: 'shopify',
  version: '1.0.0',
});

// Register all tools
registerOrderTools(server);

// Main function to start the server
async function main() {
  try {
    // Check for required environment variables
    const requiredEnvVars = [
      'SHOPIFY_API_KEY',
      'SHOPIFY_API_SECRET',
      'SHOPIFY_SHOP',
      'SHOPIFY_ACCESS_TOKEN',
    ];

    const missingEnvVars = requiredEnvVars.filter(
      (varName) => !process.env[varName]
    );

    if (missingEnvVars.length > 0) {
      console.error(
        `Missing required environment variables: ${missingEnvVars.join(', ')}`
      );
      console.error('Please create a .env file based on .env.example');
      process.exit(1);
    }

    // Initialize transport
    const transport = new StdioServerTransport();
    
    // Connect the server to the transport
    await server.connect(transport);
    
    console.error('Shopify MCP Server running on stdio');
  } catch (error) {
    console.error('Fatal error in main():', error);
    process.exit(1);
  }
}

// Start the server
main().catch((error) => {
  console.error('Failed to start server:', error);
  process.exit(1);
});