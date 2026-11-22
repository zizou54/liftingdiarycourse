'use client';

import { useState, useTransition } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@/components/ui/combobox';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  addExerciseAction,
  addSetAction,
  deleteSetAction,
  removeExerciseAction,
  updateSetAction,
} from './actions';

type CatalogExercise = { id: string; name: string };
type LoggedSet = { id: string; reps: number; weight: number | null };
type LoggedExercise = { id: string; name: string; sets: LoggedSet[] };

type WorkoutExercisesProps = {
  workoutId: string;
  catalog: CatalogExercise[];
  exercises: LoggedExercise[];
};

/**
 * Exercises and sets of one workout. Every change is saved straight away via a
 * Server Action, which revalidates the page so fresh props arrive from the server.
 */
export function WorkoutExercises({ workoutId, catalog, exercises }: WorkoutExercisesProps) {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold">Exercises</h2>
      <AddExercise workoutId={workoutId} catalog={catalog} />
      {exercises.length === 0 ? (
        <p className="text-muted-foreground">No exercises yet — add one above.</p>
      ) : (
        exercises.map((exercise) => (
          <ExerciseCard key={exercise.id} workoutId={workoutId} exercise={exercise} />
        ))
      )}
    </section>
  );
}

// A combobox option: a catalog exercise, or (id: null) "create this name".
type ExerciseOption = { id: string | null; name: string };

