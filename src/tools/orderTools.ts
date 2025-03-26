import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { executeGraphQL } from '../shopifyClient.js';
import {
  formatTextResponse,
  formatErrorResponse,
  formatOrderResponse,
  formatOrdersListResponse,
} from '../utils/formatters.js';

// GraphQL response types
interface OrderResponse {
  order: any;
}

interface OrdersResponse {
  orders: {
    edges: Array<{
      node: any;
    }>;
  };
}

interface FulfillmentOrdersResponse {
  order: {
    id: string;
    name: string;
    fulfillmentOrders: {
      edges: Array<{
        node: {
          id: string;
          status: string;
          requestStatus: string;
          lineItems: {
            edges: Array<{
              node: {
                id: string;
                lineItem: {
                  id: string;
                  name: string;
                };
                quantity: number;
              };
            }>;
          };
        };
      }>;
    };
  };
}

interface SubmitFulfillmentResponse {
  fulfillmentOrderSubmitFulfillmentRequest: {
    submittedFulfillmentOrder: {
      id: string;
      status: string;
      requestStatus: string;
    };
    userErrors: Array<{
      field: string;
      message: string;
    }>;
  };
}

interface FulfillmentTrackingInfoUpdateResponse {
  fulfillmentTrackingInfoUpdate: {
    fulfillment: {
      id: string;
      status?: string;
      trackingInfo: {
        company?: string;
        number?: string;
        url?: string;
      };
    };
    userErrors: Array<{
      field: string;
      message: string;
    }>;
  };
}

interface OrderCloseResponse {
  orderClose: {
    order: {
      id: string;
      closed: boolean;
    };
    userErrors: Array<{
      field: string;
      message: string;
    }>;
  };
}

// GraphQL fragments for order data
const ORDER_FRAGMENT = `
  fragment OrderDetails on Order {
    id
    name
    legacyResourceId
    createdAt
    cancelledAt
    displayFulfillmentStatus
    displayFinancialStatus
    lineItems(first: 10) {
      edges {
        node {
          id
          name
          quantity
          sku
          variant {
            id
            price
            product {
              id
              title
            }
          }
        }
      }
    }
    fulfillments(first: 5) {
      id
      status
      trackingInfo {
        company
        number
        url
      }
      createdAt
    }
    totalPrice
    subtotalPrice
    totalShippingPrice
    totalTax
  }
`;

// GraphQL Queries
const GET_ORDER = `
  ${ORDER_FRAGMENT}
  query GetOrder($id: ID!) {
    order(id: $id) {
      ...OrderDetails
    }
  }
`;

// Query to find an order by its order number (e.g., #1001)
const FIND_ORDER_BY_NUMBER = `
  ${ORDER_FRAGMENT}
  query FindOrderByNumber($query: String!) {
    orders(first: 1, query: $query) {
      edges {
        node {
          ...OrderDetails
        }
      }
    }
  }
`;

const GET_ACTIVE_ORDERS = `
  ${ORDER_FRAGMENT}
  query GetActiveOrders($first: Int!) {
    orders(first: $first, query: "status:open") {
      edges {
        node {
          ...OrderDetails
        }
      }
    }
  }
`;

// GraphQL Mutations
// First, we need to get the fulfillment orders for an order
const GET_FULFILLMENT_ORDERS = `
  query GetFulfillmentOrders($orderId: ID!) {
    order(id: $orderId) {
      id
      name
      fulfillmentOrders(first: 10) {
        edges {
          node {
            id
            status
            requestStatus
            lineItems(first: 10) {
              edges {
                node {
                  id
                  lineItem {
                    id
                    name
                  }
                  quantity
                }
              }
            }
          }
        }
      }
    }
  }
`;

