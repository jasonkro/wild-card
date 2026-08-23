import { prisma } from '@/lib/prisma';

const refreshWindowMs = 60_000;
const memoryRefreshes = new Map<string, number>();

export async function claimLeagueRefresh(leagueId: string) {
  const now = Date.now();
  const memoryLastFetched = memoryRefreshes.get(leagueId) || 0;
  if (now - memoryLastFetched < refreshWindowMs) {
    return { allowed: false, retryAfter: Math.ceil((refreshWindowMs - (now - memoryLastFetched)) / 1000) };
  }

  if (process.env.DATABASE_URL) {
    const existing = await prisma.leagueRefresh.findUnique({ where: { leagueId } });
    if (existing) {
      const elapsed = now - existing.lastFetchedAt.getTime();
      if (elapsed < refreshWindowMs) {
        return { allowed: false, retryAfter: Math.ceil((refreshWindowMs - elapsed) / 1000), latestData: existing.latestData };
      }
    }
    await prisma.leagueRefresh.upsert({
      where: { leagueId },
      create: { leagueId, lastFetchedAt: new Date(now) },
      update: { lastFetchedAt: new Date(now) },
    });
  }

  memoryRefreshes.set(leagueId, now);
  return { allowed: true, retryAfter: 0 };
}

export async function saveLeagueRefreshData(leagueId: string, data: unknown) {
  if (!process.env.DATABASE_URL) return;
  await prisma.leagueRefresh.update({ where: { leagueId }, data: { latestData: JSON.parse(JSON.stringify(data)) } });
}
