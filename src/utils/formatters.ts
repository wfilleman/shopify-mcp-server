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
  let orderText = `Order #${order.legacyResourceId || order.name}\n`;
  orderText += `Status: ${order.displayFulfillmentStatus || 'Unknown'}\n`;
  orderText += `Created: ${order.createdAt || 'Unknown'}\n`;
  orderText += `Total: ${order.totalPrice || 'Unknown'}\n\n`;
  
  // Add fulfillment information if available
  if (order.fulfillments && Array.isArray(order.fulfillments) && order.fulfillments.length > 0) {
    orderText += `==== Fulfillments ====\n`;
    order.fulfillments.forEach((fulfillment: any, index: number) => {
      orderText += `Fulfillment #${index + 1}\n`;
      orderText += `ID: ${fulfillment.id}\n`;
      orderText += `Status: ${fulfillment.status || 'Unknown'}\n`;
      
      // Add tracking info if available
      if (fulfillment.trackingInfo && fulfillment.trackingInfo.number) {
        orderText += `Tracking: ${fulfillment.trackingInfo.number}\n`;
        if (fulfillment.trackingInfo.company) {
          orderText += `Carrier: ${fulfillment.trackingInfo.company}\n`;
        }
        if (fulfillment.trackingInfo.url) {
          orderText += `URL: ${fulfillment.trackingInfo.url}\n`;
        }
      } else {
        orderText += `Tracking: None\n`;
      }
      orderText += `Created: ${fulfillment.createdAt}\n\n`;
    });
  } else {
    orderText += `No fulfillments found for this order.\n`;
  }
  
  // Add line items
  if (order.lineItems && order.lineItems.edges && order.lineItems.edges.length > 0) {
    orderText += `==== Line Items ====\n`;
    order.lineItems.edges.forEach((edge: any, index: number) => {
      const item = edge.node;
      orderText += `${item.quantity}x ${item.name}\n`;
    });
  }

  return {
    content: [
      {
        type: "text" as const,
        text: orderText,
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
    return `Order #${order.legacyResourceId || order.name || order.id.split('/').pop()}\n` +
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