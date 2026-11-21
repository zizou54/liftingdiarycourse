# Auth Standards

These standards apply to **everything** to do with authentication and authorization in this project. They are not optional, and breaking them is a bug, even if the code works.

## 1. Clerk is the ONLY auth provider

> ⚠️ **This app uses [Clerk](https://clerk.com) (`@clerk/nextjs` v7) for ALL authentication.** There are **NO exceptions**.

- ✅ Sign-in, sign-up, sign-out, sessions, and user profiles are all handled by Clerk.
- ❌ Do **NOT** add another auth library (NextAuth/Auth.js, Lucia, Better Auth, Supabase Auth, Neon Auth, Firebase Auth, etc.).
- ❌ Do **NOT** build custom auth: no password hashing, no hand-rolled session cookies or JWTs, no `users` table with credentials, no custom login forms that post credentials to our own server.
- ❌ Do **NOT** read or decode Clerk's session cookies or tokens yourself. Always go through Clerk's APIs.
- The Clerk user id (`userId`, a string like `user_...`) is the **only** user identifier. Tables that own per-user data store it in a `userId` column.

## 2. Use the right import for the right place

| Where                                                   | Import from              | Use                                                                 |
| ------------------------------------------------------- | ------------------------ | ------------------------------------------------------------------- |
| Server Components, Server Actions, `src/data/` helpers  | `@clerk/nextjs/server`   | `auth()`, `currentUser()`                                           |
| `src/proxy.ts`                                          | `@clerk/nextjs/server`   | `clerkMiddleware()`, `createRouteMatcher()`                         |
| Client Components and layouts (UI only)                 | `@clerk/nextjs`          | `<ClerkProvider>`, `<Show>`, `<SignInButton>`, `<SignUpButton>`, `<UserButton>`, `useUser()`, `useAuth()` |

- `auth()` is async. Always `await auth()`.
- Prefer `auth()` (cheap, reads the session) over `currentUser()` (makes a network call to Clerk). Only use `currentUser()` when you actually need profile fields such as name or email.
- Client-side hooks (`useUser`, `useAuth`) are for **UI only** (e.g. showing a name or toggling a button). **Never** use them to decide what data a user may access.

## 3. Protect routes in `src/proxy.ts`

> ℹ️ In this version of Next.js, middleware is called **proxy** and lives in `src/proxy.ts`. Don't create a `middleware.ts`.

- `clerkMiddleware()` is the default export of `src/proxy.ts`. Don't remove it or narrow its `matcher`; Clerk needs it to run on every page and on `/__clerk/*`.
- Every route that requires a logged-in user MUST be listed in the `isProtectedRoute` matcher and protected with `auth.protect()`:

```ts
// src/proxy.ts
const isProtectedRoute = createRouteMatcher(['/dashboard(.*)', '/workouts(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});
```

- When you add a new signed-in-only page, **add its path to `isProtectedRoute` in the same change**.

## 4. The proxy is NOT enough. Check auth where the data is

> 🔒 **This is incredibly important.** Route protection in the proxy is a convenience for redirecting signed-out users. It is **not** the security boundary.

Every place that reads or changes user data MUST check auth itself:

- **`src/data/` helpers** get the user id with `await auth()` and throw if there is none. See `docs/data-fetching.md` §4 for the full rules (never accept `userId` as a parameter, filter every query by `userId`, etc.).
- **Server Actions** are public HTTP endpoints. Each one MUST call `await auth()` (directly or via a `src/data/` helper) and reject the call if there is no `userId`, even if the page that renders the form is protected.
- **Never trust a user id from the client**: not from props, search params, form data, cookies, headers, or the request body. The only trusted source is `auth()` on the server.

```ts
// src/data/workouts.ts
import 'server-only';
import { connection } from 'next/server';
import { auth } from '@clerk/nextjs/server';

async function requireUserId() {
  await connection(); // only run for a real request
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}
```

## 5. Auth UI uses Clerk components

- Use Clerk's prebuilt components for all auth UI: `<SignInButton>`, `<SignUpButton>`, `<UserButton>`, and (if full pages are needed) `<SignIn>` / `<SignUp>`.
- Show or hide UI by auth state with `<Show when="signed-in">` / `<Show when="signed-out">`. (Clerk v7 replaced `<SignedIn>` / `<SignedOut>` with `<Show>`.)
- Components that read auth state on the server must sit inside a `<Suspense>` boundary (this app uses Cache Components).
- `<ClerkProvider>` wraps the app once, in `src/app/layout.tsx`. Don't add a second one.
- Styling of custom trigger elements (e.g. the child of `<SignUpButton>`) still follows `docs/ui.md`, so use shadcn/ui components such as `Button`.

## 6. Secrets and configuration

- Clerk keys live in `.env.local` only: `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`.
- **Never** commit `.env.local`, and never hard-code keys in source.
- `CLERK_SECRET_KEY` must never be used in, or passed to, client code. Only `NEXT_PUBLIC_*` values may reach the browser.

## Checklist

Before you merge any code that touches auth or user data, check:

- [ ] Auth is done with Clerk only. No other auth library or custom auth code.
- [ ] Server code uses `auth()` / `currentUser()` from `@clerk/nextjs/server`, and `auth()` is awaited.
- [ ] New signed-in-only routes are added to `isProtectedRoute` in `src/proxy.ts`.
- [ ] Every `src/data/` helper and Server Action checks `userId` from `auth()` itself and rejects when it is missing.
- [ ] No user id is taken from the client.
- [ ] Auth UI uses Clerk components (`<Show>`, `<SignInButton>`, `<UserButton>`, ...).
- [ ] No Clerk secrets are committed or exposed to the client.
