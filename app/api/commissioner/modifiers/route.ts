import { auth } from '@/auth';
import { getModifierSchedule, getRandomWeeklyModifiers, positionTargets, slotTargets, WeeklyModifier } from '@/lib/modifiers';
import { clearStoredModifiersFromWeek, getStoredModifiers, saveStoredModifiers } from '@/lib/modifier-store';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const week = Number(new URL(request.url).searchParams.get('week') || 2);
  return NextResponse.json({ week, modifiers: await getStoredModifiers(week), schedule: getModifierSchedule() });
}

export async function POST(request: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });

  const body = await request.json() as { action?: string; week?: number; modifiers?: unknown };
  if (body.action === 'clear-from-week') {
    const week = Number(body.week);
    if (!Number.isInteger(week) || week < 1 || week > 18) return NextResponse.json({ error: 'Week must be between 1 and 18.' }, { status: 400 });
    try {
      await clearStoredModifiersFromWeek(week);
      return NextResponse.json({ clearedFromWeek: week, clearedThroughWeek: 18, clearedWeeks: 19 - week, saved: true, storage: process.env.DATABASE_URL ? 'database' : 'local' });
    } catch (error) {
      console.error('Modifier clearing failed:', error);
      return NextResponse.json({ error: 'Could not clear modifiers in the configured storage.' }, { status: 503 });
    }
  }
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
  const modifiers = (Array.isArray(body.modifiers) ? body.modifiers : []) as WeeklyModifier[];
  if (modifiers.length !== 3) return NextResponse.json({ error: 'Exactly three modifiers are required.' }, { status: 400 });
  if (!Number.isInteger(week) || week < 1 || week > 18) return NextResponse.json({ error: 'Week must be between 1 and 18.' }, { status: 400 });
  if (modifiers.some((modifier) => !modifier || typeof modifier !== 'object' || !['position', 'slot', 'stat'].includes(modifier.kind) || (modifier.sign !== 1 && modifier.sign !== -1))) {
    return NextResponse.json({ error: 'Every modifier must have a supported type and sign.' }, { status: 400 });
  }
  const positionModifierTargets = modifiers.filter((modifier) => modifier.kind === 'position' || modifier.kind === 'slot').map((modifier) => modifier.target);
  if (positionModifierTargets.some((target) => typeof target !== 'string') || new Set(positionModifierTargets).size !== positionModifierTargets.length) {
    return NextResponse.json({ error: 'Position modifiers must use different targets.' }, { status: 400 });
  }
  if (modifiers.filter((modifier) => modifier.kind === 'stat').length > 1) return NextResponse.json({ error: 'Only one special stat modifier is allowed.' }, { status: 400 });
  const positiveEvents = new Set(['pass_td', 'rush_td', 'rec_td']);
  const negativeEvents = new Set(['int', 'fum_lost']);
  for (const modifier of modifiers) {
    if (modifier.kind === 'position' && (!positionTargets.includes(modifier.target as typeof positionTargets[number]) || !Number.isInteger(modifier.percent) || modifier.percent < 0 || (modifier.sign < 0 ? modifier.percent > 50 : modifier.percent > 100))) return NextResponse.json({ error: 'Position modifiers must be between -50% and +100%.' }, { status: 400 });
    if (modifier.kind === 'slot' && (!slotTargets.includes(modifier.target as typeof slotTargets[number]) || !Number.isInteger(modifier.percent) || modifier.percent < 0 || (modifier.sign < 0 ? modifier.percent > 50 : modifier.percent > 100))) return NextResponse.json({ error: 'Single-slot modifiers must be between -50% and +100%.' }, { status: 400 });
    if (modifier.kind === 'stat') {
      const event = modifier.stats?.[0];
      if ((!event || (!positiveEvents.has(event) && !negativeEvents.has(event))) || ![5, 10].includes(modifier.percent) || modifier.target !== undefined) return NextResponse.json({ error: 'Stat modifiers must use a touchdown or turnover event at 5% or 10%.' }, { status: 400 });
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
