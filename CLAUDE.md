# Shopify MCP Server Development Guidelines

## Commands
- Setup: `npm install`
- Build: `npm run build`
- Start: `npm start`
- Dev mode: `npm run dev`
- Lint: `npm run lint`
- Type check: `npm run typecheck`
- Test: `npm test`
- Single test: `npm test -- -t "test name"`

## Code Style
- **TypeScript**: Use strong typing with interfaces/types for all GraphQL responses
- **Formatting**: Use Prettier with 2-space indentation
- **Imports**: Group imports (SDK, Shopify, local) with blank line separators
- **Naming**: camelCase for variables/functions, PascalCase for interfaces/types
- **Error Handling**: Use try/catch blocks with formatErrorResponse utility
- **Documentation**: JSDoc comments for public functions with @param and @returns tags
- **Structure**: Group related GraphQL operations in the same file
- **Responses**: Always use the formatter utilities from utils/formatters.ts

## Shopify API Guidelines
- Use GraphQL for all operations when possible
- Always handle userErrors array in GraphQL responses
- Include ORDER_FRAGMENT for consistent order data retrieval
- Follow the MCP protocol for all tool responses

## Shopify GraphQL Mutations
- Format GraphQL mutations with variables as top-level objects:
  ```graphql
  mutation MyMutation($input: MyInputType!) {
    operationName(input: $input) {
      # fields
    }
  }
  ```
- When executing GraphQL, pass variables object with properly structured input:
  ```typescript
  executeGraphQL<ResponseType>(MUTATION_NAME, { 
    input: {
      id: "gid://shopify/Resource/123456789",
      otherField: value
    }
  });
  ```
- For order operations, always convert order numbers to proper Shopify GraphQL IDs
- Use the following mutation for closing orders (equivalent to archiving):
  ```graphql
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
  ```

## MCP Server Implementation
- Let the MCP SDK handle core protocol features (initialization, tools listing)
- Keep the server implementation minimal and avoid overriding SDK methods
- Use fallback request handler for custom method handling
- Always provide proper error handling with informative error messages
- Add diagnostic logging for request/response activity
- Test all API endpoints to ensure compatibility with LLM agents