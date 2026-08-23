import { NextResponse } from 'next/server';
import { getModifierSchedule, getWeeklyModifiers } from '@/lib/modifiers';

const nextWeek = 2;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization');
  if (cronSecret && authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const now = new Date();
  const schedule = getModifierSchedule(now);
  const force = new URL(request.url).searchParams.get('force') === 'true';

  if (!force && !schedule.locked) {
    return NextResponse.json({ generated: false, locked: false, visibleToUsers: false, reason: `Waiting for ${schedule.lockTime}.` });
  }

  return NextResponse.json({ generated: true, locked: true, visibleToUsers: schedule.visibleToUsers, season: 2026, week: nextWeek, timezone: schedule.timezone, lockTime: schedule.lockTime, revealTime: schedule.revealTime, generatedAt: now.toISOString(), modifiers: getWeeklyModifiers(nextWeek) });
}
