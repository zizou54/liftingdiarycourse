'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { updateWorkout } from '@/data/workouts';

const updateWorkoutSchema = z.object({
  id: z.uuid(),
  name: z
    .string()
    .trim()
    .max(100)
    .nullable()
    .transform((name) => name || null), // empty name → null
  startedAt: z.coerce.date(),
});

type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>;

type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string };

export async function updateWorkoutAction(
  input: UpdateWorkoutInput,
): Promise<ActionResult<{ id: string }>> {
  // 1. Validate. Never trust the input.
  const parsed = updateWorkoutSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: 'Invalid workout data' };
  }

  // 2. Mutate via a src/data/ helper (it checks auth() and scopes by id AND userId).
  const { id, ...data } = parsed.data;
  const workout = await updateWorkout(id, data);
  if (!workout) {
    return { success: false, error: 'Workout not found' };
  }

  // 3. Revalidate what changed.
  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/workout/${id}`);

  // 4. Return a result.
  return { success: true, data: workout };
}
