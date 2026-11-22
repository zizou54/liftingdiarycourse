'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import {
  addExerciseToWorkout,
  addSet,
  deleteSet,
  removeWorkoutExercise,
  updateSet,
  updateWorkout,
} from '@/data/workouts';

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

// --- Exercises & sets -------------------------------------------------------
// `workoutId` is only used to revalidate the page. Ownership is always checked
// by the data helpers from the row being changed.

function revalidateWorkout(workoutId: string) {
  revalidatePath('/dashboard');
  revalidatePath(`/dashboard/workout/${workoutId}`);
}

const setFields = {
  reps: z.number().int().min(0).max(1000),
  // Matches the numeric(6, 2) column; null = bodyweight.
  weight: z.number().min(0).max(9999.99).multipleOf(0.01).nullable(),
};

const addExerciseSchema = z.object({
  workoutId: z.uuid(),
  exercise: z.union([
    z.object({ exerciseId: z.uuid() }),
    z.object({ name: z.string().trim().min(1).max(100) }),
  ]),
});

export async function addExerciseAction(
  input: z.infer<typeof addExerciseSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addExerciseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid exercise' };

  const workoutExercise = await addExerciseToWorkout(parsed.data.workoutId, parsed.data.exercise);
  if (!workoutExercise) return { success: false, error: 'Workout or exercise not found' };

  revalidateWorkout(parsed.data.workoutId);
  return { success: true, data: workoutExercise };
}

const removeExerciseSchema = z.object({ workoutId: z.uuid(), workoutExerciseId: z.uuid() });

export async function removeExerciseAction(
  input: z.infer<typeof removeExerciseSchema>,
): Promise<ActionResult> {
  const parsed = removeExerciseSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid exercise' };

  const removed = await removeWorkoutExercise(parsed.data.workoutExerciseId);
  if (!removed) return { success: false, error: 'Exercise not found' };

  revalidateWorkout(parsed.data.workoutId);
  return { success: true, data: undefined };
}

const addSetSchema = z.object({ workoutId: z.uuid(), workoutExerciseId: z.uuid(), ...setFields });

export async function addSetAction(
  input: z.infer<typeof addSetSchema>,
): Promise<ActionResult<{ id: string }>> {
  const parsed = addSetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid set' };

  const { workoutId, workoutExerciseId, ...data } = parsed.data;
  const set = await addSet(workoutExerciseId, data);
  if (!set) return { success: false, error: 'Exercise not found' };

  revalidateWorkout(workoutId);
  return { success: true, data: set };
}

const updateSetSchema = z.object({ workoutId: z.uuid(), setId: z.uuid(), ...setFields });

export async function updateSetAction(
  input: z.infer<typeof updateSetSchema>,
): Promise<ActionResult> {
  const parsed = updateSetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid set' };

  const { workoutId, setId, ...data } = parsed.data;
  const set = await updateSet(setId, data);
  if (!set) return { success: false, error: 'Set not found' };

  revalidateWorkout(workoutId);
  return { success: true, data: undefined };
}

const deleteSetSchema = z.object({ workoutId: z.uuid(), setId: z.uuid() });

export async function deleteSetAction(
  input: z.infer<typeof deleteSetSchema>,
): Promise<ActionResult> {
  const parsed = deleteSetSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: 'Invalid set' };

  const set = await deleteSet(parsed.data.setId);
  if (!set) return { success: false, error: 'Set not found' };

  revalidateWorkout(parsed.data.workoutId);
  return { success: true, data: undefined };
}
