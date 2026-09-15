import { promises as fs } from 'fs';
import path from 'path';
import { getRandomWeeklyModifiers, getWeeklyModifiers, normalizeWeeklyModifiers, WeeklyModifier } from '@/lib/modifiers';
import { prisma } from '@/lib/prisma';

const storePath = path.join(process.cwd(), 'data', 'modifiers.json');

type StoredModifiers = Record<string, WeeklyModifier[]>;

async function readStore(): Promise<StoredModifiers> {
  try {
    return JSON.parse(await fs.readFile(storePath, 'utf8')) as StoredModifiers;
  } catch {
    return {};
  }
}

export async function getStoredModifiers(week: number) {
  if (process.env.DATABASE_URL) {
    const row = await prisma.weeklyModifierSet.findUnique({ where: { season_week: { season: 2026, week } } });
    if (row) return normalizeWeeklyModifiers(row.modifiers as unknown as WeeklyModifier[]);
    return normalizeWeeklyModifiers(getWeeklyModifiers(week));
  }
  const store = await readStore();
  return normalizeWeeklyModifiers(store[String(week)] || getWeeklyModifiers(week));
}

export async function saveStoredModifiers(week: number, modifiers: WeeklyModifier[]) {
  const normalizedModifiers = normalizeWeeklyModifiers(modifiers);
  if (process.env.DATABASE_URL) {
    const now = new Date();
    const revealAt = new Date(now);
    revealAt.setDate(revealAt.getDate() + 1);
    revealAt.setHours(20, 30, 0, 0);
    await prisma.weeklyModifierSet.upsert({
      where: { season_week: { season: 2026, week } },
      create: { season: 2026, week, modifiers: JSON.parse(JSON.stringify(normalizedModifiers)), lockedAt: now, revealAt },
      update: { modifiers: JSON.parse(JSON.stringify(normalizedModifiers)), lockedAt: now, revealAt },
    });
    return normalizedModifiers;
  }
  const store = await readStore();
  store[String(week)] = normalizedModifiers;
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
  return normalizedModifiers;
}

export async function getReleasedModifiers(week: number) {
  if (process.env.DATABASE_URL) {
    const existing = await prisma.weeklyModifierSet.findUnique({
      where: { season_week: { season: 2026, week } },
    });
    if (existing) return normalizeWeeklyModifiers(existing.modifiers as unknown as WeeklyModifier[]);

    const modifiers = normalizeWeeklyModifiers(getRandomWeeklyModifiers());
    const now = new Date();
    const revealAt = new Date(now);
    try {
      await prisma.weeklyModifierSet.create({
        data: {
          season: 2026,
          week,
          modifiers: JSON.parse(JSON.stringify(modifiers)),
          lockedAt: now,
          revealAt,
        },
      });
    } catch {
      // Another request may have released this week at the same time.
    }
    const released = await prisma.weeklyModifierSet.findUnique({
      where: { season_week: { season: 2026, week } },
    });
    return normalizeWeeklyModifiers(released?.modifiers as unknown as WeeklyModifier[] || modifiers);
  }

  const store = await readStore();
  if (store[String(week)]) return normalizeWeeklyModifiers(store[String(week)]);
  const modifiers = normalizeWeeklyModifiers(getRandomWeeklyModifiers());
  store[String(week)] = modifiers;
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
  return modifiers;
}
