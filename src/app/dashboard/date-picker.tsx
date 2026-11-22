'use client';

import { useEffect, useOptimistic, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, parseISO } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

/**
 * Picks the dashboard date. It does NOT fetch data: it only writes the chosen
 * date (and the browser's time zone) to the URL, and the Server Component page
 * fetches the workouts for it.
 */
export function DatePicker({ date, timeZone }: { date: string | null; timeZone: string | null }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  // Show the clicked day right away, while the server renders the new date.
  // It settles back to the `date` prop once the navigation finishes.
  const [optimisticDate, setOptimisticDate] = useOptimistic(date);
  const [open, setOpen] = useState(false);

  const goTo = (day: Date, mode: 'push' | 'replace') => {
    const nextDate = format(day, 'yyyy-MM-dd');
    const params = new URLSearchParams({
      date: nextDate,
      tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });
    startTransition(() => {
      setOptimisticDate(nextDate);
      router[mode](`/dashboard?${params}`);
    });
  };

  // "Today" and the time zone are only known in the browser, so fill in
  // whichever is missing from the URL.
  useEffect(() => {
    if (!date || !timeZone) goTo(date ? parseISO(date) : new Date(), 'replace');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, timeZone]);

  const selected = optimisticDate ? parseISO(optimisticDate) : undefined;

  return (
    <Card className="w-fit" aria-busy={isPending}>
      <CardHeader>
        <CardTitle>Date</CardTitle>
        <CardDescription>Choose a day to view workouts</CardDescription>
        {isPending && (
          <CardAction>
            <Badge variant="secondary">Loading…</Badge>
          </CardAction>
        )}
      </CardHeader>
      <CardContent>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger render={<Button variant="outline" className="justify-start" />}>
            <CalendarIcon />
            {selected ? format(selected, 'do MMM yyyy') : 'Pick a date'}
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={selected}
              defaultMonth={selected}
              onSelect={(d) => {
                if (!d) return;
                setOpen(false);
                goTo(d, 'push');
              }}
            />
          </PopoverContent>
        </Popover>
      </CardContent>
    </Card>
  );
}
