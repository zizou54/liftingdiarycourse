import { Suspense } from 'react';
import Link from 'next/link';
import { format, isValid, parseISO } from 'date-fns';
import { TZDate } from '@date-fns/tz';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { getWorkoutsForDate } from '@/data/workouts';
import { DatePicker } from './date-picker';

type SearchParams = Promise<{ [key: string]: string | string[] | undefined }>;

function parseDate(value: unknown) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) && isValid(parseISO(value))
    ? value
    : null;
}

function parseTimeZone(value: unknown) {
  if (typeof value !== 'string' || !value) return null;
  try {
    new Intl.DateTimeFormat('en', { timeZone: value }); // throws on unknown zones
    return value;
  } catch {
    return null;
  }
}

export default function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
      <Suspense fallback={<p className="text-muted-foreground">Loading…</p>}>
        <DashboardContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function DashboardContent({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const date = parseDate(params.date);
  const timeZone = parseTimeZone(params.tz);

  return (
    <div className="grid items-start gap-6 md:grid-cols-[auto_1fr]">
      <DatePicker date={date} timeZone={timeZone} />

      <section className="flex min-w-0 flex-col gap-4">
        <h2 className="text-xl font-semibold">
          Workouts{date && ` for ${format(parseISO(date), 'do MMM yyyy')}`}
        </h2>

        {/* Keyed by date + time zone: picking a new date mounts a fresh
            boundary, so its fallback shows instead of the old day's workouts. */}
        <Suspense
          key={`${date}|${timeZone}`}
          fallback={<p className="text-muted-foreground">Loading workouts…</p>}
        >
          <WorkoutList date={date} timeZone={timeZone} />
        </Suspense>
      </section>
    </div>
  );
}

async function WorkoutList({ date, timeZone }: { date: string | null; timeZone: string | null }) {
  // Data is fetched here, on the server, for the logged-in user only.
  const workouts = date && timeZone ? await getWorkoutsForDate(date, timeZone) : [];

  return (
    <>
      {workouts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>No workouts logged</CardTitle>
            <CardDescription>There are no workouts logged for this date.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        workouts.map((workout) => (
          <Card key={workout.id}>
            <CardHeader>
              <CardTitle>{workout.name ?? 'Workout'}</CardTitle>
              <CardDescription className="flex items-center gap-2">
                {format(new TZDate(workout.startedAt, timeZone!), 'HH:mm')}
                {workout.completedAt ? (
                  ` – ${format(new TZDate(workout.completedAt, timeZone!), 'HH:mm')}`
                ) : (
                  <Badge variant="secondary">In progress</Badge>
                )}
              </CardDescription>
              <CardAction>
                <Button
                  variant="outline"
                  size="sm"
                  nativeButton={false}
                  render={<Link href={`/dashboard/workout/${workout.id}`} />}
                >
                  Edit
                </Button>
              </CardAction>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              {workout.workoutExercises.map((we) => (
                <div key={we.id} className="flex flex-col gap-1">
                  <p className="font-medium">{we.exercise.name}</p>
                  <div className="flex flex-wrap gap-2">
                    {we.sets.map((set) => (
                      <Badge key={set.id} variant="outline">
                        {set.reps} × {set.weight == null ? 'BW' : `${Number(set.weight)} kg`}
                      </Badge>
                    ))}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}
