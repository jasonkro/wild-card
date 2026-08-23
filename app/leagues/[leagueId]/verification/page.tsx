'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

type Team = { name: string; matchupId: number; adjustedPoints: number; points: number; sleeperFinalPoints: number | null; verificationStatus: 'pending' | 'correct' | 'mismatch'; verificationDifference: number | null };

export default function VerificationPage() {
  const params = useParams<{ leagueId: string }>();
  const [week, setWeek] = useState(1);
  const [leagueName, setLeagueName] = useState('Sleeper league');
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/leagues/${params.leagueId}/dashboard?week=${week}`).then((response) => response.json()).then((data) => {
      setLeagueName(data.league?.name || 'Sleeper league');
      setTeams(data.teams || []);
    }).finally(() => setLoading(false));
  }, [params.leagueId, week]);

  const completed = teams.filter((team) => team.verificationStatus !== 'pending');
  const mismatches = teams.filter((team) => team.verificationStatus === 'mismatch');
  const weekStatus = teams.length === 0 || completed.length < teams.length ? 'PENDING' : mismatches.length ? 'CHECK NEEDED' : 'VERIFIED';
  const matchups = Array.from(new Set(teams.map((team) => team.matchupId))).map((matchupId) => teams.filter((team) => team.matchupId === matchupId));

  return <main className="verification-page"><Link className="back-link" href="/">← Back to league board</Link><div className="verification-header"><div><span className="eyebrow">{leagueName} / SCORE AUDIT</span><h1>Verify Week {String(week).padStart(2, '0')}</h1></div><span className={`verification-badge ${weekStatus.toLowerCase().replace(' ', '-')}`}>{weekStatus}</span></div><div className="verification-toolbar"><label htmlFor="verification-week">WEEK</label><select id="verification-week" value={week} onChange={(event) => setWeek(Number(event.target.value))}>{Array.from({ length: 18 }, (_, index) => <option value={index + 1} key={index + 1}>{String(index + 1).padStart(2, '0')}</option>)}</select><span>{completed.length} of {teams.length} team scores verified</span></div>{loading && <p className="page-note">Loading Sleeper scores...</p>}{!loading && matchups.map((matchup, index) => <section className="verification-matchup" key={matchup[0]?.matchupId || index}><div className="verification-matchup-heading"><span className="eyebrow">MATCHUP {String(matchup[0]?.matchupId || index + 1).padStart(2, '0')}</span><Link href={`/leagues/${params.leagueId}/matchups/${matchup[0]?.matchupId}?week=${week}`}>View player details →</Link></div>{matchup.map((team) => <div className="verification-team" key={team.name}><div><b>{team.name}</b><small>Calculated adjusted total</small></div><strong>{team.adjustedPoints.toFixed(2)}</strong><div><small>Sleeper final score</small><b>{team.sleeperFinalPoints === null ? 'Not entered' : team.sleeperFinalPoints.toFixed(2)}</b></div><span className={`team-verification ${team.verificationStatus}`}>{team.verificationStatus === 'correct' ? 'MATCH' : team.verificationStatus === 'mismatch' ? `${team.verificationDifference && team.verificationDifference > 0 ? '+' : ''}${team.verificationDifference?.toFixed(2)} OFF` : 'AWAITING UPDATE'}</span></div>)}</section>)}{!loading && teams.length > 0 && <p className="verification-note">Sleeper final scores come from commissioner-entered custom points. A week is verified only when every team matches the calculated adjusted total.</p>}</main>;
}
