import 'server-only';
import { connection } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { and, eq } from 'drizzle-orm';
import { addDays } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { db } from '@/db';
import { workouts } from '@/db/schema';

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
