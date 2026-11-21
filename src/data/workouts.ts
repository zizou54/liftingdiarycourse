import 'server-only';
import { connection } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { addDays } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { db } from '@/db';

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
