import 'server-only';
import { sql } from 'drizzle-orm';
import { db } from '@/db';

/**
 * All workouts a user started on `date` (YYYY-MM-DD), where the day boundaries
 * are interpreted in the IANA time zone `timeZone`.
 */
export async function getWorkoutsForDate(userId: string, date: string, timeZone: string) {
  return db.query.workouts.findMany({
    where: {
      userId,
      // Range comparison keeps the (user_id, started_at) index usable.
      RAW: (t) =>
        sql`${t.startedAt} >= (${date}::date::timestamp at time zone ${timeZone})
          and ${t.startedAt} < ((${date}::date + 1)::timestamp at time zone ${timeZone})`,
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
