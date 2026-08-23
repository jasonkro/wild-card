import { NextRequest, NextResponse } from 'next/server';

type SleeperLeague = {
  name?: string;
  season?: string;
  status?: string;
  total_rosters?: number;
  roster_positions?: string[];
};

export async function GET(request: NextRequest) {
  const leagueId = request.nextUrl.searchParams.get('leagueId')?.trim();

  if (!leagueId || !/^\d{6,}$/.test(leagueId)) {
    return NextResponse.json({ error: 'Enter a valid Sleeper league ID.' }, { status: 400 });
  }

  try {
    const response = await fetch(`https://api.sleeper.app/v1/league/${leagueId}`, {
      headers: { Accept: 'application/json' },
      next: { revalidate: 300 },
    });

    if (response.status === 404) {
      return NextResponse.json({ error: 'Sleeper could not find that league.' }, { status: 404 });
    }

    if (!response.ok) {
      return NextResponse.json({ error: 'Sleeper is unavailable right now.' }, { status: 502 });
    }

    const league = (await response.json()) as SleeperLeague;
    return NextResponse.json({
      league: {
        id: leagueId,
        name: league.name || 'Unnamed league',
        season: league.season || 'Unknown season',
        status: league.status || 'unknown',
        totalRosters: league.total_rosters || 0,
        rosterPositions: league.roster_positions || [],
      },
    });
  } catch {
    return NextResponse.json({ error: 'Could not reach Sleeper.' }, { status: 502 });
  }
}
