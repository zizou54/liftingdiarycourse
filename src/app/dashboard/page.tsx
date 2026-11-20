import { auth } from '@clerk/nextjs/server';
import { Suspense } from 'react';
import { getWorkoutsForDate, type WorkoutWithDetails } from '@/data/workouts';
import { DatePicker } from './date-picker';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDate(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().startsWith(value) ? value : null;
}

function parseTimeZone(value: string | string[] | undefined): string | null {
  if (typeof value !== 'string') return null;
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: value }).resolvedOptions().timeZone;
  } catch {
    return null;
  }
}

export default function DashboardPage(props: PageProps<'/dashboard'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <Suspense fallback={<p className="text-zinc-500">Loading…</p>}>
        <DashboardContent searchParams={props.searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({
  searchParams,
}: {
  searchParams: PageProps<'/dashboard'>['searchParams'];
}) {
  const { userId, redirectToSignIn } = await auth();
  if (!userId) return redirectToSignIn();

  const params = await searchParams;
  const date = parseDate(params.date);
  const timeZone = parseTimeZone(params.tz);

  return (
    <>
      <DatePicker date={date} timeZone={timeZone} />
      {date && timeZone ? (
        <WorkoutList workouts={await getWorkoutsForDate(userId, date, timeZone)} timeZone={timeZone} />
      ) : (
        <p className="text-zinc-500">Loading…</p>
      )}
    </>
  );
}

function WorkoutList({ workouts, timeZone }: { workouts: WorkoutWithDetails[]; timeZone: string }) {
  if (workouts.length === 0) {
    return <p className="text-zinc-500">No workouts logged for this date.</p>;
  }

  const time = new Intl.DateTimeFormat(undefined, { timeStyle: 'short', timeZone });

  return (
    <ul className="flex flex-col gap-4">
      {workouts.map((workout) => (
        <li
          key={workout.id}
          className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-950"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-lg font-semibold">{workout.name ?? 'Workout'}</h2>
            <span className="text-sm text-zinc-500">
              {time.format(workout.startedAt)}
              {workout.completedAt && ` – ${time.format(workout.completedAt)}`}
            </span>
          </div>
          {workout.workoutExercises.length === 0 ? (
            <p className="mt-3 text-sm text-zinc-500">No exercises logged.</p>
          ) : (
            <ul className="mt-3 flex flex-col gap-2">
              {workout.workoutExercises.map((we) => (
                <li key={we.id}>
                  <p className="font-medium">{we.exercise.name}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    {we.sets.length === 0
                      ? 'No sets'
                      : we.sets
                          .map((s) => `${s.reps} × ${s.weight == null ? 'BW' : `${Number(s.weight)} kg`}`)
                          .join(', ')}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </li>
      ))}
    </ul>
  );
}
