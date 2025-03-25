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
  
  // Override to handle tools list request
  async handleToolsList() {
    // Get the registered tools from parent class implementation
    const result = await super.handleToolsList();
    console.error('Tools list requested:', JSON.stringify(result, null, 2));
    return result;
  }
  
  // Add a custom method handler for any unsupported methods
  async handleJsonRpcRequest(method: string, params: any, requestId: string | number) {
    console.error(`Received RPC request: ${method} with ID ${requestId}`);
    
    // Try the parent implementation first
    try {
      return await super.handleJsonRpcRequest(method, params, requestId);
    } catch (error) {
      // If the parent implementation throws a "method not found" error,
      // we'll handle common MCP methods that we haven't explicitly implemented
      if (error instanceof Error && error.message.includes('Method not found')) {
        console.error(`Handling unimplemented method: ${method}`);
        
        // Handle known MCP methods with empty results
        switch (method) {
          case 'prompts/list':
            return { prompts: [] };
          case 'resources/list':
            return { resources: [] };
          default:
            // Re-throw for truly unknown methods
            throw error;
        }
      }
      
      // For other errors, just re-throw
      throw error;
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

    // List all registered tools for diagnostics
    const toolsList = await server.handleToolsList();
    console.error('Registered tools:');
    toolsList.tools.forEach((tool: any) => {
      console.error(`- ${tool.name}: ${tool.description}`);
    });
    
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