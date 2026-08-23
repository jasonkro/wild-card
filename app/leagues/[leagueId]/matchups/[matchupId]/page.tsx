'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';

type Player = { id: string; name: string; position: string; slot: string; points: number; modifier: string; adjustment: number; adjustedPoints: number; projectedPoints: number | null };
type Team = { name: string; points: number; adjustedPoints: number; projectedPoints: number | null; adjustment: number; playerBreakdown: Player[] };
type Modifier = { target?: string; label: string; kind: string; sign: number; percent: number };

export default function MatchupPage() {
  const params = useParams<{ leagueId: string; matchupId: string }>();
  const searchParams = useSearchParams();
  const week = searchParams.get('week') || '1';
  const [teams, setTeams] = useState<Team[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [leagueName, setLeagueName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/leagues/${params.leagueId}/dashboard?week=${week}`)
      .then((response) => response.json())
      .then((data) => {
        setLeagueName(data.league?.name || 'Sleeper league');
        setModifiers(data.modifiers || []);
        setTeams((data.teams || []).filter((team: { matchupId: number }) => String(team.matchupId) === params.matchupId));
      })
      .finally(() => setLoading(false));
  }, [params.leagueId, params.matchupId, week]);

  return (
    <main className="matchup-page">
      <Link className="back-link" href="/">← Back to league board</Link>
      <div className="matchup-page-header"><div><span className="eyebrow">{leagueName || 'SLEEPER LEAGUE'} / WEEK {String(week).padStart(2, '0')}</span><h1>Matchup {params.matchupId}</h1></div><span className="status-pill dark-pill">AUDIT VIEW</span></div>
      {!loading && modifiers.length > 0 && <section className="matchup-modifiers"><div className="section-heading"><div><span className="eyebrow">ACTIVE RULES</span><h2>Week {week} modifiers</h2></div><Link className="text-button" href={`/leagues/${params.leagueId}/verification?week=${week}`}>Audit scores →</Link></div><div className="next-modifier-list">{modifiers.map((modifier) => <div className="next-modifier" style={{ background: '#e9e7df', borderLeftColor: 'var(--coral)', color: 'var(--ink)' }} key={modifier.label}><span>{modifier.label}</span><b style={{ color: 'var(--ink)' }}>{modifier.sign > 0 ? '+' : '−'}{modifier.percent}% {modifier.kind === 'position' ? modifier.target : 'STAT'}</b></div>)}</div></section>}
      {loading && <p className="page-note">Loading matchup data...</p>}
      {!loading && teams.length === 0 && <p className="page-note">No matchup data is available for this week.</p>}
      {!loading && teams.length > 0 && <div className="matchup-team-panels">{teams.map((team) => <section className="matchup-team-panel" key={team.name}><div className="panel-heading"><div><span className="eyebrow">TEAM</span><h2>{team.name}</h2></div><strong>{team.adjustedPoints.toFixed(1)}</strong></div><div className="score-summary"><span>BASE {team.points.toFixed(1)}</span><span>ADJUSTMENT {team.adjustment >= 0 ? '+' : ''}{team.adjustment.toFixed(1)}</span><span>PROJECTED {team.projectedPoints === null ? '—' : team.projectedPoints.toFixed(1)}</span></div><div className="player-table"><div className="player-table-head"><span>STARTER</span><span>BASE / MODIFIER / FINAL</span></div>{team.playerBreakdown.map((player) => <div className="player-table-row" key={player.id}><div><b>{player.name}</b><small>{player.position} / {player.slot}</small></div><div><span>{player.points.toFixed(1)}</span><i>{player.modifier}</i><strong>{player.adjustedPoints.toFixed(1)}</strong></div></div>)}</div></section>)}</div>}
    </main>
  );
}
