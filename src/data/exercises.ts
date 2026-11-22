import 'server-only';
import { connection } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { db } from '@/db';

async function requireUserId() {
  const { userId } = await auth();
  if (!userId) throw new Error('Unauthorized');
  return userId;
}

/** The current user's exercise catalog, alphabetically. */
export async function getExercises() {
  await connection(); // per-user data: only run for a real request
  const userId = await requireUserId();

  return db.query.exercises.findMany({
    where: { userId }, // ALWAYS scope to the current user
    orderBy: { name: 'asc' },
    columns: { id: true, name: true },
  });
}
