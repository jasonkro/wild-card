import { getModifierSchedule } from '@/lib/modifiers';
import { getReleasedModifiers, getStoredModifiers } from '@/lib/modifier-store';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const week = Number(new URL(request.url).searchParams.get('week') || 1);
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    return NextResponse.json({ error: 'Week must be between 1 and 18.' }, { status: 400 });
  }

  const stateResponse = await fetch('https://api.sleeper.app/v1/state/nfl', { next: { revalidate: 60 } });
  const state = stateResponse.ok ? await stateResponse.json() as { week?: number; display_week?: number } : {};
  const currentWeek = state.week || state.display_week || 1;
  const nextWeekIsAvailable = getModifierSchedule().visibleToUsers;
  const modifiersAvailable = week <= currentWeek || (week === currentWeek + 1 && nextWeekIsAvailable);

  const modifiers = modifiersAvailable
    ? week === currentWeek + 1 && nextWeekIsAvailable
      ? await getReleasedModifiers(week)
      : await getStoredModifiers(week)
    : [];
  return NextResponse.json({ week, modifiers, modifiersAvailable });
}
