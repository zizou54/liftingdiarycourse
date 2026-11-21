# Server Component Standards

These standards apply to **all** Server Components in this project: every `page.tsx`, `layout.tsx`, and any component without `'use client'`. They are not optional, and breaking them is a bug, even if the code works.

They build on `docs/data-fetching.md` (data is fetched only in Server Components, via `src/data/` helpers) and `docs/auth.md`. Follow those too.

> ℹ️ This project uses a modern Next.js (15+, currently 16) with **Cache Components** enabled (`cacheComponents: true` in `next.config.ts`). APIs differ from older versions. When in doubt, check `node_modules/next/dist/docs/`.

## 1. `params` and `searchParams` are Promises and MUST be awaited

> ⚠️ **This is incredibly important.** In this version of Next.js, the `params` and `searchParams` props passed to pages, layouts, and `generateMetadata` are **Promises**. You MUST `await` them before reading any value. There are **NO exceptions**.

- ✅ Type them as `Promise<...>` (or use the global `PageProps<'/route'>` / `LayoutProps<'/route'>` helpers) and `await` them inside an `async` Server Component.
- ❌ Do **NOT** read them synchronously (`params.workoutId`, `searchParams.date`). That is the old Next.js 14 API. It is deprecated, and the value is a Promise, not your data.
- ❌ Do **NOT** type them as plain objects (`{ params: { workoutId: string } }`). The type must be a Promise.
- ❌ Do **NOT** use `.then(...)` chains to read them. Use `await`, so every Server Component reads params the same way.
- Client Components don't receive these as data props from us. If a Client Component page needs them, use React's `use(params)` or the `useParams()` / `useSearchParams()` hooks. Never pass the raw Promise into client state.

```tsx
// ❌ WRONG: synchronous access, plain-object type
export default function Page({ params }: { params: { workoutId: string } }) {
  return <EditWorkout id={params.workoutId} />;
}
```

```tsx
// ✅ RIGHT: params is a Promise and is awaited
async function EditWorkoutContent({ params }: { params: Promise<{ workoutId: string }> }) {
  const { workoutId } = await params;
  // ...
}
```

The same applies to `generateMetadata`:

```tsx
export async function generateMetadata({ params }: PageProps<'/dashboard/workout/[workoutId]'>) {
  const { workoutId } = await params;
  // ...
}
```

## 2. Await params inside a `<Suspense>` boundary

With Cache Components, `params` and `searchParams` are **runtime data**: their values aren't known while the static shell is prerendered. Awaiting them must happen inside a `<Suspense>` boundary, otherwise the build fails or the whole page becomes blocking.

The pattern for this project:

1. The default-exported `page.tsx` component stays **non-async**. It renders the static parts (heading, layout) and a `<Suspense>` boundary.
2. It passes the **un-awaited** `params` / `searchParams` Promise down to an `async` child component.
3. The `async` child `await`s the Promise, validates the values, and fetches data.

```tsx
// src/app/dashboard/workout/[workoutId]/page.tsx
import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getWorkoutById } from '@/data/workouts';

type Params = Promise<{ workoutId: string }>;

export default function EditWorkoutPage({ params }: { params: Params }) {
  return (
    <main>
      <h1>Edit workout</h1>
      <Suspense fallback={<p>Loading workout…</p>}>
        <EditWorkoutContent params={params} />
      </Suspense>
    </main>
  );
}

async function EditWorkoutContent({ params }: { params: Params }) {
  const { workoutId } = await params; // ALWAYS await

  if (!z.uuid().safeParse(workoutId).success) notFound();

  const workout = await getWorkoutById(workoutId);
  if (!workout) notFound();

  // ...render
}
```

- In **layouts**, never `await params` at the top level of the layout itself. Pass the Promise down to the child that needs it and await it there, so the layout can still be prerendered.
- Use `loading.tsx` only if a whole-page fallback is really what you want. Prefer a focused `<Suspense>` around the part that needs the data.

## 3. Validate every param before using it

Params and search params come from the URL, so users can type **anything**. Treat them as untrusted input.

- Validate after awaiting, before passing values to a `src/data/` helper. Use Zod (e.g. `z.uuid()` for ids, `z.iso.date()` for `YYYY-MM-DD` dates).
- `searchParams` values can be `string`, `string[]`, or `undefined`. Handle all three.
- For invalid path params (malformed id, record not found **for this user**), call `notFound()` from `next/navigation`. Don't reveal whether the record exists for someone else.
- For invalid search params, fall back to a safe default (or show an empty state) instead of throwing.

## 4. Other Server Component rules

- Server Components are the default. Only add `'use client'` to a component that needs state, effects, event handlers, or browser APIs, and keep it as small as possible (e.g. a form), with the parent Server Component fetching data and passing it down as props.
- Components that fetch per-user data must be `async`, call `src/data/` helpers (never `db` directly), and sit inside a `<Suspense>` boundary.
- Only pass serializable props to Client Components (plain objects, strings, numbers, `Date`s, arrays). Pass only the fields the client needs, not whole database rows.
- Don't mutate data during render. Mutations go through Server Actions (see `docs/data-mutations.md`).

## Checklist

Before you merge any Server Component, check:

- [ ] `params` and `searchParams` are typed as Promises (or via `PageProps` / `LayoutProps`).
- [ ] Every read of `params` / `searchParams` uses `await`. No synchronous access, no `.then()`.
- [ ] The `await` happens in an `async` component inside a `<Suspense>` boundary, not at the top of a layout.
- [ ] Every param is validated before use, and invalid or not-owned records call `notFound()`.
- [ ] Data is fetched via `src/data/` helpers, and only serializable, minimal props go to Client Components.
