import { auth } from '@/auth';
import { getModifierSchedule, WeeklyModifier } from '@/lib/modifiers';
import { getStoredModifiers, saveStoredModifiers } from '@/lib/modifier-store';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const week = Number(new URL(request.url).searchParams.get('week') || 2);
  return NextResponse.json({ week, modifiers: await getStoredModifiers(week), schedule: getModifierSchedule() });
}

export async function POST(request: Request) {
  if (!(await auth())?.user) return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  const schedule = getModifierSchedule();
  if (schedule.locked) return NextResponse.json({ error: `Modifiers are locked after ${schedule.lockTime}.` }, { status: 423 });

  const body = await request.json() as { week?: number; modifiers?: WeeklyModifier[] };
  const week = body.week || 2;
  const modifiers = body.modifiers || [];
  if (modifiers.length !== 3) return NextResponse.json({ error: 'Exactly three modifiers are required.' }, { status: 400 });
  const positionTargets = modifiers.filter((modifier) => modifier.kind === 'position').map((modifier) => modifier.target);
  if (new Set(positionTargets).size !== positionTargets.length) return NextResponse.json({ error: 'Position modifiers must use different targets.' }, { status: 400 });
  if (modifiers.filter((modifier) => modifier.kind === 'stat').length > 1) return NextResponse.json({ error: 'Only one special stat modifier is allowed.' }, { status: 400 });

  try {
    await saveStoredModifiers(week, modifiers);
    return NextResponse.json({ week, modifiers, saved: true, storage: process.env.DATABASE_URL ? 'database' : 'local' });
  } catch (error) {
    console.error('Modifier persistence failed:', error);
    return NextResponse.json({ error: 'Could not save modifiers to the configured database.' }, { status: 503 });
  }
}
