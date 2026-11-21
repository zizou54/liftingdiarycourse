'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { format, isValid, parse } from 'date-fns';
import { CalendarIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { createWorkoutAction } from './actions';

export function WorkoutForm() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState('');
  const [date, setDate] = useState<Date | undefined>();
  const [time, setTime] = useState('');
  const [error, setError] = useState<string | null>(null);

  // "Now" is only known in the browser, so default the date and time here
  // rather than during the server render.
  useEffect(() => {
    const now = new Date();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDate((d) => d ?? now);
    setTime((t) => t || format(now, 'HH:mm'));
  }, []);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!date || !time) {
      setError('Pick a date and start time.');
      return;
    }
    // Combine the picked day and time in the browser's local time zone.
    const startedAt = parse(`${format(date, 'yyyy-MM-dd')} ${time}`, 'yyyy-MM-dd HH:mm', new Date());
    if (!isValid(startedAt)) {
      setError('Enter a valid start time.');
      return;
    }

    startTransition(async () => {
      const result = await createWorkoutAction({ name: name.trim() || null, startedAt });
      if (!result.success) {
        setError(result.error);
        return;
      }
      const params = new URLSearchParams({
        date: format(startedAt, 'yyyy-MM-dd'),
        tz: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      router.push(`/dashboard?${params}`);
    });
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-col gap-6">
        <CardHeader>
          <CardTitle>Workout details</CardTitle>
          <CardDescription>Give your workout a name and choose when it started.</CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Label htmlFor="name">Name (optional)</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Push day"
              maxLength={100}
              disabled={isPending}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label>Date</Label>
              <Popover>
                <PopoverTrigger
                  render={
                    <Button variant="outline" className="justify-start" disabled={isPending} />
                  }
                >
                  <CalendarIcon />
                  {date ? format(date, 'do MMM yyyy') : 'Pick a date'}
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={date}
                    defaultMonth={date}
                    onSelect={setDate}
                    required
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="time">Start time</Label>
              <Input
                id="time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                required
                disabled={isPending}
              />
            </div>
          </div>

          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </CardContent>

        <CardFooter className="justify-end gap-2">
          <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? 'Creating…' : 'Create workout'}
          </Button>
        </CardFooter>
      </form>
    </Card>
  );
}