// Then we submit the fulfillment order for fulfillment
const SUBMIT_FULFILLMENT_REQUEST = `
  mutation SubmitFulfillmentRequest($id: ID!, $notifyCustomer: Boolean, $trackingInfo: FulfillmentOrderTrackingInput) {
    fulfillmentOrderSubmitFulfillmentRequest(
      id: $id,
      notifyCustomer: $notifyCustomer,
      trackingInfo: $trackingInfo
    ) {
      submittedFulfillmentOrder {
        id
        status
        requestStatus
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const ADD_TRACKING_INFO = `
  mutation FulfillmentTrackingInfoUpdate($fulfillmentId: ID!, $trackingInfoInput: FulfillmentTrackingInput!, $notifyCustomer: Boolean) {
    fulfillmentTrackingInfoUpdate(
      fulfillmentId: $fulfillmentId, 
      trackingInfoInput: $trackingInfoInput, 
      notifyCustomer: $notifyCustomer
    ) {
      fulfillment {
        id
        status
        trackingInfo {
          company
          number
          url
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

// Using a different approach for order archiving
const CLOSE_ORDER = `
  mutation CloseOrder($input: OrderCloseInput!) {
    orderClose(input: $input) {
      order {
        id
        closed
      }
      userErrors {
        field
        message
      }
    }
  }
`;

/**
 * Register order-related tools with the MCP server
 * @param server McpServer instance
 */
export function registerOrderTools(server: McpServer) {
  // Get order details
  server.tool(
    'get-order-details',
    'Get detailed information about a specific order',
    {
      orderId: z.string().describe('The order ID or order number (e.g., #1001, 1001, or full Shopify ID)'),
    },
    async ({ orderId }) => {
      try {
        // Check if it's a friendly order number like "#1001" or "1001"
        const isOrderNumber = /^#?\d+$/.test(orderId) && !orderId.includes('/');
        
        if (isOrderNumber) {
          // Extract just the number part if it has a # prefix
          const orderNumber = orderId.replace(/^#/, '');
          
          // Find by order number using the query parameter
          const response = await executeGraphQL<{ orders: { edges: Array<{ node: any }> } }>(
            FIND_ORDER_BY_NUMBER, 
            { query: `name:${orderNumber}` }
          );
          
          if (!response.orders || !response.orders.edges || response.orders.edges.length === 0) {
            return formatErrorResponse(`Order ${orderId} not found`);
          }
          
          return formatOrderResponse(response.orders.edges[0].node);
        } else {
          // It's a Shopify ID (either gid:// format or needs to be converted)
          const formattedId = orderId.includes('gid://shopify/Order/')
            ? orderId
            : `gid://shopify/Order/${orderId}`;
          
          const response = await executeGraphQL<OrderResponse>(GET_ORDER, { id: formattedId });
          
          if (!response.order) {
            return formatErrorResponse(`Order ${orderId} not found`);
          }
          
          return formatOrderResponse(response.order);
        }
      } catch (error) {
        return formatErrorResponse(error instanceof Error ? error : String(error));
      }
    }
  );

  // Get active orders
  server.tool(
    'get-active-orders',
    'Get a list of all active orders',
    {
      limit: z.number().min(1).max(100).default(10).describe('Maximum number of orders to return'),
    },
    async ({ limit }) => {
      try {
        const response = await executeGraphQL<OrdersResponse>(GET_ACTIVE_ORDERS, { first: limit });
        
        const orders = response.orders.edges.map(edge => edge.node);
        
        return formatOrdersListResponse(orders);
      } catch (error) {
        return formatErrorResponse(error instanceof Error ? error : String(error));
      }
    }
  );

  // Request fulfillment
  server.tool(
    'request-fulfillment',
    'Fulfill an order with optional tracking information',
    {
      orderId: z.string().describe('The order ID or order number (e.g., #1001, 1001, or full Shopify ID)'),
      lineItems: z.array(
        z.object({
          id: z.string().describe('Line item ID'),
          quantity: z.number().default(1).describe('Quantity to fulfill'),
        })
      ).describe('Line items to fulfill'),
      trackingNumber: z.string().optional().describe('Optional tracking number'),
      trackingCompany: z.string().optional().describe('Optional tracking company'),
      trackingUrl: z.string().optional().describe('Optional tracking URL'),
      notifyCustomer: z.boolean().optional().default(false).describe('Whether to notify the customer about the fulfillment (defaults to false)'),
    },
    async ({ orderId, lineItems, trackingNumber, trackingCompany, trackingUrl, notifyCustomer }) => {
      try {
        // Check if it's a friendly order number and convert it to an ID if needed
        const isOrderNumber = /^#?\d+$/.test(orderId) && !orderId.includes('/');
        let shopifyOrderId = orderId;
        
        if (isOrderNumber) {
          // Extract just the number part if it has a # prefix
          const orderNumber = orderId.replace(/^#/, '');
          
          // Find the order by its number first
          const response = await executeGraphQL<{ orders: { edges: Array<{ node: any }> } }>(
            FIND_ORDER_BY_NUMBER, 
            { query: `name:${orderNumber}` }
          );
          
          if (!response.orders || !response.orders.edges || response.orders.edges.length === 0) {
            return formatErrorResponse(`Order ${orderId} not found`);
          }
          
          // Use the actual Shopify ID for the fulfillment
          shopifyOrderId = response.orders.edges[0].node.id;
        } else if (!orderId.includes('gid://shopify/Order/')) {
          // Convert plain IDs to Shopify GraphQL IDs
          shopifyOrderId = `gid://shopify/Order/${orderId}`;
        }
        
        const lineItemInputs = lineItems.map(item => ({
          id: item.id,
          quantity: item.quantity,
        }));
        
        const trackingInfo = trackingNumber 
          ? {
              number: trackingNumber,
              company: trackingCompany,
              url: trackingUrl,
            }
          : undefined;
        
        // First, get the fulfillment orders for this order
        console.error(`Getting fulfillment orders for order: ${shopifyOrderId}`);
        const fulfillmentOrdersResponse = await executeGraphQL<FulfillmentOrdersResponse>(
          GET_FULFILLMENT_ORDERS, 
          { orderId: shopifyOrderId }
        );
        
        if (!fulfillmentOrdersResponse.order || 
            !fulfillmentOrdersResponse.order.fulfillmentOrders || 
            !fulfillmentOrdersResponse.order.fulfillmentOrders.edges ||
            fulfillmentOrdersResponse.order.fulfillmentOrders.edges.length === 0) {
          return formatErrorResponse(`No fulfillment orders found for order ${orderId}`);
        }
        
        // Get the first available fulfillment order
        const fulfillmentOrder = fulfillmentOrdersResponse.order.fulfillmentOrders.edges[0].node;
        console.error(`Found fulfillment order with ID: ${fulfillmentOrder.id}`);
        
        // Create tracking info if provided
        const trackingInfoInput = trackingNumber ? {
          number: trackingNumber,
          company: trackingCompany || undefined,
          url: trackingUrl || undefined
        } : undefined;
        
        // Submit the fulfillment request
        console.error(`Submitting fulfillment request for fulfillment order: ${fulfillmentOrder.id}`);
        const submitResponse = await executeGraphQL<SubmitFulfillmentResponse>(
          SUBMIT_FULFILLMENT_REQUEST, 
          { 
            id: fulfillmentOrder.id,
            notifyCustomer: notifyCustomer || false,
            trackingInfo: trackingInfoInput
          }
        );
        
        const { submittedFulfillmentOrder, userErrors } = submitResponse.fulfillmentOrderSubmitFulfillmentRequest;
        
        if (userErrors && userErrors.length > 0) {
          return formatErrorResponse(userErrors[0].message);
        }
        
        return formatTextResponse(`Order ${orderId} fulfillment request submitted successfully. Status: ${submittedFulfillmentOrder.status}`);
      } catch (error) {
        return formatErrorResponse(error instanceof Error ? error : String(error));
      }
    }
  );

  // Add tracking information
  server.tool(
    'add-tracking',
    'Add tracking information to a fulfilled order',
    {
      fulfillmentId: z.string().describe('The ID of the fulfillment'),
      trackingNumber: z.string().describe('Tracking number'),
      trackingCompany: z.string().optional().describe('Tracking company'),
      trackingUrl: z.string().optional().describe('Tracking URL'),
      notifyCustomer: z.boolean().optional().default(true).describe('Whether to notify the customer'),
    },
    async ({ fulfillmentId, trackingNumber, trackingCompany, trackingUrl, notifyCustomer }) => {
      try {
        // Try both formats of the fulfillment ID (GID and raw ID)
        let formattedFulfillmentId = fulfillmentId;
        
        // If the ID is already in GID format, keep it as is for the first attempt
        // We'll try with numeric ID only if this fails
        console.error(`Using fulfillment ID: ${formattedFulfillmentId}`);
        
        console.error('Adding tracking info with params:', JSON.stringify({
          fulfillmentId: formattedFulfillmentId,
          trackingInfoInput: {
            number: trackingNumber,
            company: trackingCompany,
            url: trackingUrl,
          },
          notifyCustomer,
        }, null, 2));
        
        let response;
        try {
          // First attempt with the original ID format
          response = await executeGraphQL<FulfillmentTrackingInfoUpdateResponse>(ADD_TRACKING_INFO, {
            fulfillmentId: formattedFulfillmentId,
            trackingInfoInput: {
              number: trackingNumber,
              company: trackingCompany,
              url: trackingUrl,
            },
            notifyCustomer,
          });
        } catch (initialError) {
          // If the original format fails and it was a GID, try with just the numeric part
          if (fulfillmentId.startsWith('gid://shopify/Fulfillment/')) {
            console.error('First attempt failed, trying with numeric ID only...');
            const numericId = fulfillmentId.split('/').pop() || fulfillmentId;
            
            try {
              response = await executeGraphQL<FulfillmentTrackingInfoUpdateResponse>(ADD_TRACKING_INFO, {
                fulfillmentId: numericId,
                trackingInfoInput: {
                  number: trackingNumber,
                  company: trackingCompany,
                  url: trackingUrl,
                },
                notifyCustomer,
              });
              console.error(`Success with numeric ID: ${numericId}`);
            } catch (fallbackError) {
              console.error('Both ID formats failed:', initialError, fallbackError);
              throw initialError; // Re-throw the original error
            }
          } else {
            // If it wasn't a GID or other format to try, just re-throw
            throw initialError;
          }
        }
        
        // Check if response is valid
        if (!response || !response.fulfillmentTrackingInfoUpdate) {
          console.error('Invalid response structure:', JSON.stringify(response, null, 2));
          return formatErrorResponse('Invalid response from Shopify API. Check server logs for details.');
        }
        
        const { fulfillment, userErrors } = response.fulfillmentTrackingInfoUpdate;
        
        if (userErrors && userErrors.length > 0) {
          console.error('User errors:', JSON.stringify(userErrors, null, 2));
          return formatErrorResponse(`Error: ${userErrors[0].message}`);
        }
        
        if (!fulfillment) {
          console.error('No fulfillment returned:', JSON.stringify(response, null, 2));
          return formatErrorResponse('Tracking information update failed. No fulfillment data returned.');
        }
        
        return formatTextResponse(`Tracking information added successfully to fulfillment ${fulfillmentId}`);
      } catch (error) {
        console.error('Exception in add-tracking:', error);
        return formatErrorResponse(`Tracking information update failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  );

  // Archive order
  server.tool(
    'archive-order',
    'Archive an order',
    {
      orderId: z.string().describe('The order ID or order number (e.g., #1001, 1001, or full Shopify ID)'),
    },
    async ({ orderId }) => {
      try {
        // Check if it's a friendly order number and convert it to an ID if needed
        const isOrderNumber = /^#?\d+$/.test(orderId) && !orderId.includes('/');
        let shopifyOrderId = orderId;
        
        if (isOrderNumber) {
          // Extract just the number part if it has a # prefix
          const orderNumber = orderId.replace(/^#/, '');
          
          // Find the order by its number first
          const response = await executeGraphQL<{ orders: { edges: Array<{ node: any }> } }>(
            FIND_ORDER_BY_NUMBER, 
            { query: `name:${orderNumber}` }
          );
          
          if (!response.orders || !response.orders.edges || response.orders.edges.length === 0) {
            return formatErrorResponse(`Order ${orderId} not found`);
          }
          
          // Use the actual Shopify ID for the archive operation
          shopifyOrderId = response.orders.edges[0].node.id;
        } else if (!orderId.includes('gid://shopify/Order/')) {
          // Convert plain IDs to Shopify GraphQL IDs
          shopifyOrderId = `gid://shopify/Order/${orderId}`;
        }
        
        // Using orderClose as an alternative to archiving
        console.error(`Closing order (alternative to archiving) - ID: ${shopifyOrderId}`);
        const response = await executeGraphQL<OrderCloseResponse>(
          CLOSE_ORDER,
          { 
            input: {
              id: shopifyOrderId
            }
          }
        );
        
        if (response.orderClose.userErrors && response.orderClose.userErrors.length > 0) {
          return formatErrorResponse(response.orderClose.userErrors[0].message);
        }
        
        return formatTextResponse(`Order ${orderId} closed successfully. This is the equivalent of archiving in the current API version.`);
      } catch (error) {
        return formatErrorResponse(error instanceof Error ? error : String(error));
      }
    }
  );
}

export default { registerOrderTools };