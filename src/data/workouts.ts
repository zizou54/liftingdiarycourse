import 'server-only';
import { connection } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { db } from '@/db';
import { exercises, sets, workoutExercises, workouts } from '@/db/schema';

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

/**
 * The current user's workouts started on `date` (YYYY-MM-DD), where the day
 * boundaries are interpreted in the IANA time zone `timeZone`.
 */
export async function getWorkoutsForDate(date: string, timeZone: string) {
  // Per-user data: only run for a real request, never while prerendering or
  // prefetching (this also allows the `new Date()` inside TZDate below).
  await connection();
  const userId = await requireUserId();

  const [year, month, day] = date.split('-').map(Number);
  const start = new TZDate(year, month - 1, day, timeZone); // local midnight
  const end = addDays(start, 1); // next local midnight (DST-safe)

  return db.query.workouts.findMany({
    where: {
      userId, // ALWAYS scope to the current user
      startedAt: { gte: start, lt: end },
    },
    orderBy: { startedAt: 'asc' },
    with: {
      workoutExercises: {
        orderBy: { order: 'asc' },
        with: {
          exercise: true,
          sets: { orderBy: { setNumber: 'asc' } },
        },
      },
    },
  });
}

export type WorkoutWithDetails = Awaited<ReturnType<typeof getWorkoutsForDate>>[number];

/** Creates a workout for the current user and returns its id. */
export async function createWorkout(data: { name: string | null; startedAt: Date }) {
  const userId = await requireUserId();

  const [workout] = await db
    .insert(workouts)
    .values({ ...data, userId }) // userId ALWAYS comes from auth()
    .returning({ id: workouts.id });

  return workout;
}

/** The current user's workout with this id, or null if they don't own one. */
export async function getWorkoutById(id: string) {
  await connection(); // per-user data: only run for a real request
  const userId = await requireUserId();

  // Filter by BOTH id and userId. Never by id alone.
  const workout = await db.query.workouts.findFirst({ where: { id, userId } });
  return workout ?? null;
}

/** Updates the current user's workout. Returns null if they don't own it. */
export async function updateWorkout(
  id: string,
  data: { name: string | null; startedAt: Date },
) {
  const userId = await requireUserId();

  const [workout] = await db
    .update(workouts)
    .set(data)
    .where(and(eq(workouts.id, id), eq(workouts.userId, userId))) // id AND userId
    .returning({ id: workouts.id });

  return workout ?? null; // null = not found for this user
}

/** The current user's workout with its exercises and sets, or null if they don't own it. */
export async function getWorkoutWithDetailsById(id: string) {
  await connection(); // per-user data: only run for a real request
  const userId = await requireUserId();

  const workout = await db.query.workouts.findFirst({
    where: { id, userId }, // BOTH id and userId
    with: {
      workoutExercises: {
        orderBy: { order: 'asc' },
        with: {
          exercise: true,
          sets: { orderBy: { setNumber: 'asc' } },
        },
      },
    },
  });
  return workout ?? null;
}

// Child tables (workout_exercises, sets) have no userId column, so ownership is
// always checked through the parent workout before writing to them.
// Note: the neon-http driver has no transaction support, so each helper does an
// ownership check followed by single-statement writes.

/**
 * Adds an exercise to the current user's workout, either an existing catalog
 * exercise (`exerciseId`) or one looked up / created by `name`.
 * Returns the new workout exercise id, or null if the workout or exercise isn't theirs.
 */
export async function addExerciseToWorkout(
  workoutId: string,
  input: { exerciseId: string } | { name: string },
) {
  const userId = await requireUserId();

  const workout = await db.query.workouts.findFirst({
    where: { id: workoutId, userId },
    columns: { id: true },
    with: { workoutExercises: { columns: { order: true } } },
  });
  if (!workout) return null;

  let exerciseId: string;
  if ('exerciseId' in input) {
    const exercise = await db.query.exercises.findFirst({
      where: { id: input.exerciseId, userId }, // must be the user's own exercise
      columns: { id: true },
    });
    if (!exercise) return null;
    exerciseId = exercise.id;
  } else {
    // Upsert on the (userId, name) unique index, so an existing exercise with
    // this name is reused and its id is returned either way.
    const [exercise] = await db
      .insert(exercises)
      .values({ userId, name: input.name })
      .onConflictDoUpdate({
        target: [exercises.userId, exercises.name],
        set: { name: input.name },
      })
      .returning({ id: exercises.id });
    exerciseId = exercise.id;
  }

  const order = Math.max(-1, ...workout.workoutExercises.map((we) => we.order)) + 1;

  const [workoutExercise] = await db
    .insert(workoutExercises)
    .values({ workoutId, exerciseId, order })
    .returning({ id: workoutExercises.id });

  return workoutExercise;
}

/** The current user's workout exercise with this id (with its set numbers), or null. */
async function findOwnedWorkoutExercise(workoutExerciseId: string, userId: string) {
  const workoutExercise = await db.query.workoutExercises.findFirst({
    where: { id: workoutExerciseId, workout: { userId } },
    columns: { id: true },
    with: { sets: { columns: { setNumber: true } } },
  });
  return workoutExercise ?? null;
}

/** The current user's set with this id, or null. */
async function findOwnedSet(setId: string, userId: string) {
  const set = await db.query.sets.findFirst({
    where: { id: setId, workoutExercise: { workout: { userId } } },
    columns: { id: true },
  });
  return set ?? null;
}

/** Removes an exercise (and, via cascade, its sets) from the current user's workout. */
export async function removeWorkoutExercise(workoutExerciseId: string) {
  const userId = await requireUserId();

  if (!(await findOwnedWorkoutExercise(workoutExerciseId, userId))) return null;

  const [deleted] = await db
    .delete(workoutExercises)
    .where(eq(workoutExercises.id, workoutExerciseId))
    .returning({ id: workoutExercises.id });

  return deleted ?? null;
}

type SetData = { reps: number; weight: number | null };

// The weight column is numeric, which Drizzle reads and writes as a string.
const toWeight = (weight: number | null) => (weight == null ? null : String(weight));

/** Adds a set to the current user's workout exercise. Returns null if they don't own it. */
export async function addSet(workoutExerciseId: string, data: SetData) {
  const userId = await requireUserId();

  const workoutExercise = await findOwnedWorkoutExercise(workoutExerciseId, userId);
  if (!workoutExercise) return null;

  const setNumber = Math.max(0, ...workoutExercise.sets.map((s) => s.setNumber)) + 1;

  const [set] = await db
    .insert(sets)
    .values({ workoutExerciseId, setNumber, reps: data.reps, weight: toWeight(data.weight) })
    .returning({ id: sets.id });

  return set;
}

/** Updates one of the current user's sets. Returns null if they don't own it. */
export async function updateSet(setId: string, data: SetData) {
  const userId = await requireUserId();

  if (!(await findOwnedSet(setId, userId))) return null;

  const [set] = await db
    .update(sets)
    .set({ reps: data.reps, weight: toWeight(data.weight) })
    .where(eq(sets.id, setId))
    .returning({ id: sets.id });

  return set ?? null;
}

/** Deletes one of the current user's sets. Returns null if they don't own it. */
export async function deleteSet(setId: string) {
  const userId = await requireUserId();

  if (!(await findOwnedSet(setId, userId))) return null;

  const [set] = await db.delete(sets).where(eq(sets.id, setId)).returning({ id: sets.id });

  return set ?? null;
}
