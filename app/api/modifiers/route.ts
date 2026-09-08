import { getStoredModifiers } from '@/lib/modifier-store';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const week = Number(new URL(request.url).searchParams.get('week') || 1);
  if (!Number.isInteger(week) || week < 1 || week > 18) {
    return NextResponse.json({ error: 'Week must be between 1 and 18.' }, { status: 400 });
  }

  return NextResponse.json({ week, modifiers: await getStoredModifiers(week) });
}
