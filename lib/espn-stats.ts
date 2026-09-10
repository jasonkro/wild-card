type SleeperPlayer = {
  full_name?: string;
  team?: string;
};

export type LivePlayerStats = {
  pass_td?: number;
  rush_td?: number;
  rec_td?: number;
};

type EspnAthlete = {
  athlete?: { displayName?: string };
  stats?: string[];
};

type EspnStatistic = {
  name?: string;
  names?: string[];
  labels?: string[];
  athletes?: EspnAthlete[];
};

type EspnTeamBoxscore = {
  team?: { abbreviation?: string };
  statistics?: EspnStatistic[];
  stats?: EspnStatistic[];
};

function normalizeName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function touchdownCount(statistic: EspnStatistic, athlete: EspnAthlete) {
  const labels = statistic.labels || statistic.names || [];
  const touchdownIndex = labels.findIndex((label) => label.toLowerCase() === 'td' || label.toLowerCase().includes('touchdown'));
  if (touchdownIndex < 0) return undefined;
  const value = Number(athlete.stats?.[touchdownIndex]);
  return Number.isFinite(value) ? value : undefined;
}

export async function getEspnLiveStats(season: string, week: number, players: Record<string, SleeperPlayer>) {
  const playerIdsByNameAndTeam = new Map<string, string>();
  const playerIdsByName = new Map<string, string>();
  Object.entries(players).forEach(([playerId, player]) => {
    if (!player.full_name) return;
    const normalizedName = normalizeName(player.full_name);
    playerIdsByName.set(normalizedName, playerId);
    if (player.team) playerIdsByNameAndTeam.set(`${normalizedName}:${player.team}`, playerId);
  });

  try {
    const scoreboardResponse = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard?limit=100&dates=${season}&seasontype=2&week=${week}`, { cache: 'no-store' });
    if (!scoreboardResponse.ok) return {} as Record<string, LivePlayerStats>;
    const scoreboard = await scoreboardResponse.json() as { events?: { id?: string }[] };
    const eventIds = scoreboard.events?.flatMap((event) => event.id ? [event.id] : []) || [];
    const summaries = await Promise.all(eventIds.map(async (eventId) => {
      const response = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${eventId}`, { cache: 'no-store' });
      return response.ok ? response.json() as Promise<{ boxscore?: { players?: EspnTeamBoxscore[] } }> : null;
    }));
    const liveStats: Record<string, LivePlayerStats> = {};

    summaries.forEach((summary) => summary?.boxscore?.players?.forEach((teamBoxscore) => {
      const team = teamBoxscore.team?.abbreviation;
      (teamBoxscore.statistics || teamBoxscore.stats || []).forEach((statistic) => {
        const statKey = statistic.name === 'passing' ? 'pass_td' : statistic.name === 'rushing' ? 'rush_td' : statistic.name === 'receiving' ? 'rec_td' : null;
        if (!statKey) return;
        statistic.athletes?.forEach((athlete) => {
          if (!athlete.athlete?.displayName) return;
          const normalizedName = normalizeName(athlete.athlete.displayName);
          const playerId = team ? playerIdsByNameAndTeam.get(`${normalizedName}:${team}`) : undefined;
          const matchingPlayerId = playerId || playerIdsByName.get(normalizedName);
          const touchdowns = touchdownCount(statistic, athlete);
          if (!matchingPlayerId || touchdowns === undefined) return;
          liveStats[matchingPlayerId] = { ...liveStats[matchingPlayerId], [statKey]: touchdowns };
        });
      });
    }));

    return liveStats;
  } catch {
    return {} as Record<string, LivePlayerStats>;
  }
}