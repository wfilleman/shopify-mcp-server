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

interface FulfillmentCreateResponse {
  fulfillmentCreateV2: {
    fulfillment: {
      id: string;
      trackingInfo?: {
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

interface OrderArchiveResponse {
  orderArchive: {
    order: {
      id: string;
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
const FULFILL_ORDER = `
  mutation FulfillOrderItems($orderId: ID!, $lineItems: [FulfillmentLineItemInput!]!, $trackingInfo: FulfillmentTrackingInput) {
    fulfillmentCreateV2(
      fulfillment: {
        lineItems: $lineItems,
        orderId: $orderId,
        trackingInfo: $trackingInfo
      }
    ) {
      fulfillment {
        id
        trackingInfo {
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

const ARCHIVE_ORDER = `
  mutation ArchiveOrder($id: ID!) {
    orderArchive(input: { id: $id }) {
      order {
        id
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
      orderId: z.string().describe('The ID or name of the order (e.g., #1001)'),
    },
    async ({ orderId }) => {
      try {
        const formattedId = orderId.startsWith('#') 
          ? `gid://shopify/Order/${orderId.substring(1)}` 
          : orderId;
        
        const response = await executeGraphQL<OrderResponse>(GET_ORDER, { id: formattedId });
        
        if (!response.order) {
          return formatErrorResponse(`Order ${orderId} not found`);
        }
        
        return formatOrderResponse(response.order);
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
      orderId: z.string().describe('The ID of the order to fulfill'),
      lineItems: z.array(
        z.object({
          id: z.string().describe('Line item ID'),
          quantity: z.number().default(1).describe('Quantity to fulfill'),
        })
      ).describe('Line items to fulfill'),
      trackingNumber: z.string().optional().describe('Optional tracking number'),
      trackingCompany: z.string().optional().describe('Optional tracking company'),
      trackingUrl: z.string().optional().describe('Optional tracking URL'),
    },
    async ({ orderId, lineItems, trackingNumber, trackingCompany, trackingUrl }) => {
      try {
        const lineItemInputs = lineItems.map(item => ({
          lineItemId: item.id,
          quantity: item.quantity,
        }));
        
        const trackingInfo = trackingNumber 
          ? {
              number: trackingNumber,
              company: trackingCompany,
              url: trackingUrl,
            }
          : undefined;
        
        const response = await executeGraphQL<FulfillmentCreateResponse>(FULFILL_ORDER, {
          orderId,
          lineItems: lineItemInputs,
          trackingInfo,
        });
        
        const { fulfillment, userErrors } = response.fulfillmentCreateV2;
        
        if (userErrors && userErrors.length > 0) {
          return formatErrorResponse(userErrors[0].message);
        }
        
        return formatTextResponse(`Order ${orderId} fulfilled successfully. Fulfillment ID: ${fulfillment.id}`);
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
        const response = await executeGraphQL<FulfillmentTrackingInfoUpdateResponse>(ADD_TRACKING_INFO, {
          fulfillmentId,
          trackingInfoInput: {
            number: trackingNumber,
            company: trackingCompany,
            url: trackingUrl,
          },
          notifyCustomer,
        });
        
        const { fulfillment, userErrors } = response.fulfillmentTrackingInfoUpdate;
        
        if (userErrors && userErrors.length > 0) {
          return formatErrorResponse(userErrors[0].message);
        }
        
        return formatTextResponse(`Tracking information added successfully to fulfillment ${fulfillmentId}`);
      } catch (error) {
        return formatErrorResponse(error instanceof Error ? error : String(error));
      }
    }
  );

  // Archive order
  server.tool(
    'archive-order',
    'Archive an order',
    {
      orderId: z.string().describe('The ID of the order to archive'),
    },
    async ({ orderId }) => {
      try {
        const response = await executeGraphQL<OrderArchiveResponse>(ARCHIVE_ORDER, { id: orderId });
        
        const { order, userErrors } = response.orderArchive;
        
        if (userErrors && userErrors.length > 0) {
          return formatErrorResponse(userErrors[0].message);
        }
        
        return formatTextResponse(`Order ${orderId} archived successfully`);
      } catch (error) {
        return formatErrorResponse(error instanceof Error ? error : String(error));
      }
    }
  );
}

export default { registerOrderTools };