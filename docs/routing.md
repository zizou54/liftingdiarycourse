# Routing Standards

These standards apply to **every** route (page, layout, route segment) in this project. They are not optional, and breaking them is a bug, even if the code works.

## 1. All app routes live under `/dashboard`

> ⚠️ **Every feature page of this app MUST be reached through `/dashboard`.** There are **NO exceptions**.

- ✅ The app's pages live in `src/app/dashboard/` and its sub folders, so their URLs start with `/dashboard`.
- ❌ Do **NOT** add feature routes at the top level (e.g. `/workouts`, `/exercises`, `/settings`, `/profile`). Put them under `/dashboard` instead (`/dashboard/workout/...`, `/dashboard/settings`, ...).
- The only route outside `/dashboard` is the public landing page `/` (`src/app/page.tsx`), plus any Clerk sign-in / sign-up pages if they are added. Nothing that shows or changes user data may live outside `/dashboard`.

Current route map:

| URL                                   | File                                              |
| ------------------------------------- | ------------------------------------------------- |
| `/`                                   | `src/app/page.tsx` (public landing page)          |
| `/dashboard`                          | `src/app/dashboard/page.tsx`                      |
| `/dashboard/workout/new`              | `src/app/dashboard/workout/new/page.tsx`          |
| `/dashboard/workout/[workoutId]`      | `src/app/dashboard/workout/[workoutId]/page.tsx`  |

When you add a route, add it to this table in the same change.

## 2. Folder and URL conventions

- One folder per URL segment, with a `page.tsx` inside. Use lowercase, kebab-case folder names (`workout-history`, not `WorkoutHistory`).
- Dynamic segments use a descriptive camelCase name in brackets: `[workoutId]`, not `[id]`.
- `params` and `searchParams` are Promises. Await them and validate them as described in `docs/server-components.md`.
- Shared UI for every dashboard page (nav, header) goes in `src/app/dashboard/layout.tsx`, not copied into each page.
- Link with `next/link` (`<Link href="/dashboard/workout/new">`) and navigate with `useRouter()` from `next/navigation` on the client. Always write full `/dashboard/...` paths; never build links to routes outside `/dashboard` for app features.
- After a Server Action resolves, navigate on the client (e.g. `router.push('/dashboard')`). Don't call `redirect()` in actions (see `docs/data-mutations.md`).

## 3. `/dashboard` and all its sub pages are protected

> 🔒 **`/dashboard` and every route below it are only reachable by logged-in users.**

Route protection is done in the **Next.js middleware**, using Clerk.

> ℹ️ In this version of Next.js (16), middleware has been renamed to **proxy**. The file is `src/proxy.ts`, not `middleware.ts`. Don't create a `middleware.ts`; it is deprecated. See `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

```ts
// src/proxy.ts
import { clerkMiddleware, createRouteMatcher } from '@clerk/nextjs/server';

const isProtectedRoute = createRouteMatcher(['/dashboard(.*)']);

export default clerkMiddleware(async (auth, req) => {
  if (isProtectedRoute(req)) await auth.protect();
});
```

- The matcher `'/dashboard(.*)'` covers `/dashboard` and **all** sub pages. Because every app route lives under `/dashboard` (§1), new pages are protected automatically, so don't add per-page entries.
- ❌ Do **NOT** remove or narrow the `'/dashboard(.*)'` matcher, and don't change the `config.matcher` in `src/proxy.ts`. Clerk needs it to run on every page.
- ❌ Do **NOT** protect pages by hand in pages or layouts (e.g. `if (!userId) redirect('/')` in `page.tsx` or `layout.tsx`). Redirecting signed-out users is the proxy's job.
- Signed-out users who open a protected URL are sent to sign in by `auth.protect()`. Don't build custom redirect logic for this.

## 4. The proxy is not the security boundary

Proxy protection only decides who can **open a page**. It does not protect data. Every `src/data/` helper and every Server Action still MUST check `auth()` itself (see `docs/auth.md` §4 and `docs/data-fetching.md`).

## Checklist

Before you merge any code that adds or changes a route, check:

- [ ] The new page lives under `src/app/dashboard/` and its URL starts with `/dashboard`.
- [ ] No new feature route was added at the top level.
- [ ] Folder names are kebab-case; dynamic segments have descriptive names (`[workoutId]`).
- [ ] `src/proxy.ts` still protects `'/dashboard(.*)'`, and no `middleware.ts` was added.
- [ ] No hand-written auth redirects in pages or layouts.
- [ ] Links and client navigation use full `/dashboard/...` paths.
- [ ] The route map in §1 is updated.
