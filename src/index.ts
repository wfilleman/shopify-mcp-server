#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerOrderTools } from './tools/orderTools.js';
import './shopifyClient.js';

// Create a custom McpServer subclass to handle unimplemented methods
class ShopifyMcpServer extends McpServer {
  constructor(options: any) {
    super(options);
  }

  // Override to provide empty resources list
  async handleResourcesList() {
    return { resources: [] };
  }

  // Override to provide empty prompts list
  async handlePromptsList() {
    return { prompts: [] };
  }
}

// Create MCP server instance
const server = new ShopifyMcpServer({
  name: 'shopify',
  version: '1.0.0',
});

// Register all tools
registerOrderTools(server);

// Redirect console.log to console.error to avoid interfering with stdout
const originalConsoleLog = console.log;
console.log = function(...args) {
  console.error(...args);
};

// Suppress stdout output from Shopify API
if (process.env.NODE_ENV !== 'test') {
  // Redirect stdout writes to stderr
  const stdoutWrite = process.stdout.write;
  // @ts-ignore - TypeScript doesn't like modifying the write method, but it works
  process.stdout.write = function(chunk: any, encoding?: any, callback?: any) {
    // If it looks like a log message, redirect to stderr
    if (typeof chunk === 'string' && 
        (chunk.includes('[shopify-api') || 
         chunk.includes('Future flag') || 
         chunk.includes('Enable this'))) {
      return process.stderr.write(chunk, encoding, callback);
    }
    // Otherwise, proceed normally
    return stdoutWrite.apply(process.stdout, [chunk, encoding, callback]);
  };
}

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