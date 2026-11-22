import { Suspense } from 'react';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getExercises } from '@/data/exercises';
import { getWorkoutWithDetailsById } from '@/data/workouts';
import { EditWorkoutForm } from './edit-workout-form';
import { WorkoutExercises } from './workout-exercises';

export default function EditWorkoutPage({ params }: PageProps<'/dashboard/workout/[workoutId]'>) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">Edit workout</h1>
      {/* Params are runtime data under Cache Components, so read them inside Suspense. */}
      <Suspense fallback={<p className="text-muted-foreground">Loading workout…</p>}>
        <EditWorkoutContent params={params} />
      </Suspense>
    </main>
  );
}

async function EditWorkoutContent({
  params,
}: {
  params: PageProps<'/dashboard/workout/[workoutId]'>['params'];
}) {
  const { workoutId } = await params; // params is a Promise: ALWAYS await it

  // A malformed id can't belong to anyone. Don't send it to the database.
  if (!z.uuid().safeParse(workoutId).success) notFound();

  // Both scoped to the logged-in user: another user's workout is simply "not found".
  const [workout, catalog] = await Promise.all([
    getWorkoutWithDetailsById(workoutId),
    getExercises(),
  ]);
  if (!workout) notFound();

  return (
    <>
      <EditWorkoutForm
        workout={{ id: workout.id, name: workout.name, startedAt: workout.startedAt }}
      />
      <WorkoutExercises
        workoutId={workout.id}
        catalog={catalog}
        exercises={workout.workoutExercises.map((we) => ({
          id: we.id,
          name: we.exercise.name,
          sets: we.sets.map((set) => ({
            id: set.id,
            reps: set.reps,
            weight: set.weight == null ? null : Number(set.weight),
          })),
        }))}
      />
    </>
  );
}
