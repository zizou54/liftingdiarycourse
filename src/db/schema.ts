import { sql } from 'drizzle-orm';
import {
  check,
  index,
  integer,
  numeric,
  snakeCase,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

// snakeCase.table maps camelCase keys to snake_case column names (drizzle v1).
const pgTable = snakeCase.table;

const timestamps = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp({ withTimezone: true })
    .defaultNow()
    .notNull()
    .$onUpdate(() => new Date()),
};

const createdAt = {
  createdAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
};

/** Per-user catalog of exercises (e.g. "Bench Press"). Name stored once, referenced by workouts. */
export const exercises = pgTable(
  'exercises',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(), // Clerk user id
    name: text().notNull(),
    ...timestamps,
  },
  (t) => [uniqueIndex('exercises_user_id_name_idx').on(t.userId, t.name)],
);

/** A single workout session. */
export const workouts = pgTable(
  'workouts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text().notNull(), // Clerk user id
    name: text(),
    startedAt: timestamp({ withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp({ withTimezone: true }),
    ...timestamps,
  },
  (t) => [index('workouts_user_id_started_at_idx').on(t.userId, t.startedAt)],
);

/** Junction: an exercise performed within a workout, ordered by `order`. */
export const workoutExercises = pgTable(
  'workout_exercises',
  {
    id: uuid().primaryKey().defaultRandom(),
    workoutId: uuid()
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    exerciseId: uuid()
      .notNull()
      .references(() => exercises.id, { onDelete: 'restrict' }),
    order: integer().notNull(),
    ...createdAt,
  },
  (t) => [
    uniqueIndex('workout_exercises_workout_id_order_idx').on(t.workoutId, t.order),
    index('workout_exercises_exercise_id_idx').on(t.exerciseId),
  ],
);

/** A single set of a workout exercise. Weight in kg; null = bodyweight. */
export const sets = pgTable(
  'sets',
  {
    id: uuid().primaryKey().defaultRandom(),
    workoutExerciseId: uuid()
      .notNull()
      .references(() => workoutExercises.id, { onDelete: 'cascade' }),
    setNumber: integer().notNull(),
    reps: integer().notNull(),
    weight: numeric({ precision: 6, scale: 2 }),
    ...createdAt,
  },
  (t) => [
    uniqueIndex('sets_workout_exercise_id_set_number_idx').on(t.workoutExerciseId, t.setNumber),
    check('sets_reps_non_negative', sql`${t.reps} >= 0`),
    check('sets_weight_non_negative', sql`${t.weight} >= 0`),
  ],
);

export type Exercise = typeof exercises.$inferSelect;
export type NewExercise = typeof exercises.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;
export type Set = typeof sets.$inferSelect;
export type NewSet = typeof sets.$inferInsert;