function AddExercise({ workoutId, catalog }: { workoutId: string; catalog: CatalogExercise[] }) {
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<ExerciseOption | null>(null);
  const [error, setError] = useState<string | null>(null);

  const name = query.trim();
  const match = catalog.find((e) => e.name.toLowerCase() === name.toLowerCase());
  const options: ExerciseOption[] =
    name && !match ? [...catalog, { id: null, name }] : catalog;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (!name) {
      setError('Pick or type an exercise.');
      return;
    }

    startTransition(async () => {
      const result = await addExerciseAction({
        workoutId,
        exercise: match ? { exerciseId: match.id } : { name },
      });
      if (!result.success) {
        setError(result.error);
        return;
      }
      setQuery('');
      setSelected(null);
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add exercise</CardTitle>
        <CardDescription>Pick one of your exercises, or type a new name to create it.</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Combobox
            items={options}
            value={selected}
            onValueChange={setSelected}
            inputValue={query}
            onInputValueChange={setQuery}
            itemToStringLabel={(option) => option.name}
            isItemEqualToValue={(a, b) => a.id === b.id && a.name === b.name}
          >
            <ComboboxInput
              className="flex-1"
              placeholder="e.g. Bench press"
              aria-label="Exercise"
              disabled={isPending}
            />
            <ComboboxContent>
              <ComboboxEmpty>No exercises yet. Type a name to create one.</ComboboxEmpty>
              <ComboboxList>
                {(option: ExerciseOption) => (
                  <ComboboxItem key={option.id ?? `new:${option.name}`} value={option}>
                    {option.id ? option.name : `Create "${option.name}"`}
                  </ComboboxItem>
                )}
              </ComboboxList>
            </ComboboxContent>
          </Combobox>
          <Button type="submit" disabled={isPending || !name}>
            <Plus />
            {isPending ? 'Adding…' : 'Add'}
          </Button>
        </form>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// Reps / weight inputs hold strings. These turn them into action values, or null if invalid.
function parseReps(value: string) {
  const reps = Number(value);
  return value.trim() !== '' && Number.isInteger(reps) && reps >= 0 && reps <= 1000 ? reps : null;
}

function parseWeight(value: string): { valid: boolean; weight: number | null } {
  if (value.trim() === '') return { valid: true, weight: null }; // bodyweight
  const weight = Number(value);
  const valid =
    Number.isFinite(weight) && weight >= 0 && weight <= 9999.99 && Math.round(weight * 100) === weight * 100;
  return { valid, weight: valid ? weight : null };
}

const INVALID_SET = 'Reps must be a whole number (0–1000); weight 0–9999.99 kg with at most 2 decimals, or empty for bodyweight.';

function ExerciseCard({ workoutId, exercise }: { workoutId: string; exercise: LoggedExercise }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const lastSet = exercise.sets.at(-1);

  function handleRemove() {
    setError(null);
    startTransition(async () => {
      const result = await removeExerciseAction({ workoutId, workoutExerciseId: exercise.id });
      if (!result.success) setError(result.error);
    });
  }

  return (
    <Card aria-busy={isPending}>
      <CardHeader>
        <CardTitle>{exercise.name}</CardTitle>
        <CardDescription>
          {exercise.sets.length} {exercise.sets.length === 1 ? 'set' : 'sets'}
        </CardDescription>
        <CardAction>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleRemove}
            disabled={isPending}
            aria-label={`Remove ${exercise.name}`}
          >
            <Trash2 />
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Set</TableHead>
              <TableHead>Reps</TableHead>
              <TableHead>Weight (kg)</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {exercise.sets.map((set, index) => (
              <SetRow
                key={set.id}
                workoutId={workoutId}
                position={index + 1}
                set={set}
                onError={setError}
              />
            ))}
            <AddSetRow
              workoutId={workoutId}
              workoutExerciseId={exercise.id}
              position={exercise.sets.length + 1}
              defaults={lastSet}
              onError={setError}
            />
          </TableBody>
        </Table>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

type RowProps = { workoutId: string; position: number; onError: (error: string | null) => void };

function SetRow({ workoutId, position, set, onError }: RowProps & { set: LoggedSet }) {
  const [isPending, startTransition] = useTransition();
  const [reps, setReps] = useState(String(set.reps));
  const [weight, setWeight] = useState(set.weight == null ? '' : String(set.weight));

  const parsedReps = parseReps(reps);
  const parsedWeight = parseWeight(weight);
  const isDirty = parsedReps !== set.reps || parsedWeight.weight !== set.weight || !parsedWeight.valid;

  function handleSave() {
    onError(null);
    if (parsedReps == null || !parsedWeight.valid) {
      onError(INVALID_SET);
      return;
    }
    startTransition(async () => {
      const result = await updateSetAction({
        workoutId,
        setId: set.id,
        reps: parsedReps,
        weight: parsedWeight.weight,
      });
      if (!result.success) onError(result.error);
    });
  }

  function handleDelete() {
    onError(null);
    startTransition(async () => {
      const result = await deleteSetAction({ workoutId, setId: set.id });
      if (!result.success) onError(result.error);
    });
  }

  return (
    <TableRow>
      <TableCell>{position}</TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          step={1}
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          aria-label={`Set ${position} reps`}
          disabled={isPending}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={9999.99}
          step={0.01}
          placeholder="BW"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          aria-label={`Set ${position} weight in kg`}
          disabled={isPending}
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-end gap-1">
          <Button variant="outline" size="sm" onClick={handleSave} disabled={isPending || !isDirty}>
            Save
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={handleDelete}
            disabled={isPending}
            aria-label={`Delete set ${position}`}
          >
            <Trash2 />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function AddSetRow({
  workoutId,
  workoutExerciseId,
  position,
  defaults,
  onError,
}: RowProps & { workoutExerciseId: string; defaults?: LoggedSet }) {
  const [isPending, startTransition] = useTransition();
  // Start from the previous set's values: consecutive sets are usually similar.
  const [reps, setReps] = useState(defaults ? String(defaults.reps) : '');
  const [weight, setWeight] = useState(defaults?.weight == null ? '' : String(defaults.weight));

  function handleAdd() {
    onError(null);
    const parsedReps = parseReps(reps);
    const parsedWeight = parseWeight(weight);
    if (parsedReps == null || !parsedWeight.valid) {
      onError(INVALID_SET);
      return;
    }
    startTransition(async () => {
      const result = await addSetAction({
        workoutId,
        workoutExerciseId,
        reps: parsedReps,
        weight: parsedWeight.weight,
      });
      if (!result.success) onError(result.error);
    });
  }

  return (
    <TableRow>
      <TableCell className="text-muted-foreground">{position}</TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          max={1000}
          step={1}
          placeholder="Reps"
          value={reps}
          onChange={(e) => setReps(e.target.value)}
          aria-label="New set reps"
          disabled={isPending}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={9999.99}
          step={0.01}
          placeholder="BW"
          value={weight}
          onChange={(e) => setWeight(e.target.value)}
          aria-label="New set weight in kg"
          disabled={isPending}
        />
      </TableCell>
      <TableCell>
        <div className="flex justify-end">
          <Button size="sm" onClick={handleAdd} disabled={isPending || reps.trim() === ''}>
            <Plus />
            {isPending ? 'Adding…' : 'Add set'}
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}
