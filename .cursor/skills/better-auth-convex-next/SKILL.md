---
name: better-auth-convex-next
description: Use this skill for any Next.js task that combines Better Auth and Convex, not only UI auth flows. Load it when the user asks about integration, setup, migration, or debugging of Better Auth + Convex (client sign-in/out behavior, `auth.ts`/`createAuth`, Convex `auth.api` usage, session/header handling, SSR preload patterns, server actions, or `fetchAuth*`/`preloadAuth*` utilities), and also when the agent is about to edit any of those areas even if the user did not name them explicitly.
---

# Using Better Auth with Convex in Next.js

## Server side authentication

Better Auth supports signing users in and out through server side functions. Because Convex functions run over websockets and don't return HTTP responses or set cookies, signing up/in/out must be done from the client via authClient.signIn.\* methods.

## Using server methods with auth.api

Better Auth's server side auth.api methods can be used with your createAuth function and the component headers method. Here's an example implementing the changePassword server method.

```
export const updateUserPassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    // Many Better Auth server methods require a currently authenticated
    // user, so request headers have to be passed in so session cookies
    // can be parsed and validated. The `getAuth` method provides both the
    // auth object and headers for convenience.
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.changePassword({
      body: {
        currentPassword: args.currentPassword,
        newPassword: args.newPassword,
      },
      headers,
    });
  },
});
```

## Using Convex ctx in Better Auth config

The ctx param passed in to the createAuth function is the Convex context object. This can be used to access the Convex database or Convex functions in your Better Auth config. It can be a query, mutation, or action context.

A common use case is sending emails for verification or password resets with the Resend component. resend.sendEmail will produce a type error because the ctx object could be a query ctx. The component provides type guards for this.

```
import { requireActionCtx } from "@convex-dev/better-auth/utils";
import { type GenericCtx } from "@convex-dev/better-auth";
import { Resend } from "@convex-dev/resend";
import { components } from "./_generated/api";
import { type DataModel } from "./_generated/dataModel";
export const resend = new Resend(components.resend);
export const createAuthOptions = (ctx: GenericCtx<DataModel>) => ({
  baseURL: siteUrl,
  sendVerificationEmail: async ({ user, url }) => {
    // This function only requires a `runMutation` property on the ctx object,
    // but we'll make sure we have an action ctx because we know a network
    // request is being made, which requires an action ctx.
    await resend.sendEmail(requireActionCtx(ctx), {
      to: user.email,
      subject: "Verify your email",
      html: `<p>Click <a href="${url}">here</a> to verify your email</p>`,
    });
  },
});
```

## SSR with server components

Convex queries can be preloaded in server components and rendered in client components via preloadAuthQuery and usePreloadedAuthQuery.

Preloading in a server component:

app/(auth)/(dashboard)/page.tsx

```
import { preloadAuthQuery } from "@/lib/auth-server";
import { api } from "@/convex/_generated/api";
const Page = async () => {
  const [preloadedUserQuery] = await Promise.all([
    preloadAuthQuery(api.auth.getCurrentUser),
    // Load multiple queries in parallel if needed
  ]);
  return (
    <div>
      <Header preloadedUserQuery={preloadedUserQuery} />
    </div>
  );
};
export default Page;
Rendering preloaded data in a client component:
```

app/(auth)/(dashboard)/header.tsx

```
import { usePreloadedAuthQuery } from "@convex-dev/better-auth/nextjs/client";
import { api } from "@/convex/_generated/api";
export const Header = ({
  preloadedUserQuery,
}: {
  preloadedUserQuery: Preloaded<typeof api.auth.getCurrentUser>;
}) => {
  const user = usePreloadedAuthQuery(preloadedUserQuery);
  return (
    <div>
      <h1>{user?.name}</h1>
    </div>
  );
};
export default Header;
```

## Using Better Auth in server code

Better Auth's auth.api methods would normally run in your Next.js server code, but with Convex being your backend, these methods need to run in a Convex function. The Convex function can then be called from the client via hooks like useMutation or in server functions and other server code using one of the auth-server utilities like fetchAuthMutation. Authentication is handled automatically using session cookies.

Here's an example using the changePassword method. The Better Auth auth.api method is called inside of a Convex mutation, because we know this function needs write access. For reads a query function can be used.

convex/users.ts

```
import { mutation } from "./_generated/server";
import { v } from "convex/values";
import { createAuth, authComponent } from "./auth";
export const updateUserPassword = mutation({
  args: {
    currentPassword: v.string(),
    newPassword: v.string(),
  },
  handler: async (ctx, args) => {
    const { auth, headers } = await authComponent.getAuth(createAuth, ctx);
    await auth.api.changePassword({
      body: {
        currentPassword: args.currentPassword,
        newPassword: args.newPassword,
      },
      headers,
    });
  },
});

Here we call the mutation from a server action.

app/actions.ts
```

"use server";
import { fetchAuthMutation } from "@/lib/auth-server";
import { api } from "../convex/\_generated/api";
// Authenticated mutation via server function
export async function updatePassword({
currentPassword,
newPassword,
}: {
currentPassword: string;
newPassword: string;
}) {
await fetchAuthMutation(api.users.updatePassword, {
currentPassword,
newPassword,
});
}

```

```