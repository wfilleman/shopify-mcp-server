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
  apiVersion: ApiVersion.October23 || LATEST_API_VERSION,
  isEmbeddedApp: false,
});

// Create session
const session = shopify.session.customAppSession(
  process.env.SHOPIFY_SHOP || ''
);

// Initialize GraphQL client
const graphqlClient = new shopify.clients.Graphql({ session });

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
    const response = await graphqlClient.query<GraphQLResponse<T>>({
      data: {
        query,
        variables,
      },
    });

    if (response.body.errors && response.body.errors.length > 0) {
      throw new Error(response.body.errors[0].message);
    }

    return response.body.data;
  } catch (error) {
    console.error('GraphQL request failed:', error);
    throw error;
  }
}