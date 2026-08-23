import { NextResponse } from 'next/server';
import { WeeklyModifier } from '@/lib/modifiers';
import { getStoredModifiers } from '@/lib/modifier-store';
import { claimLeagueRefresh, saveLeagueRefreshData } from '@/lib/league-refresh';

type SleeperUser = { user_id: string; display_name?: string; metadata?: { team_name?: string } };
type SleeperRoster = { roster_id: number; owner_id?: string; matchup_id?: number; points?: number; starters?: string[] };
type SleeperMatchup = { roster_id: number; matchup_id: number; points?: number; custom_points?: number | null; starters?: string[]; starters_points?: number[] };
type SleeperState = { week?: number; display_week?: number; season?: string };
type SleeperPlayer = { full_name?: string; first_name?: string; last_name?: string; position?: string };
type SleeperProjection = { pts_ppr?: number; pts_half_ppr?: number; pts_std?: number };
type SleeperStats = { pass_td?: number; rush_td?: number; rec_td?: number; return_td?: number; int?: number; fum_lost?: number };
function modifierFactor(modifiers: WeeklyModifier[], slot: string | undefined, stats: SleeperStats | undefined) {
  const positionModifier = modifiers.find((item) => item.kind === 'position' && item.target === slot);
  const positionFactor = positionModifier ? positionModifier.sign * positionModifier.percent / 100 : 0;
  const statFactor = modifiers.filter((item) => item.kind === 'stat' && item.stats).reduce((total, modifier) => {
    const events = modifier.stats?.reduce((count, stat) => count + (stats?.[stat] || 0), 0) || 0;
    return total + events * modifier.sign * modifier.percent / 100;
  }, 0);
  return positionFactor + statFactor;
}

function modifierDescription(modifiers: WeeklyModifier[], slot: string | undefined, stats: SleeperStats | undefined) {
  const positionModifier = modifiers.find((item) => item.kind === 'position' && item.target === slot);
  const statDescriptions = modifiers.filter((item) => item.kind === 'stat' && item.stats).map((modifier) => {
    const events = modifier.stats?.reduce((count, stat) => count + (stats?.[stat] || 0), 0) || 0;
    return `${modifier.sign > 0 ? '+' : '−'}${modifier.percent}% x${events} ${modifier.label}`;
  });
  return [positionModifier && `${positionModifier.sign > 0 ? '+' : '−'}${positionModifier.percent}% ${slot}`, ...statDescriptions].filter(Boolean).join(' / ') || '—';
}

