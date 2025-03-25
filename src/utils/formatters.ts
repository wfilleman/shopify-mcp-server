/**
 * Utilities for formatting MCP server responses
 */

// Define proper MCP response type with index signature
interface McpResponse {
  [key: string]: unknown;
  content: Array<{
    [key: string]: unknown;
    type: "text";
    text: string;
  }>;
  isError?: boolean;
}

// Success response with text content
export function formatTextResponse(text: string): McpResponse {
  return {
    content: [
      {
        type: "text" as const,
        text,
      },
    ],
  };
}

// Error response with formatted error message
export function formatErrorResponse(error: Error | string): McpResponse {
  const errorMessage = typeof error === 'string' 
    ? error 
    : error.message || 'Unknown error';
  
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${errorMessage}`,
      },
    ],
    isError: true,
  };
}

// Format order data for display
export function formatOrderResponse(order: any): McpResponse {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(order, null, 2),
      },
    ],
  };
}

// Format multiple orders for display
export function formatOrdersListResponse(orders: any[]): McpResponse {
  if (orders.length === 0) {
    return formatTextResponse("No orders found");
  }
  
  const ordersText = orders.map(order => {
    return `Order #${order.name || order.legacyResourceId || order.id}\n` +
           `Status: ${order.displayFulfillmentStatus || 'Unknown'}\n` +
           `Date: ${order.createdAt || 'Unknown'}\n` +
           `Total: ${order.totalPrice || 'Unknown'}\n` +
           `---`;
  }).join('\n\n');
  
  return formatTextResponse(ordersText);
}

// Export default for easy imports
export default {
  formatTextResponse,
  formatErrorResponse,
  formatOrderResponse,
  formatOrdersListResponse,
};