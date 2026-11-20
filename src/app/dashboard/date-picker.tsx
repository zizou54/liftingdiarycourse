'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useTransition } from 'react';

function localToday() {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function localTimeZone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone;
}

export function DatePicker({ date, timeZone }: { date: string | null; timeZone: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();

  const navigate = (nextDate: string, mode: 'push' | 'replace') => {
    const params = new URLSearchParams({ date: nextDate, tz: localTimeZone() });
    startTransition(() => router[mode](`${pathname}?${params}`));
  };

  // The server can't know the browser's "today", so default it here.
  useEffect(() => {
    if (!date || !timeZone) navigate(date ?? localToday(), 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, timeZone]);

  return (
    <div className="flex items-center gap-3">
      <label htmlFor="workout-date" className="text-sm font-medium text-zinc-600 dark:text-zinc-400">
        Date
      </label>
      <input
        id="workout-date"
        type="date"
        value={date ?? ''}
        onChange={(e) => e.target.value && navigate(e.target.value, 'push')}
        className="h-9 rounded-lg border border-zinc-300 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:[color-scheme:dark]"
      />
      {isPending && <span className="text-sm text-zinc-500">Loading…</span>}
    </div>
  );
}
