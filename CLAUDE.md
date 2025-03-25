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