import { promises as fs } from 'fs';
import path from 'path';
import { getRandomWeeklyModifiers, getWeeklyModifiers, normalizeWeeklyModifiers, WeeklyModifier } from '@/lib/modifiers';
import { prisma } from '@/lib/prisma';

const storePath = path.join(process.cwd(), 'data', 'modifiers.json');

type StoredModifiers = {
  weeks: Record<string, WeeklyModifier[]>;
  releasedWeeks: number[];
};

const unreleasedTimestamp = new Date('9999-12-31T23:59:59.999Z');

async function readStore(): Promise<StoredModifiers> {
  try {
    const parsed = JSON.parse(await fs.readFile(storePath, 'utf8')) as Record<string, unknown>;
    if (parsed.weeks && typeof parsed.weeks === 'object') {
      return {
        weeks: parsed.weeks as Record<string, WeeklyModifier[]>,
        releasedWeeks: Array.isArray(parsed.releasedWeeks) ? parsed.releasedWeeks.filter(Number.isInteger) as number[] : [],
      };
    }
    return { weeks: parsed as Record<string, WeeklyModifier[]>, releasedWeeks: [] };
  } catch {
    return { weeks: {}, releasedWeeks: [] };
  }
}

async function writeStore(store: StoredModifiers) {
  await fs.mkdir(path.dirname(storePath), { recursive: true });
  await fs.writeFile(storePath, JSON.stringify(store, null, 2), 'utf8');
}

// Released database rows share the same timestamp for lockedAt and revealAt; unreleased saves use a future revealAt.
function hasDatabaseReleaseMarker(record: { lockedAt: Date; revealAt: Date } | null, now: Date) {
  return Boolean(record && record.revealAt <= now && record.revealAt.getTime() === record.lockedAt.getTime());
}

export async function getStoredModifiers(week: number) {
  if (process.env.DATABASE_URL) {
    const row = await prisma.weeklyModifierSet.findUnique({ where: { season_week: { season: 2026, week } } });
    if (row) return normalizeWeeklyModifiers(row.modifiers as unknown as WeeklyModifier[]);
    return normalizeWeeklyModifiers(getWeeklyModifiers(week));
  }
  const store = await readStore();
  return normalizeWeeklyModifiers(store.weeks[String(week)] || getWeeklyModifiers(week));
}

export async function saveStoredModifiers(week: number, modifiers: WeeklyModifier[]) {
  const normalizedModifiers = normalizeWeeklyModifiers(modifiers);
  if (process.env.DATABASE_URL) {
    const now = new Date();
    const existing = await prisma.weeklyModifierSet.findUnique({ where: { season_week: { season: 2026, week } } });
    const releaseMarker = hasDatabaseReleaseMarker(existing, now) ? existing : null;
    await prisma.weeklyModifierSet.upsert({
      where: { season_week: { season: 2026, week } },
      create: { season: 2026, week, modifiers: JSON.parse(JSON.stringify(normalizedModifiers)), lockedAt: now, revealAt: unreleasedTimestamp },
      update: releaseMarker
        ? { modifiers: JSON.parse(JSON.stringify(normalizedModifiers)) }
        : { modifiers: JSON.parse(JSON.stringify(normalizedModifiers)), lockedAt: now, revealAt: unreleasedTimestamp },
    });
    return normalizedModifiers;
  }
  const store = await readStore();
  store.weeks[String(week)] = normalizedModifiers;
  await writeStore(store);
  return normalizedModifiers;
}

export async function isModifierWeekReleased(week: number, now = new Date()) {
  if (process.env.DATABASE_URL) {
    const record = await prisma.weeklyModifierSet.findUnique({
      where: { season_week: { season: 2026, week } },
      select: { lockedAt: true, revealAt: true },
    });
    return hasDatabaseReleaseMarker(record, now);
  }
  return (await readStore()).releasedWeeks.includes(week);
}

export async function getReleasedModifiers(week: number) {
  if (process.env.DATABASE_URL) {
    const existing = await prisma.weeklyModifierSet.findUnique({
      where: { season_week: { season: 2026, week } },
    });
    if (existing) {
      if (!hasDatabaseReleaseMarker(existing, new Date())) {
        const releasedAt = new Date();
        await prisma.weeklyModifierSet.update({
          where: { season_week: { season: 2026, week } },
          data: { lockedAt: releasedAt, revealAt: releasedAt },
        });
      }
      return normalizeWeeklyModifiers(existing.modifiers as unknown as WeeklyModifier[]);
    }

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
  const modifiers = store.weeks[String(week)] || normalizeWeeklyModifiers(getRandomWeeklyModifiers());
  store.weeks[String(week)] = modifiers;
  if (!store.releasedWeeks.includes(week)) store.releasedWeeks.push(week);
  await writeStore(store);
  return modifiers;
}
