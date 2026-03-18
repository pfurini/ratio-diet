# Ratio Diet — Project Rules

## Monorepo Structure & Responsibilities

### Packages
- `packages/backend` — ALL business logic: Convex functions, AI SDK + OpenRouter provider, database schema, nutritional calculations. No business logic goes in `apps/web`.
- `packages/ui` — Shared/reusable shadcn components (installed via `pnpm dlx shadcn@latest`)
- `packages/env` — Environment variable validation (t3-env)
- `packages/config` — Shared TypeScript/tooling configurations

### Apps
- `apps/web` — Next.js frontend (PWA mobile-first)
  - `src/app/(marketing)/` — Public pages (landing, pricing, etc.), including homepage
  - `src/app/(user)/` — Private pages behind authentication
  - `src/components/custom/` — App-specific components NOT from shadcn registries
  - shadcn components specific to app pages → `apps/web` (via `components.json`)

### Key Rules
- Business logic NEVER goes in `apps/web` — it stays in `packages/backend`
- Shared/reusable UI primitives → `packages/ui`
- App-specific blocks/composed sections → `apps/web`
- Components downloaded from shadcn registry → appropriate `components.json` target
- Components built manually → `apps/web/src/components/custom/`

### Stripe
- A Stripe MCP server is connected to the project's **test account**. Use it freely to create/manage products, prices, coupons, and other Stripe resources during development.
- Use **Stripe-hosted Checkout** (CheckoutSessions API) for payments — never the Charges API or legacy Card Element.
- Use **dynamic payment methods** (configured in Stripe Dashboard) — never pass `payment_method_types` explicitly.
- Use **Customer Portal** for subscription management.
- Use **Billing/Subscription APIs** combined with Checkout for recurring revenue.
- Follow the [Go Live Checklist](https://docs.stripe.com/get-started/checklist/go-live) before production launch.

### Code Size Limits
- **Max 500 lines per source file.** If a file approaches this limit, split it into focused sub-modules.
- **Max 20 statements per function** (oxlint `max-statements` rule). Extract helpers, compose smaller functions, or split into multiple focused functions. This applies to all function blocks including handlers, callbacks, and arrow functions.

### AI Provider
- Use **Vercel AI SDK** (`ai` package) as the unified interface
- Use **`@openrouter/ai-sdk-provider`** as the provider (NOT `@ai-sdk/google` or other direct providers)
- AI model configurable via env var (e.g., `OPENROUTER_MODEL=google/gemini-2.0-flash-001`)
- All AI calls happen in `packages/backend` (Convex Actions)

---

# Ultracite Code Standards

This project uses **Ultracite**, a zero-config preset that enforces strict code quality standards through automated formatting and linting.

## Quick Reference

- **Format code**: `pnpm dlx ultracite fix`
- **Check for issues**: `pnpm dlx ultracite check`
- **Diagnose setup**: `pnpm dlx ultracite doctor`

Oxlint + Oxfmt (the underlying engine) provides robust linting and formatting. Most issues are automatically fixable.

---

## Core Principles

Write code that is **accessible, performant, type-safe, and maintainable**. Focus on clarity and explicit intent over brevity.

### Type Safety & Explicitness

- Use explicit types for function parameters and return values when they enhance clarity
- Prefer `unknown` over `any` when the type is genuinely unknown
- Use const assertions (`as const`) for immutable values and literal types
- Leverage TypeScript's type narrowing instead of type assertions
- Use meaningful variable names instead of magic numbers - extract constants with descriptive names

### Modern JavaScript/TypeScript

- Use arrow functions for callbacks and short functions
- Prefer `for...of` loops over `.forEach()` and indexed `for` loops
- Use optional chaining (`?.`) and nullish coalescing (`??`) for safer property access
- Prefer template literals over string concatenation
- Use destructuring for object and array assignments
- Use `const` by default, `let` only when reassignment is needed, never `var`

### Async & Promises

- Always `await` promises in async functions - don't forget to use the return value
- Use `async/await` syntax instead of promise chains for better readability
- Handle errors appropriately in async code with try-catch blocks
- Don't use async functions as Promise executors

### React & JSX

- Use function components over class components
- Call hooks at the top level only, never conditionally
- Specify all dependencies in hook dependency arrays correctly
- Use the `key` prop for elements in iterables (prefer unique IDs over array indices)
- Nest children between opening and closing tags instead of passing as props
- Don't define components inside other components
- Use semantic HTML and ARIA attributes for accessibility:
  - Provide meaningful alt text for images
  - Use proper heading hierarchy
  - Add labels for form inputs
  - Include keyboard event handlers alongside mouse events
  - Use semantic elements (`<button>`, `<nav>`, etc.) instead of divs with roles

### Error Handling & Debugging

- Remove `console.log`, `debugger`, and `alert` statements from production code
- Throw `Error` objects with descriptive messages, not strings or other values
- Use `try-catch` blocks meaningfully - don't catch errors just to rethrow them
- Prefer early returns over nested conditionals for error cases

### Code Organization

- Keep functions focused and under reasonable cognitive complexity limits
- Extract complex conditions into well-named boolean variables
- Use early returns to reduce nesting
- Prefer simple conditionals over nested ternary operators
- Group related code together and separate concerns

### Security

- Add `rel="noopener"` when using `target="_blank"` on links
- Avoid `dangerouslySetInnerHTML` unless absolutely necessary
- Don't use `eval()` or assign directly to `document.cookie`
- Validate and sanitize user input

### Performance

- Avoid spread syntax in accumulators within loops
- Use top-level regex literals instead of creating them in loops
- Prefer specific imports over namespace imports
- Avoid barrel files (index files that re-export everything)
- Use proper image components (e.g., Next.js `<Image>`) over `<img>` tags

### React 19

- Use ref as a prop instead of `React.forwardRef`

---

## Testing

- Write assertions inside `it()` or `test()` blocks
- Avoid done callbacks in async tests - use async/await instead
- Don't use `.only` or `.skip` in committed code
- Keep test suites reasonably flat - avoid excessive `describe` nesting

## When Oxlint + Oxfmt Can't Help

Oxlint + Oxfmt's linter will catch most issues automatically. Focus your attention on:

1. **Business logic correctness** - Oxlint + Oxfmt can't validate your algorithms
2. **Meaningful naming** - Use descriptive names for functions, variables, and types
3. **Architecture decisions** - Component structure, data flow, and API design
4. **Edge cases** - Handle boundary conditions and error states
5. **User experience** - Accessibility, performance, and usability considerations
6. **Documentation** - Add comments for complex logic, but prefer self-documenting code

---

Most formatting and common issues are automatically fixed by Oxlint + Oxfmt. Run `pnpm dlx ultracite fix` before committing to ensure compliance.

---

## shadcn CLI

Use `pnpm dlx shadcn@latest` for all shadcn commands. Never default to `npx`. If installed locally, use `pnpm shadcn`.

### CLI operations

| When you need to… | Command |
| --- | --- |
| List configured registries | `pnpm dlx shadcn@latest info --json` → read `config.registries` |
| List all items in a registry | `pnpm dlx shadcn@latest list <registry...> --limit <n> --offset <n>` |
| Search for a component by name/description | `pnpm dlx shadcn@latest search <registry...> --query "<q>" --limit <n> --offset <n>` |
| Inspect a registry item's files before installing | `pnpm dlx shadcn@latest view <item...>` |
| Build the install command for one or more items | Construct string: `pnpm dlx shadcn@latest add <item...>` — do not execute unless requested |
| Find usage examples for a component | 1. `search` to resolve item; 2. `docs <component> --json` → fetch `results[].links.examples`; 3. fallback: `view <item>` for community registries |
| Verify a component was added correctly | `info --json` + `add <item> --dry-run` + `--diff` per file + validate aliases/`base`/`iconLibrary` from config |

---

## Monorepo shadcn Install Target

- This repo has multiple valid shadcn projects (`apps/web` and `packages/ui`), each with its own `components.json`.
- Never assume install target when a request is ambiguous.
- If the user does not explicitly name the target package/path, ask which project should receive the component before running any `shadcn add` command.
- Suggested default guidance when asking:
  - Shared/reusable UI primitives and components -> `packages/ui`
  - App-specific blocks/composed sections/pages -> `apps/web`
- When the user explicitly specifies a target, install only in that target.
