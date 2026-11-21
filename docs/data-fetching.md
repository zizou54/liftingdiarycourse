# Data Fetching Standards

These standards apply to **all** data fetching in this project. They are not optional, and breaking them is a bug, even if the code works.

## 1. Fetch data ONLY in Server Components

> ⚠️ **This is incredibly important.** ALL data fetching in this app MUST be done in **React Server Components**. There are **NO exceptions**.

Data must **NOT** be fetched:

- ❌ via **Route Handlers** (`app/**/route.ts`), so no `GET` endpoints that return data for the UI
- ❌ via **Client Components** (`'use client'`), so no `fetch` in `useEffect`, no SWR, no React Query, no `use(fetch(...))`
- ❌ via **Server Actions** used to *read* data
- ❌ via **any other approach** (API routes, `getServerSideProps`, middleware/proxy, third-party fetch libraries, etc.)

✅ The **only** allowed pattern: an `async` Server Component (usually a `page.tsx` or `layout.tsx`) calls a helper from `src/data/` and renders the result.

When a Client Component needs data (for interactivity such as a calendar or form state), the **parent Server Component fetches it and passes it down as props**. The Client Component never fetches data itself.

```tsx
// src/app/dashboard/page.tsx (Server Component, no 'use client')
import { getWorkoutsForDate } from '@/data/workouts';
import { WorkoutList } from './workout-list'; // may be a Client Component

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string; tz?: string }>;
}) {
  const { date, tz } = await searchParams; // validate these before use
  const workouts = await getWorkoutsForDate(date, tz);

  return <WorkoutList workouts={workouts} />;
}
```

Client-side state that changes *which* data is shown (e.g. the selected date) should go in the URL (search params). The Server Component then reads it and fetches again. Don't fetch from the client.

## 2. Database queries ONLY via helpers in `src/data/`

> ⚠️ **Every** database query MUST live in a helper function inside the `src/data/` directory (alias `@/data`).

- Pages, layouts, and components **never** import `db` from `@/db` directly. They call `@/data/*` helpers.
- Group helpers by domain: `src/data/workouts.ts`, `src/data/exercises.ts`, and so on.
- Every file in `src/data/` MUST start with `import 'server-only';` so it can never be bundled into client code.
- Every helper that returns per-user data MUST start with `await connection()` (from `next/server`). This app uses Cache Components and partial prefetching, so without it Next.js may try to run the helper while prerendering or prefetching. That fails on values like `new Date()`, and user data should only ever load for a real request anyway. The calling component must sit inside a `<Suspense>` boundary.

## 3. Use Drizzle ORM. NEVER raw SQL

> ⚠️ **DO NOT USE RAW SQL.** All queries MUST be written with Drizzle ORM.

- ✅ Use the Drizzle relational query API (`db.query.<table>.findMany / findFirst`) or the query builder (`db.select()`, `db.insert()`, `db.update()`, `db.delete()`) with Drizzle operators (`eq`, `and`, `gte`, `lt`, `inArray`, ...).
- ❌ No `sql\`...\`` template strings in queries, no `RAW:` filters, no `db.execute(...)`, no string-built SQL, no other database clients.
- Work out values such as date ranges in TypeScript (e.g. with date-fns) and pass them to Drizzle as plain values. Don't compute them in SQL.

## 4. Users may ONLY access their OWN data

> 🔒 **This is incredibly important.** A logged-in user must ONLY ever be able to read or change **their own** data. They must **NEVER** be able to access another user's data.

Rules every helper in `src/data/` MUST follow:

1. **Get the user id from Clerk inside the helper**, using `auth()` from `@clerk/nextjs/server`. **Never** accept `userId` as a parameter, and never trust a user id from props, search params, form data, cookies, or the request body.
2. **If there is no logged-in user, throw** (or return nothing). Never fall back to running an unscoped query.
3. **Every query MUST be filtered by `userId`.** This includes lookups by `id`: always filter by **both** `id` **and** `userId`. An `id` alone is never proof of ownership.
4. **Child tables** (`workout_exercises`, `sets`) have no `userId` column. Only reach them **through a parent row the user owns** (e.g. via `with:` from a `workouts` query filtered by `userId`). For writes, check that the user owns the parent `workout` before inserting, updating, or deleting child rows.
5. **Writes** (`update` / `delete`) MUST include `userId` in their `where` clause, so a guessed id can't touch someone else's row.
6. If a record isn't found **for this user**, treat it as not found (`null` → `notFound()`). Don't tell the user whether it exists for someone else.

### Example helper

```ts
// src/data/workouts.ts
import 'server-only';
import { connection } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';

async function requireUserId() {
  await connection(); // only run for a real request
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

export async function getWorkoutsBetween(start: Date, end: Date) {
  const userId = await requireUserId();

  return db.query.workouts.findMany({
    where: {
      userId, // ALWAYS scope to the current user
      startedAt: { gte: start, lt: end },
    },
    orderBy: { startedAt: 'asc' },
    with: {
      workoutExercises: {
        orderBy: { order: 'asc' },
        with: { exercise: true, sets: { orderBy: { setNumber: 'asc' } } },
      },
    },
  });
}

export async function getWorkoutById(id: string) {
  const userId = await requireUserId();

  // Filter by BOTH id and userId. Never by id alone.
  const workout = await db.query.workouts.findFirst({ where: { id, userId } });
  return workout ?? null;
}
```

## Checklist

Before you merge any code that reads or writes data, check:

- [ ] Data is fetched in a Server Component, not a Route Handler, Client Component, or Server Action read.
- [ ] The query lives in a helper in `src/data/` that starts with `import 'server-only'`.
- [ ] The query uses Drizzle ORM, with no `sql\`\``, `RAW`, or `db.execute`.
- [ ] The helper gets `userId` from `auth()` itself and filters **every** query by it.
- [ ] Child rows are only reached through a parent the user owns.
