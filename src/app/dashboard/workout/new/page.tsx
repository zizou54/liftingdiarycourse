import { WorkoutForm } from './workout-form';

export default function NewWorkoutPage() {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col gap-6 px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight">New workout</h1>
      <WorkoutForm />
    </main>
  );
}
