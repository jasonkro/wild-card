type SleeperPlayer = {
  full_name?: string;
  team?: string;
};

export type LivePlayerStats = {
  pass_td?: number;
  rush_td?: number;
  rec_td?: number;
  int?: number;
  fum_lost?: number;
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

function statCount(statistic: EspnStatistic, athlete: EspnAthlete, columns: string[]) {
  const labels = statistic.labels || statistic.names || [];
  const columnIndex = labels.findIndex((label) => columns.includes(label.toLowerCase()));
  if (columnIndex < 0) return undefined;
  const value = Number(athlete.stats?.[columnIndex]);
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
        const statMappings = statistic.name === 'passing'
          ? [{ key: 'pass_td' as const, columns: ['td', 'touchdowns', 'passingtouchdowns'] }, { key: 'int' as const, columns: ['int', 'interceptions', 'interceptions thrown'] }]
          : statistic.name === 'rushing' ? [{ key: 'rush_td' as const, columns: ['td', 'touchdowns', 'rushingtouchdowns'] }]
            : statistic.name === 'receiving' ? [{ key: 'rec_td' as const, columns: ['td', 'touchdowns', 'receivingtouchdowns'] }]
              : statistic.name === 'fumbles' ? [{ key: 'fum_lost' as const, columns: ['lost', 'fumbleslost', 'fumbles lost'] }]
                : [];
        if (statMappings.length === 0) return;
        statistic.athletes?.forEach((athlete) => {
          if (!athlete.athlete?.displayName) return;
          const normalizedName = normalizeName(athlete.athlete.displayName);
          const playerId = team ? playerIdsByNameAndTeam.get(`${normalizedName}:${team}`) : undefined;
          const matchingPlayerId = playerId || playerIdsByName.get(normalizedName);
          if (!matchingPlayerId) return;
          statMappings.forEach((stat) => {
            const value = statCount(statistic, athlete, stat.columns);
            if (value !== undefined) liveStats[matchingPlayerId] = { ...liveStats[matchingPlayerId], [stat.key]: value };
          });
        });
      });
    }));

    return liveStats;
  } catch {
    return {} as Record<string, LivePlayerStats>;
  }
}