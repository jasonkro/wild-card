import { auth } from '@/auth';
import { getModifierSchedule, getRandomWeeklyModifiers, WeeklyModifier } from '@/lib/modifiers';
import { getStoredModifiers, saveStoredModifiers } from '@/lib/modifier-store';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const week = Number(new URL(request.url).searchParams.get('week') || 2);
  return NextResponse.json({ week, modifiers: await getStoredModifiers(week), schedule: getModifierSchedule() });
}

export async function POST(request: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const body = await request.json() as { action?: string; week?: number; modifiers?: WeeklyModifier[] };
  if (body.action === 'randomize') {
    try {
      const week = body.week || 2;
      const modifiers = await saveStoredModifiers(week, getRandomWeeklyModifiers());
      return NextResponse.json({ week, modifiers, saved: true, storage: process.env.DATABASE_URL ? 'database' : 'local' });
    } catch (error) {
      console.error('Modifier randomization failed:', error);
      return NextResponse.json({ error: 'Could not randomize modifiers in the configured storage.' }, { status: 503 });
    }
  }
  const week = body.week || 2;
  const modifiers = body.modifiers || [];
  if (modifiers.length !== 3) return NextResponse.json({ error: 'Exactly three modifiers are required.' }, { status: 400 });
  if (!Number.isInteger(week) || week < 1 || week > 18) return NextResponse.json({ error: 'Week must be between 1 and 18.' }, { status: 400 });
  const positionTargets = modifiers.filter((modifier) => modifier.kind === 'position').map((modifier) => modifier.target);
  if (new Set(positionTargets).size !== positionTargets.length) return NextResponse.json({ error: 'Position modifiers must use different targets.' }, { status: 400 });
  if (modifiers.filter((modifier) => modifier.kind === 'stat').length > 1) return NextResponse.json({ error: 'Only one special stat modifier is allowed.' }, { status: 400 });
  const positiveEvents = new Set(['pass_td', 'rush_td', 'rec_td']);
  const negativeEvents = new Set(['int', 'fum_lost']);
  for (const modifier of modifiers) {
    if (modifier.kind === 'position' && (!modifier.target || ![10, 15, 20, 25].includes(modifier.percent))) return NextResponse.json({ error: 'Position modifiers must be between -25% and -10%, or +10% and +25%.' }, { status: 400 });
    if (modifier.kind === 'stat') {
      const event = modifier.stats?.[0];
      if ((!event || (!positiveEvents.has(event) && !negativeEvents.has(event))) || ![5, 10].includes(modifier.percent)) return NextResponse.json({ error: 'Stat modifiers must use a touchdown or turnover event at 5% or 10%.' }, { status: 400 });
      const expectedSign = positiveEvents.has(event) ? 1 : -1;
      if (modifier.sign !== expectedSign) return NextResponse.json({ error: 'Touchdown stats must be positive; interceptions and fumbles must be negative.' }, { status: 400 });
    }
  }

  try {
    await saveStoredModifiers(week, modifiers);
    return NextResponse.json({ week, modifiers, saved: true, storage: process.env.DATABASE_URL ? 'database' : 'local' });
  } catch (error) {
    console.error('Modifier persistence failed:', error);
    return NextResponse.json({ error: 'Could not save modifiers to the configured database.' }, { status: 503 });
  }
}
