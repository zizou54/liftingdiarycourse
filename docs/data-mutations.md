# Data Mutation Standards

These standards apply to **all** data mutations (creating, updating, and deleting data) in this project. They are not optional, and breaking them is a bug, even if the code works.

They build on `docs/data-fetching.md` (helpers in `src/data/`, Drizzle only, user scoping) and `docs/auth.md` (Clerk `auth()` checks). Follow those too.

## 1. Database writes ONLY via helpers in `src/data/`

> ⚠️ **Every** `insert`, `update`, and `delete` MUST live in a helper function inside the `src/data/` directory (alias `@/data`). These helpers wrap the Drizzle ORM calls.

- Server Actions, pages, layouts, and components **never** import `db` from `@/db` directly. They call `@/data/*` helpers.
- Put mutation helpers next to the read helpers for the same domain: `src/data/workouts.ts`, `src/data/exercises.ts`, and so on.
- Every file in `src/data/` MUST start with `import 'server-only';`.
- Use the Drizzle query builder (`db.insert()`, `db.update()`, `db.delete()`) with Drizzle operators (`eq`, `and`, ...). **No raw SQL**: no `sql\`...\``, no `db.execute(...)`, no string-built SQL.
- When a mutation touches several tables (e.g. a workout plus its exercises and sets), do it in **one** helper inside `db.transaction(async (tx) => { ... })`, so it either fully succeeds or fully fails.
- Return only what the caller needs (e.g. the new row's `id`), using `.returning({ ... })`.

### User scoping rules (from `docs/data-fetching.md` §4)

1. The helper gets `userId` from `auth()` **itself** and throws if there is none. **Never** accept `userId` as a parameter.
2. **Inserts** set `userId` from `auth()`, never from the input.
3. **Updates and deletes** MUST filter by **both** `id` **and** `userId` in their `where` clause.
4. **Child tables** (`workout_exercises`, `sets`) have no `userId` column. Before writing to them, check that the user owns the parent `workout` (and that any referenced `exercise` is the user's own).
5. If nothing was updated or deleted for this user, treat it as not found. Don't reveal whether the row exists for someone else.

### Example helpers

```ts
// src/data/workouts.ts
import 'server-only';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { db } from '@/db';
import { workouts } from '@/db/schema';

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

export async function createWorkout(data: { name: string | null; startedAt: Date }) {
  const userId = await requireUserId();

  const [workout] = await db
    .insert(workouts)
    .values({ ...data, userId }) // userId ALWAYS comes from auth()
    .returning({ id: workouts.id });

  return workout;
}

export async function updateWorkoutName(id: string, name: string | null) {
  const userId = await requireUserId();

  const [workout] = await db
    .update(workouts)
    .set({ name })
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId))) // id AND userId
    .returning({ id: workouts.id });

  return workout ?? null; // null = not found for this user
}

export async function deleteWorkout(id: string) {
  const userId = await requireUserId();

  const [workout] = await db
    .delete(workouts)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId)))
    .returning({ id: workouts.id });

  return workout ?? null;
}
```

## 2. Mutations ONLY via Server Actions in colocated `actions.ts` files

> ⚠️ **ALL** data mutations MUST be triggered through **Server Actions**. There are **NO exceptions**.

Data must **NOT** be mutated:

- ❌ via **Route Handlers** (`app/**/route.ts`), so no `POST` / `PUT` / `PATCH` / `DELETE` endpoints
- ❌ via **Server Components** during render
- ❌ via **Client Components** calling a third-party API or fetch endpoint
- ❌ via **inline Server Actions** (`'use server'` inside a component body or a page file)

✅ The **only** allowed pattern: a Server Action exported from a file named **`actions.ts`**, **colocated** with the route that uses it.

```
src/app/dashboard/
  page.tsx
  actions.ts        ← Server Actions for the dashboard
src/app/workouts/new/
  page.tsx
  workout-form.tsx
  actions.ts        ← Server Actions for the new-workout form
```

- The file MUST start with `'use server';` at the top, so every export is a Server Action.
- Only export `async` Server Actions from `actions.ts`. Keep Zod schemas and other helpers in the file without exporting them (or move shared schemas to a non-`'use server'` module).
- An action does four things, in this order: **validate** the input with Zod → **call** a `src/data/` helper → **revalidate** affected routes (`revalidatePath` / `updateTag` from `next/cache`) → **return** a typed result.
- Actions contain **no** database code. All DB work goes through `src/data/` helpers.
- Server Actions are public HTTP endpoints. The `src/data/` helper they call MUST check `auth()` (see `docs/auth.md` §4), even if the page is protected.

### Redirects happen client side, NEVER in the action

> ⚠️ **Do NOT** call `redirect()` (or `permanentRedirect()`) from `next/navigation` inside a Server Action.

- ✅ The action returns a typed result (e.g. `{ success: true, data: { id } }`). The Client Component that called it awaits the result and then navigates with `router.push(...)` / `router.replace(...)` from `useRouter()` (`next/navigation`).
- Only navigate on success. On failure, stay on the page and show the error.
- This keeps every action's outcome explicit and typed, and lets the client build URLs from values only the browser knows (e.g. the user's time zone).

```tsx
// src/app/workouts/new/workout-form.tsx
'use client';

const router = useRouter();

startTransition(async () => {
  const result = await createWorkoutAction({ name, startedAt });
  if (!result.success) {
    setError(result.error); // stay on the page
    return;
  }
  router.push('/dashboard'); // redirect AFTER the action resolves, on the client
});
```

## 3. Server Action parameters MUST be typed, and NEVER `FormData`

> ⚠️ Every Server Action parameter MUST have an explicit TypeScript type. **Do NOT** use `FormData` as a parameter type.

- ✅ Accept a single, typed object (e.g. `input: CreateWorkoutInput`) or typed primitives (`id: string`).
- ❌ No `formData: FormData`, no `any`, no untyped parameters.
- Derive the input type from the Zod schema with `z.infer<typeof schema>`, so the type and the validation never drift apart.
- In the Client Component, build the typed object from the form state and call the action directly (e.g. inside `startTransition` or an event handler). Don't pass the action to `<form action={...}>` in a way that makes it receive `FormData`.

```tsx
// src/app/workouts/new/workout-form.tsx
'use client';

import { useTransition } from 'react';
import { createWorkoutAction } from './actions';

// ...
const [isPending, startTransition] = useTransition();

function handleSubmit() {
  startTransition(async () => {
    const result = await createWorkoutAction({ name, startedAt }); // typed object, not FormData
    if (!result.success) setError(result.error);
  });
}
```

## 4. ALL Server Actions MUST validate their arguments with Zod

> 🔒 **This is incredibly important.** TypeScript types are erased at runtime. Anyone can call a Server Action with **any** payload, so every action MUST validate **every** argument with [Zod](https://zod.dev) before doing anything else.

- Define a Zod schema for each action's input in its `actions.ts`.
- Parse with `schema.safeParse(input)` as the **first** step. If it fails, return an error result and do **not** call any data helper.
- Only pass the **parsed** data (`parsed.data`) to the data helper, never the raw input.
- Make schemas strict about what the DB expects: `z.uuid()` for ids, `.trim().min(1).max(...)` for text, `z.number().int().nonnegative()` for reps, `z.coerce.date()` (or `z.iso.date()` for `YYYY-MM-DD` strings) for dates, and so on.
- **Never** include `userId` in a schema. It always comes from `auth()` inside the data helper.
- Zod is the only validation library. Don't hand-roll checks or add another validator. (Install it as a direct dependency with `npm install zod` if it isn't in `package.json` yet.)

### Example `actions.ts`

```ts
// src/app/workouts/new/actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createWorkout, deleteWorkout } from '@/data/workouts';

const createWorkoutSchema = z.object({
  name: z.string().trim().max(100).nullable(),
  startedAt: z.coerce.date(),
});

type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function createWorkoutAction(
  input: CreateWorkoutInput,
): Promise<ActionResult<{ id: string }>> {
  // 1. Validate. Never trust the input.
  const parsed = createWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid workout data' };
  }

  // 2. Mutate via a src/data/ helper (it checks auth() and scopes by userId).
  const workout = await createWorkout(parsed.data);

  // 3. Revalidate what changed.
  revalidatePath('/dashboard');

  // 4. Return a result.
  return { success: true, data: workout };
}

const deleteWorkoutSchema = z.object({ id: z.uuid() });

export async function deleteWorkoutAction(
  input: z.infer<typeof deleteWorkoutSchema>,
): Promise<ActionResult> {
  const parsed = deleteWorkoutSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid workout id' };

  const deleted = await deleteWorkout(parsed.data.id);
  if (!deleted) return { success: false, error: 'Workout not found' };

  revalidatePath('/dashboard');
  return { success: true, data: undefined };
}
```

## Checklist

Before you merge any code that creates, updates, or deletes data, check:

- [ ] The DB write lives in a helper in `src/data/` that starts with `import 'server-only'` and uses Drizzle (no raw SQL).
- [ ] The helper gets `userId` from `auth()` itself; inserts set it, updates/deletes filter by `id` **and** `userId`.
- [ ] Writes to child tables check that the user owns the parent first; multi-table writes use a transaction.
- [ ] The mutation is triggered by a Server Action exported from a colocated `actions.ts` that starts with `'use server'`.
- [ ] Every action parameter is explicitly typed (via `z.infer`), and none is `FormData`.
- [ ] Every action validates its input with Zod `safeParse` first, and passes only `parsed.data` on.
- [ ] No `userId` is accepted from the client or included in a Zod schema.
- [ ] The action revalidates affected routes and returns a typed result.
- [ ] The action does not call `redirect()`. Any navigation happens client side with `useRouter()` after the action resolves successfully.
