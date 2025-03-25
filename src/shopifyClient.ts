import { shopifyApi, ApiVersion, LATEST_API_VERSION } from '@shopify/shopify-api';
import '@shopify/shopify-api/adapters/node';

// Define type for GraphQL response
export interface GraphQLResponse<T> {
  data: T;
  errors?: Array<{ message: string }>;
}

// Initialize Shopify API
const shopify = shopifyApi({
  apiKey: process.env.SHOPIFY_API_KEY || '',
  apiSecretKey: process.env.SHOPIFY_API_SECRET || '',
  scopes: (process.env.SHOPIFY_SCOPES || '').split(','),
  hostName: process.env.SHOPIFY_SHOP || '',
  apiVersion: LATEST_API_VERSION, // Use the latest available API version (2025-01 currently)
  isEmbeddedApp: false,
  logger: {
    log: (severity, message) => {
      console.error(`[shopify-api/${severity}]`, message);
    }
  }
});

// Create session with access token
const session = shopify.session.customAppSession(
  process.env.SHOPIFY_SHOP || ''
);

// Set the access token on the session
session.accessToken = process.env.SHOPIFY_ACCESS_TOKEN || '';

// Initialize GraphQL client
const graphqlClient = new shopify.clients.Graphql({ 
  session 
});

/**
 * Execute a GraphQL query against the Shopify API
 * @param query GraphQL query or mutation
 * @param variables Variables for the query
 * @returns Promise with the response data
 */
export async function executeGraphQL<T>(
  query: string,
  variables: Record<string, any> = {}
): Promise<T> {
  try {
    // For backwards compatibility, use the query method
    const response = await graphqlClient.query<GraphQLResponse<T>>({
      data: {
        query,
        variables,
      }
    });

    if (response.body.errors && response.body.errors.length > 0) {
      const errorMessage = response.body.errors[0].message;
      
      // Check for permission-related errors
      if (errorMessage.includes('not approved to access')) {
        console.error('Permission error:', errorMessage);
        console.error('Consider updating Shopify API scopes to include required permissions');
      }
      
      throw new Error(errorMessage);
    }

    return response.body.data;
  } catch (error) {
    console.error('GraphQL request failed:', error);
    throw error;
  }
}