CREATE TABLE "exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workout_exercise_id" uuid NOT NULL,
	"set_number" integer NOT NULL,
	"reps" integer NOT NULL,
	"weight" numeric(6,2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sets_reps_non_negative" CHECK ("reps" >= 0),
	CONSTRAINT "sets_weight_non_negative" CHECK ("weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "workout_exercises" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"workout_id" uuid NOT NULL,
	"exercise_id" uuid NOT NULL,
	"order" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" text NOT NULL,
	"name" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "exercises_user_id_name_idx" ON "exercises" ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "sets_workout_exercise_id_set_number_idx" ON "sets" ("workout_exercise_id","set_number");--> statement-breakpoint
CREATE UNIQUE INDEX "workout_exercises_workout_id_order_idx" ON "workout_exercises" ("workout_id","order");--> statement-breakpoint
CREATE INDEX "workout_exercises_exercise_id_idx" ON "workout_exercises" ("exercise_id");--> statement-breakpoint
CREATE INDEX "workouts_user_id_started_at_idx" ON "workouts" ("user_id","started_at");--> statement-breakpoint
ALTER TABLE "sets" ADD CONSTRAINT "sets_workout_exercise_id_workout_exercises_id_fkey" FOREIGN KEY ("workout_exercise_id") REFERENCES "workout_exercises"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_workout_id_workouts_id_fkey" FOREIGN KEY ("workout_id") REFERENCES "workouts"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_exercise_id_exercises_id_fkey" FOREIGN KEY ("exercise_id") REFERENCES "exercises"("id") ON DELETE RESTRICT;