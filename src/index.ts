#!/usr/bin/env node
import 'dotenv/config';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { registerOrderTools } from './tools/orderTools.js';
import './shopifyClient.js';

// Create a simplified McpServer class that just uses the SDK as intended
class ShopifyMcpServer extends McpServer {
  constructor(options: any) {
    super(options);
    
    // Add fallback behavior for the server - we can let the SDK handle most methods
    this.server.fallbackRequestHandler = async (request) => {
      console.error(`Received request: ${request.method}`, JSON.stringify(request.params || {}, null, 2));
      
      // For unsupported methods, return empty responses
      switch (request.method) {
        case 'resources/list':
          return { resources: [] };
        case 'prompts/list':
          return { prompts: [] };
        default:
          return {}; 
      }
    };
  }
  
  // Log the list of tools when requested for debugging
  logToolsList() {
    try {
      // Access tools through the MCP server's internal representation
      const registeredTools = (this as any)._registeredTools || {};
      console.error('Registered tools:');
      
      Object.keys(registeredTools).forEach((toolName) => {
        const tool = registeredTools[toolName];
        console.error(`- ${toolName}: ${tool.description || 'No description'}`);
      });
    } catch (error) {
      console.error('Error accessing tool list:', error);
    }
  }
}

// Create MCP server instance with metadata
const server = new ShopifyMcpServer({
  name: 'shopify',
  version: '1.0.0',
  description: 'Shopify order management tools for LLM agents',
  contact: {
    name: 'Shopify MCP Support',
    url: 'https://github.com/yourusername/shopify-mcp-server/issues'
  },
  logoUrl: 'https://cdn.shopify.com/shopifycloud/brochure/assets/brand-assets/shopify-logo-primary-logo-456baa801ee66a0a435671082365958316831c9960c480451dd0330bcdae304f.svg'
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
    
    // Log startup information
    console.error('Starting Shopify MCP Server...');
    console.error(`Shopify shop: ${process.env.SHOPIFY_SHOP}`);
    console.error(`API key defined: ${!!process.env.SHOPIFY_API_KEY}`);
    console.error(`API token defined: ${!!process.env.SHOPIFY_ACCESS_TOKEN}`);
    
    // Connect the server to the transport
    await server.connect(transport);

    // Log registered tools for diagnostics
    server.logToolsList();
    
    console.error('Shopify MCP Server running successfully on stdio');
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