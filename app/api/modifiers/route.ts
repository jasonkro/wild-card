import { getModifierSchedule } from '@/lib/modifiers';
import { getReleasedModifiers, getStoredModifiers } from '@/lib/modifier-store';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const requestedWeek = new URL(request.url).searchParams.get('week');
  const parsedWeek = requestedWeek === null ? undefined : Number(requestedWeek);
  if (parsedWeek !== undefined && (!Number.isInteger(parsedWeek) || parsedWeek < 1 || parsedWeek > 18)) {
    return NextResponse.json({ error: 'Week must be between 1 and 18.' }, { status: 400 });
  }

  const stateResponse = await fetch('https://api.sleeper.app/v1/state/nfl', { next: { revalidate: 60 } });
  const state = stateResponse.ok ? await stateResponse.json() as { week?: number; display_week?: number } : {};
  const currentWeek = state.week || state.display_week || 1;
  const week = parsedWeek ?? currentWeek;
  const nextWeekIsAvailable = getModifierSchedule().visibleToUsers;
  const modifiersAvailable = week <= currentWeek || (week === currentWeek + 1 && nextWeekIsAvailable);

  const modifiers = modifiersAvailable
    ? week === currentWeek + 1 && nextWeekIsAvailable
      ? await getReleasedModifiers(week)
      : await getStoredModifiers(week)
    : [];
  return NextResponse.json({ week, currentWeek, modifiers, modifiersAvailable });
}