export async function GET(request: Request, { params }: { params: Promise<{ leagueId: string }> }) {
  const { leagueId } = await params;
  if (!/^\d{6,}$/.test(leagueId)) return NextResponse.json({ error: 'Invalid league ID.' }, { status: 400 });

  try {
    const base = 'https://api.sleeper.app/v1';
    const [leagueResponse, usersResponse, rostersResponse, stateResponse, playersResponse] = await Promise.all([
      fetch(`${base}/league/${leagueId}`, { next: { revalidate: 60 } }),
      fetch(`${base}/league/${leagueId}/users`, { next: { revalidate: 60 } }),
      fetch(`${base}/league/${leagueId}/rosters`, { next: { revalidate: 60 } }),
      fetch(`${base}/state/nfl`, { next: { revalidate: 60 } }),
      fetch(`${base}/players/nfl`, { next: { revalidate: 3600 } }),
    ]);

    if (!leagueResponse.ok || !usersResponse.ok || !rostersResponse.ok || !stateResponse.ok || !playersResponse.ok) {
      return NextResponse.json({ error: 'Sleeper data is unavailable right now.' }, { status: 502 });
    }

    const league = await leagueResponse.json() as { name?: string; season?: string; roster_positions?: string[] };
    const users = await usersResponse.json() as SleeperUser[];
    const rosters = await rostersResponse.json() as SleeperRoster[];
    const state = await stateResponse.json() as SleeperState;
    const players = await playersResponse.json() as Record<string, SleeperPlayer>;
    const requestedWeek = Number(new URL(request.url).searchParams.get('week'));
    const isCurrentWeekRequest = !new URL(request.url).searchParams.has('week');
    const week = Number.isInteger(requestedWeek) && requestedWeek >= 1 && requestedWeek <= 18 ? requestedWeek : state.week || state.display_week || 1;
    if (isCurrentWeekRequest) {
      const refresh = await claimLeagueRefresh(leagueId);
      if (!refresh.allowed) {
        if (refresh.latestData && typeof refresh.latestData === 'object') return NextResponse.json({ ...refresh.latestData as Record<string, unknown>, rateLimited: true, retryAfter: refresh.retryAfter });
        return NextResponse.json({ error: 'This league was refreshed less than a minute ago.', retryAfter: refresh.retryAfter }, { status: 429, headers: { 'Retry-After': String(refresh.retryAfter), 'Cache-Control': 'no-store' } });
      }
    }
    const modifiers = await getStoredModifiers(week);
    const projectionResponse = await fetch(`${base}/projections/nfl/${league.season || state.season || '2026'}/${week}`, { next: { revalidate: 300 } });
    const projections = projectionResponse.ok ? await projectionResponse.json() as Record<string, SleeperProjection> : {};
    const statsResponse = await fetch(`${base}/stats/nfl/${league.season || state.season || '2026'}/${week}`, { next: { revalidate: 60 } });
    const stats = statsResponse.ok ? await statsResponse.json() as Record<string, SleeperStats> : {};
    const matchupsResponse = await fetch(`${base}/league/${leagueId}/matchups/${week}`, { next: { revalidate: 30 } });
    const matchups = matchupsResponse.ok ? await matchupsResponse.json() as SleeperMatchup[] : [];
    const usersById = new Map(users.map((user) => [user.user_id, user]));
    const rosterById = new Map(rosters.map((roster) => [roster.roster_id, roster]));
    const teams = matchups.map((matchup) => {
      const roster = rosterById.get(matchup.roster_id);
      const owner = roster?.owner_id ? usersById.get(roster.owner_id) : undefined;
      const projectedValues = (matchup.starters || []).map((playerId, index) => {
        if (playerId === '0') return null;
        const projection = projections[playerId];
        const projectedPoints = projection?.pts_ppr ?? projection?.pts_half_ppr ?? projection?.pts_std;
        if (typeof projectedPoints !== 'number') return null;
        const slot = league.roster_positions?.[index] || 'FLEX';
        return projectedPoints * (1 + modifierFactor(modifiers, slot, stats[playerId]));
      });
      const projectedTotal = projectedValues.some((points) => points !== null) ? projectedValues.reduce<number>((total, points) => total + (points ?? 0), 0) : null;
      const adjustedPoints = Number((matchup.starters_points || []).reduce((total, points, index) => {
        const slot = matchup.starters?.[index];
        return total + points * (1 + modifierFactor(modifiers, slot, stats[matchup.starters?.[index] || '']));
      }, 0).toFixed(2));
      const sleeperFinalPoints = typeof matchup.custom_points === 'number' ? Number(matchup.custom_points.toFixed(2)) : null;
      const difference = sleeperFinalPoints === null ? null : Number((sleeperFinalPoints - adjustedPoints).toFixed(2));
      return {
        rosterId: matchup.roster_id,
        matchupId: matchup.matchup_id,
        name: owner?.metadata?.team_name || owner?.display_name || `Roster ${matchup.roster_id}`,
        points: Number((matchup.points ?? roster?.points ?? 0).toFixed(2)),
        adjustedPoints,
        sleeperFinalPoints,
        verificationStatus: sleeperFinalPoints === null ? 'pending' : Math.abs(difference || 0) < 0.01 ? 'correct' : 'mismatch',
        verificationDifference: difference,
        projectedPoints: projectedTotal === null ? null : Number(projectedTotal.toFixed(2)),
        adjustment: Number((matchup.starters_points || []).reduce((total, points, index) => {
          const slot = matchup.starters?.[index];
          return total + points * modifierFactor(modifiers, slot, stats[matchup.starters?.[index] || '']);
        }, 0).toFixed(2)),
        playerBreakdown: (matchup.starters || []).flatMap((playerId, index) => {
          if (playerId === '0') return [];
          const points = matchup.starters_points?.[index] || 0;
          const slot = league.roster_positions?.[index] || 'FLEX';
          const playerStats = stats[playerId];
          const player = players[playerId];
          const projectedPoints = projections[playerId]?.pts_ppr ?? projections[playerId]?.pts_half_ppr ?? projections[playerId]?.pts_std;
          const adjustment = points * modifierFactor(modifiers, slot, playerStats);
          return [{
            id: playerId,
            name: player?.full_name || [player?.first_name, player?.last_name].filter(Boolean).join(' ') || `Player ${playerId}`,
            position: player?.position || '—',
            slot,
            points: Number(points.toFixed(2)),
            modifier: modifierDescription(modifiers, slot, playerStats),
            adjustment: Number(adjustment.toFixed(2)),
            adjustedPoints: Number((points + adjustment).toFixed(2)),
            projectedPoints: typeof projectedPoints === 'number' ? Number((projectedPoints * (1 + modifierFactor(modifiers, slot, playerStats))).toFixed(2)) : null,
          }];
        }),
        starters: matchup.starters?.length || roster?.starters?.length || 0,
      };
    });

    teams.sort((left, right) => left.matchupId - right.matchupId || left.rosterId - right.rosterId);
    const dashboard = { league: { id: leagueId, name: league.name || 'Unnamed league', season: league.season || state.season || 'Unknown' }, week, refreshedAt: new Date().toISOString(), refreshIntervalSeconds: 60, modifiers, teams };
    if (isCurrentWeekRequest) await saveLeagueRefreshData(leagueId, dashboard);
    return NextResponse.json(dashboard, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Could not reach Sleeper.' }, { status: 502 });
  }
}
