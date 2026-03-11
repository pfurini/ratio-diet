---
name: Fix oxlint errors
overview: Fix 18 oxlint errors found by `pnpm check`, covering func-style, nested ternaries, max-statements, non-null assertions, parent imports, and require-await (skipping filename-case).
todos:
  - id: func-style-all
    content: Convert all 9 function declarations to arrow function expressions across 9 files
    status: completed
  - id: nested-ternary
    content: Extract nested ternaries in page.tsx into helper functions
    status: completed
  - id: max-statements
    content: Extract useChatActions hook from ai/page.tsx to reduce statement counts
    status: completed
  - id: non-null-assertion
    content: Replace process.env.SITE_URL! with runtime validation in auth.ts
    status: completed
  - id: parent-import
    content: Change ../index.css to @/index.css in layout.tsx
    status: completed
  - id: require-await
    content: Remove async from healthCheck handler
    status: completed
  - id: verify
    content: Run pnpm check to confirm 18 errors are resolved (2 filename-case errors intentionally skipped)
    status: completed
isProject: false
---

# Fix 18 Oxlint Errors (Skipping filename-case)

## Error Inventory


| Rule | Count | Files |
| ---- | ----- | ----- |


`**func-style**` (9 errors) -- function declarations must be arrow function expressions:

- [theme-provider.tsx](apps/web/src/components/theme-provider.tsx) `ThemeProvider`
- [mode-toggle.tsx](apps/web/src/components/mode-toggle.tsx) `ModeToggle`
- [auth.ts](packages/backend/convex/auth.ts) `createAuth`
- [utils.ts](packages/ui/src/lib/utils.ts) `cn`
- [ai/page.tsx](apps/web/src/app/ai/page.tsx) `MessageContent`, `AIPage`
- [header.tsx](apps/web/src/components/header.tsx) `Header`
- [page.tsx](apps/web/src/app/page.tsx) `Home`
- [dashboard/page.tsx](apps/web/src/app/dashboard/page.tsx) `DashboardPage`

`**no-nested-ternary**` (4 errors, 2 eslint + 2 unicorn) -- nested ternaries forbidden:

- [page.tsx](apps/web/src/app/page.tsx) lines 32 and 35

`**max-statements**` (2 errors) -- too many statements (max 10):

- [ai/page.tsx](apps/web/src/app/ai/page.tsx) `AIPage` (11 stmts), `handleSubmit` (14 stmts)

`**no-non-null-assertion**` (1 error):

- [auth.ts](packages/backend/convex/auth.ts) line 11: `process.env.SITE_URL!`

`**no-relative-parent-imports**` (1 error):

- [layout.tsx](apps/web/src/app/layout.tsx) line 4: `import '../index.css'`

`**require-await**` (1 error):

- [healthCheck.ts](packages/backend/convex/healthCheck.ts) line 4: `async` handler with no `await`

---

## Fix Strategy

### 1. func-style: Convert function declarations to arrow expressions

Pattern: `export function Foo() { ... }` becomes `export const Foo = () => { ... };`

For default exports, change to named const + `export default`:

```typescript
// Before
export default function Home() { ... }

// After
const Home = () => { ... };
export default Home;
```

Files to change: `theme-provider.tsx`, `mode-toggle.tsx`, `auth.ts`, `utils.ts`, `ai/page.tsx` (2 functions), `header.tsx`, `page.tsx`, `dashboard/page.tsx`.

Note: [layout.tsx](apps/web/src/app/layout.tsx) `RootLayout` is async; same pattern applies: `const RootLayout = async (...) => { ... }; export default RootLayout;`

### 2. no-nested-ternary: Extract helper in page.tsx

Replace the nested ternaries on lines 32 and 35 with a helper function or variable:

```typescript
const getStatusColor = (status: string | undefined) => {
  if (status === "OK") return "bg-green-500";
  if (status === undefined) return "bg-orange-400";
  return "bg-red-500";
};

const getStatusText = (status: string | undefined) => {
  if (status === undefined) return "Checking...";
  if (status === "OK") return "Connected";
  return "Error";
};
```

Then use `getStatusColor(healthCheck)` and `getStatusText(healthCheck)` in JSX.

### 3. max-statements: Decompose AIPage

Split [ai/page.tsx](apps/web/src/app/ai/page.tsx) into smaller pieces:

- Extract `handleSubmit` logic into a custom hook (e.g., `useChatSubmit`) that encapsulates `threadId` management, `createThread`, `sendMessage`, and loading state. This reduces both `AIPage` statement count and `handleSubmit` statement count below 10.
- Alternatively, extract `handleSubmit` into a standalone function that takes its dependencies as parameters.

Recommended approach -- extract a `useChatActions` hook:

```typescript
const useChatActions = () => {
  const [threadId, setThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const createThread = useMutation(api.chat.createNewThread);
  const sendMessage = useMutation(api.chat.sendMessage);

  const handleSubmit = async (text: string) => {
    setIsLoading(true);
    try {
      const currentThreadId = threadId ?? await createThread();
      if (!threadId) setThreadId(currentThreadId);
      await sendMessage({ prompt: text, threadId: currentThreadId });
    } catch (error) {
      console.error("Failed to send message:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return { threadId, isLoading, handleSubmit };
};
```

This reduces `AIPage` to ~7 statements and `handleSubmit` to ~6 statements.

### 4. no-non-null-assertion: Validate env var at runtime

In [auth.ts](packages/backend/convex/auth.ts) line 11, replace:

```typescript
const siteUrl = process.env.SITE_URL!;
```

with a runtime guard:

```typescript
const siteUrl = process.env.SITE_URL;
if (!siteUrl) {
  throw new Error("SITE_URL environment variable is required");
}
```

### 5. no-relative-parent-imports: Use path alias for CSS

In [layout.tsx](apps/web/src/app/layout.tsx) line 4, replace:

```typescript
import '../index.css';
```

with:

```typescript
import '@/index.css';
```

The project already has `@/` mapped to `src/` via tsconfig paths (used elsewhere, e.g., `@/components/header`).

### 6. require-await: Remove unnecessary async

In [healthCheck.ts](packages/backend/convex/healthCheck.ts), change:

```typescript
handler: async () => 'OK',
```

to:

```typescript
handler: () => 'OK',
```

---

## Execution Order

Apply all fixes in any order (no dependencies between them). Finally, run `pnpm check` to verify only the 2 intentionally skipped `filename-case` errors remain.