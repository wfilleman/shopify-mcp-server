# Shopify MCP Server

A Model Context Protocol (MCP) server for integrating Shopify operations with LLM agents. This server provides a set of tools for handling Shopify orders, including fulfillment, tracking, archiving, and retrieval.

## Features

- Request fulfillment for an order
- Add tracking information to orders
- Archive orders
- Get details for a specific order
- List all active orders

## Setup

### Prerequisites

- Node.js 18 or higher
- A Shopify store with API access

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/shopify-mcp-server.git
   cd shopify-mcp-server
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create a `.env` file based on `.env.example` and add your Shopify API credentials:
   ```
   SHOPIFY_API_KEY=your_api_key
   SHOPIFY_API_SECRET=your_api_secret
   SHOPIFY_SCOPES=write_orders,read_orders
   SHOPIFY_SHOP=your-shop.myshopify.com
   SHOPIFY_ACCESS_TOKEN=your_access_token
   ```

### Building and Running

1. Build the project:
   ```bash
   npm run build
   ```

2. Start the server:
   ```bash
   npm start
   ```

3. For development with automatic rebuilding:
   ```bash
   npm run dev
   ```

## Usage with LLM Agents

This server implements the Model Context Protocol (MCP) and exposes the following tools:

- `get-order-details`: Get detailed information about a specific order
- `get-active-orders`: Get a list of all active orders
- `request-fulfillment`: Fulfill an order with optional tracking information
- `add-tracking`: Add tracking information to a fulfilled order
- `archive-order`: Archive an order

## License

ISC