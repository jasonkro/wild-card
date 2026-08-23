'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { getModifierSchedule, getWeeklyModifiers, WeeklyModifier } from '@/lib/modifiers';

const storageKey = 'wild-card-leagues';
type PlayerBreakdown = { id: string; name: string; position: string; slot: string; points: number; modifier: string; adjustment: number; adjustedPoints: number; projectedPoints: number | null };
type DashboardTeam = { name: string; points: number; adjustedPoints: number; projectedPoints: number | null; adjustment: number; matchupId: number; starters: number; playerBreakdown: PlayerBreakdown[] };

export default function Home() {
  const [leagueId, setLeagueId] = useState('');
  const [leagues, setLeagues] = useState<string[]>([]);
  const [message, setMessage] = useState('Your league ID is visible in your Sleeper league URL.');
  const [warm, setWarm] = useState(false);
  const [leagueName, setLeagueName] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [dashboardTeams, setDashboardTeams] = useState<DashboardTeam[]>([]);
  const [week, setWeek] = useState<number | null>(null);
  const [selectedWeek, setSelectedWeek] = useState(1);
  const [activeLeagueId, setActiveLeagueId] = useState('');
  const [openMatchup, setOpenMatchup] = useState<number | null>(null);
  const [nextWeekModifiers, setNextWeekModifiers] = useState<WeeklyModifier[]>(() => getWeeklyModifiers(2));
  const [nextWeekVisible] = useState(() => getModifierSchedule().visibleToUsers);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [refreshSeconds, setRefreshSeconds] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);

  function applyDashboard(dashboard: { league?: { name: string }; teams?: DashboardTeam[]; week?: number; refreshedAt?: string }) {
    if (!dashboard.league) return;
    setLeagueName(dashboard.league.name);
    setDashboardTeams(dashboard.teams || []);
    setWeek(dashboard.week || 1);
    setSelectedWeek(dashboard.week || 1);
    if (dashboard.refreshedAt) {
      setLastUpdated(dashboard.refreshedAt);
      setRefreshSeconds(Math.max(0, 60 - Math.floor((Date.now() - Date.parse(dashboard.refreshedAt)) / 1000)));
    }
  }

  async function refreshCurrentLeague() {
    if (!activeLeagueId) return;
    setIsRefreshing(true);
    try {
      const response = await fetch(`/api/leagues/${activeLeagueId}/dashboard`, { cache: 'no-store' });
      if (response.ok) applyDashboard(await response.json());
    } finally {
      setIsRefreshing(false);
    }
  }

  useEffect(() => {
    try {
      const savedLeagues = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
      setLeagues(savedLeagues);
      if (savedLeagues[0]) {
        setActiveLeagueId(savedLeagues[0]);
        fetch(`/api/leagues/${savedLeagues[0]}/dashboard`, { cache: 'no-store' }).then((response) => response.json()).then((dashboard) => {
          applyDashboard(dashboard);
          return fetch(`/api/leagues/${savedLeagues[0]}/dashboard?week=${(dashboard.week || 1) + 1}`, { cache: 'no-store' });
        }).then((response) => response.json()).then((dashboard) => { if (dashboard.modifiers) setNextWeekModifiers(dashboard.modifiers); });
      }
    } catch {
      setLeagues([]);
    }
  }, []);

  useEffect(() => {
    if (!activeLeagueId) return;
    const interval = window.setInterval(refreshCurrentLeague, 60_000);
    return () => window.clearInterval(interval);
  }, [activeLeagueId]);

  useEffect(() => {
    if (!lastUpdated) return;
    const timer = window.setInterval(() => setRefreshSeconds(Math.max(0, 60 - Math.floor((Date.now() - Date.parse(lastUpdated)) / 1000))), 1000);
    return () => window.clearInterval(timer);
  }, [lastUpdated]);

  async function connectLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = leagueId.trim();
    if (!/^\d{6,}$/.test(id)) {
      setMessage('Enter a numeric Sleeper league ID (at least 6 digits).');
      return;
    }
    setIsConnecting(true);
    setMessage('Checking league with Sleeper...');
    try {
      const response = await fetch(`/api/leagues/validate?leagueId=${id}`);
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Sleeper could not validate that league.');
      const dashboardResponse = await fetch(`/api/leagues/${id}/dashboard`, { cache: 'no-store' });
      const dashboard = await dashboardResponse.json();
      if (!dashboardResponse.ok) throw new Error(dashboard.error || 'Sleeper matchup data is unavailable.');
      const updated = [id, ...leagues.filter((league) => league !== id)].slice(0, 5);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setLeagues(updated);
      applyDashboard(dashboard);
      setLeagueName(result.league.name);
      setActiveLeagueId(id);
      setDashboardTeams(dashboard.teams);
      setWeek(dashboard.week);
      setSelectedWeek(dashboard.week);
      const nextWeekResponse = await fetch(`/api/leagues/${id}/dashboard?week=${dashboard.week + 1}`);
      const nextWeekDashboard = await nextWeekResponse.json();
      if (nextWeekResponse.ok && nextWeekDashboard.modifiers) setNextWeekModifiers(nextWeekDashboard.modifiers);
      setLeagueId('');
      setMessage(`${result.league.name} connected. ${result.league.totalRosters} rosters found.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not connect to Sleeper.');
    } finally {
      setIsConnecting(false);
    }
  }

  function removeLeague(id: string) {
    const updated = leagues.filter((league) => league !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setLeagues(updated);
  }

  async function changeWeek(nextWeek: number) {
    setSelectedWeek(nextWeek);
    if (!activeLeagueId) return;
    const response = await fetch(`/api/leagues/${activeLeagueId}/dashboard?week=${nextWeek}`);
    const dashboard = await response.json();
    if (response.ok) {
      setDashboardTeams(dashboard.teams);
      setWeek(dashboard.week);
      setOpenMatchup(null);
    }
  }

  const matchups = Array.from(new Set(dashboardTeams.map((team) => team.matchupId))).map((matchupId) => ({
    matchupId,
    teams: dashboardTeams.filter((team) => team.matchupId === matchupId),
  }));

  return (
    <div className={warm ? 'warm' : ''}>
      <div className="noise" />
      <header className="topbar">
        <a className="wordmark" href="/"><span className="mark">W</span><span>WILD CARD</span></a>
        <div className="season-chip"><span className="live-dot" /> 2026 SEASON <span className="chip-divider" /> WEEK 01</div>
        <button className="icon-button" type="button" title="Toggle color mode" aria-label="Toggle color mode" onClick={() => setWarm(!warm)}>◐</button>
      </header>
      <main>
        <section className="intro-section">
          <div className="kicker"><span className="kicker-line" /> SLEEPER LEAGUE COMPANION</div>
          <h1>Make every<br /><em>Sunday</em> unpredictable.</h1>
          <p className="intro-copy">Your league, with a new set of rules every week. Connect a Sleeper league to see the live score beneath the chaos.</p>
          <form className="connect-form" onSubmit={connectLeague}>
            <label htmlFor="leagueId">SLEEPER LEAGUE ID</label>
            <div className="input-row">
              <input id="leagueId" inputMode="numeric" autoComplete="off" placeholder="e.g. 104829301928" required value={leagueId} onChange={(event) => setLeagueId(event.target.value)} />
              <button type="submit" disabled={isConnecting}>{isConnecting ? 'Checking...' : 'Connect league'} <span>↗</span></button>
            </div>
            <p className="form-note">{message}</p>
          </form>
        </section>
        <section className={`dashboard-preview ${matchups.length ? 'has-real-matchups' : ''}`} aria-label="Dashboard preview">
          <div className="preview-heading"><div><span className="eyebrow">ACTIVE BOARD / WEEK {String(week || 1).padStart(2, '0')}</span><h2>{leagueName || 'Sunday, Sept 13'}</h2></div><div className="preview-actions"><select aria-label="Select NFL week" value={selectedWeek} onChange={(event) => changeWeek(Number(event.target.value))}>{Array.from({ length: 18 }, (_, index) => <option key={index + 1} value={index + 1}>WEEK {String(index + 1).padStart(2, '0')}</option>)}</select><span className="status-pill"><span className="live-dot" /> {leagueName ? 'CONNECTED' : 'LIVE PREVIEW'}</span></div></div>
          <div className="modifier-strip">
            <article className="modifier-card modifier-lime"><div className="modifier-top"><span>01 / RUSH HOUR</span><span className="modifier-symbol">+</span></div><strong>RB</strong><div className="modifier-bottom"><span>RUNNING BACKS</span><b>+20%</b></div></article>
            <article className="modifier-card modifier-coral"><div className="modifier-top"><span>02 / AIR RAID</span><span className="modifier-symbol">−</span></div><strong>QB</strong><div className="modifier-bottom"><span>QUARTERBACKS</span><b>−10%</b></div></article>
            <article className="modifier-card modifier-blue"><div className="modifier-top"><span>03 / LONG SHOT</span><span className="modifier-symbol">+</span></div><strong>FLEX</strong><div className="modifier-bottom"><span>FLEX SLOTS</span><b>+15%</b></div></article>
          </div>
          <div className="next-week-preview"><div className="all-matchups-heading"><span className="eyebrow">NEXT WEEK / WEEK {String((week || 1) + 1).padStart(2, '0')}</span><span>{nextWeekVisible ? 'GLOBAL RULES PREVIEW' : 'LOCKED / REVEALS MONDAY 8:30 PM ET'}</span></div>{nextWeekVisible ? <div className="next-modifier-list">{nextWeekModifiers.map((modifier) => <div className="next-modifier" key={`${modifier.target || modifier.stats?.join('-')}-${modifier.label}`}><span>{modifier.label}</span><strong>{modifier.kind === 'stat' ? 'STAT' : modifier.target}</strong><b>{modifier.sign > 0 ? '+' : '−'}{modifier.percent}%</b></div>)}</div> : <p className="next-week-locked">Next week&apos;s modifiers are locked. Check back Monday at 8:30 PM Eastern.</p>}</div>
          {matchups.length > 0 ? matchups.map(({ matchupId, teams }) => { const home = teams[0]; const away = teams[1]; return <div key={matchupId}><div className="matchup-row"><div className="matchup-label"><span className="eyebrow">MATCHUP {String(matchupId).padStart(2, '0')}</span><button type="button" className="detail-button" onClick={() => setOpenMatchup(openMatchup === matchupId ? null : matchupId)}>{openMatchup === matchupId ? 'Hide details' : 'Player details'} {openMatchup === matchupId ? '↑' : '↓'}</button></div><div className="team"><span className="team-badge">{home.name.slice(0, 2).toUpperCase()}</span><div><b>{home.name}</b><small>Base {home.points.toFixed(1)} <i>{home.adjustment >= 0 ? '+' : ''}{home.adjustment.toFixed(1)}</i><br />Proj {home.projectedPoints === null ? '—' : home.projectedPoints.toFixed(1)}</small></div><strong>{home.adjustedPoints.toFixed(1)}</strong></div><div className="versus">VS</div><div className="team team-right"><strong>{away ? away.adjustedPoints.toFixed(1) : 'BYE'}</strong>{away && <><div><b>{away.name}</b><small>Base {away.points.toFixed(1)} <i className="negative">{away.adjustment >= 0 ? '+' : ''}{away.adjustment.toFixed(1)}</i><br />Proj {away.projectedPoints === null ? '—' : away.projectedPoints.toFixed(1)}</small></div><span className="team-badge badge-dark">{away.name.slice(0, 2).toUpperCase()}</span></>}</div></div>{openMatchup === matchupId && <div className="player-details"><div className="player-columns"><div><span className="eyebrow">{home.name}</span>{home.playerBreakdown.map((player) => <div className="player-line" key={player.id}><span><b>{player.name}</b><small>{player.position} / STARTED {player.slot}</small></span><span>{player.points.toFixed(1)} <i>{player.modifier}</i> <strong>{player.projectedPoints === null ? '—' : player.projectedPoints.toFixed(1)}</strong></span></div>)}</div>{away && <div><span className="eyebrow">{away.name}</span>{away.playerBreakdown.map((player) => <div className="player-line" key={player.id}><span><b>{player.name}</b><small>{player.position} / STARTED {player.slot}</small></span><span>{player.points.toFixed(1)} <i>{player.modifier}</i> <strong>{player.projectedPoints === null ? '—' : player.projectedPoints.toFixed(1)}</strong></span></div>)}</div>}</div></div>}</div>; }) : <div className="matchup-row"><div className="matchup-label"><span className="eyebrow">MATCHUP 01</span><span>Adjusted points</span></div><div className="team"><span className="team-badge">MT</span><div><b>Monday Tight Ends</b><small>Base 112.8 <i>+8.4</i></small></div><strong>121.2</strong></div><div className="versus">VS</div><div className="team team-right"><strong>109.7</strong><div><b>Sunday Scaries</b><small>Base 118.4 <i className="negative">−8.7</i></small></div><span className="team-badge badge-dark">SS</span></div></div>}
          {matchups.length > 0 && <div className="all-matchups"><div className="all-matchups-heading"><span className="eyebrow">ALL PARTICIPANTS</span><span>{matchups.length} MATCHUPS / {dashboardTeams.length} TEAMS</span></div>{matchups.map(({ matchupId, teams }) => <div className="participant-matchup" key={`participants-${matchupId}`}><span className="matchup-number">{String(matchupId).padStart(2, '0')}</span>{teams.map((team) => <Link className="participant-team" href={`/leagues/${activeLeagueId}/matchups/${matchupId}?week=${week || 1}`} key={team.name}><span>{team.name}</span><strong>{team.adjustedPoints.toFixed(1)}</strong><small>PROJ {team.projectedPoints === null ? '—' : team.projectedPoints.toFixed(1)} / VIEW →</small></Link>)}</div>)}</div>}
          <div className="preview-footer"><span><span className="live-dot" /> {isRefreshing ? 'UPDATING NOW' : lastUpdated ? `UPDATED ${refreshSeconds ? ` / NEXT IN ${refreshSeconds}S` : ' / READY'}` : 'WAITING FOR LEAGUE'}</span><span>CALCULATION <b>WEEK {String(week || 1).padStart(2, '0')} / V1</b></span><button type="button" onClick={() => setMessage('Detailed matchup views will unlock when a Sleeper league is connected.')}>View matchup details <span>→</span></button></div>
        </section>
        {leagues.length > 0 && <section className="saved-section"><div className="section-heading"><div><span className="eyebrow">YOUR LEAGUES</span><h2>Saved connections</h2></div><button className="text-button" type="button" onClick={() => { localStorage.removeItem(storageKey); setLeagues([]); }}>Clear all ×</button></div><div className="saved-list">{leagues.map((id, index) => <div className="saved-league" key={id}><span>LEAGUE {String(index + 1).padStart(2, '0')} &nbsp; / &nbsp; {id}</span><Link className="verify-link" href={`/leagues/${id}`}>Open dashboard →</Link><Link className="verify-link" href={`/leagues/${id}/verification`}>Verify →</Link><button type="button" onClick={() => removeLeague(id)} title="Remove league" aria-label={`Remove league ${id}`}>×</button></div>)}</div></section>}
      </main>
      <footer><span>WILD CARD / 001</span><span>BUILT FOR THE COMMISH WHO WANTS CHAOS</span><Link href="/commissioner">Commissioner access ↗</Link></footer>
    </div>
  );
}
