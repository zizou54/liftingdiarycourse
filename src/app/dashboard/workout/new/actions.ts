'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { createWorkout } from '@/data/workouts';

const createWorkoutSchema = z.object({
  name: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .transform((name) => name || null), // empty name → null
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
