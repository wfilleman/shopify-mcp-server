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

### Updating Tracking Information

To update tracking information for an order, follow these steps:

1. First, get the order details using `get-order-details` with the order ID
2. From the response, find the fulfillment ID in the "Fulfillments" section
3. Use the `add-tracking` tool with the fulfillment ID and tracking information:
   ```
   {
     "fulfillmentId": "gid://shopify/Fulfillment/123456789",
     "trackingNumber": "1Z999AA10123456789",
     "trackingCompany": "UPS",
     "trackingUrl": "https://www.ups.com/track?tracknum=1Z999AA10123456789",
     "notifyCustomer": true
   }
   ```

## Technical Details

### API Version Management

This server uses Shopify's `LATEST_API_VERSION` constant (currently 2025-01) to ensure compatibility with the newest API features. This future-proofs the application but may occasionally require schema adjustments when Shopify makes breaking changes to their API.

### PII Handling

To support stores on all Shopify plans, this server avoids requesting personally identifiable information (PII) like customer details, emails, and addresses, which are restricted to higher-tier Shopify plans.

## License

ISC