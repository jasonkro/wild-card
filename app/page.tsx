'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getModifierSchedule, getWeeklyModifiers, WeeklyModifier } from '@/lib/modifiers';

const storageKey = 'wild-card-leagues';
const redirectKey = 'wild-card-redirected';

export default function Home() {
  const router = useRouter();
  const [leagueId, setLeagueId] = useState('');
  const [savedLeagues, setSavedLeagues] = useState<string[]>([]);
  const [message, setMessage] = useState('Enter a Sleeper league ID to start tracking your league.');
  const [isConnecting, setIsConnecting] = useState(false);

  const currentModifiers = useMemo<WeeklyModifier[]>(() => getWeeklyModifiers(1), []);
  const schedule = useMemo(() => getModifierSchedule(), []);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || '[]') as string[];
      const unique = [...new Set(stored.filter(Boolean))];
      setSavedLeagues(unique);

      // Only redirect on first visit, not on back navigation
      const hasRedirected = sessionStorage.getItem(redirectKey);
      if (unique.length === 1 && !hasRedirected) {
        sessionStorage.setItem(redirectKey, 'true');
        router.replace(`/leagues/${unique[0]}`);
      }
    } catch {
      setSavedLeagues([]);
    }
  }, [router]);

  async function connectLeague(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const id = leagueId.trim();

    if (!/^\d{6,}$/.test(id)) {
      setMessage('Enter a numeric Sleeper league ID (at least 6 digits).');
      return;
    }

    setIsConnecting(true);
    setMessage('Checking Sleeper league...');

    try {
      const response = await fetch(`/api/leagues/validate?leagueId=${id}`);
      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Sleeper could not validate that league.');
      }

      const updated = [id, ...savedLeagues.filter((league) => league !== id)].slice(0, 5);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setSavedLeagues(updated);
      setLeagueId('');
      setMessage(`${result.league.name} connected.`);

      if (updated.length === 1) {
        router.push(`/leagues/${id}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not connect to Sleeper.');
    } finally {
      setIsConnecting(false);
    }
  }

  function removeLeague(id: string) {
    const updated = savedLeagues.filter((league) => league !== id);
    localStorage.setItem(storageKey, JSON.stringify(updated));
    setSavedLeagues(updated);
  }

  return (
    <main className="home-page">
      <header className="topbar">
        <div className="wordmark">LEAGUE OF CHAOS</div>
        <div className="season-chip">CURRENT RULES / WEEK 01</div>
        <div className="topbar-right">
          <Link className="guide-nav-link" href="/guide">How it works</Link>
        </div>
      </header>

      <section className="intro-section">
        <div className="kicker">SLEEPER LEAGUE COMPANION</div>
        <h1>Your league has chosen Chaos.</h1>
        <p className="intro-copy">Add your league ID and keep your saved connections here. If you only have one, it jumps straight to that league dashboard.</p>

        <form className="connect-form" onSubmit={connectLeague}>
          <label htmlFor="leagueId">SLEEPER LEAGUE ID</label>
          <div className="input-row">
            <input
              id="leagueId"
              inputMode="numeric"
              autoComplete="off"
              placeholder="e.g. 104829301928"
              value={leagueId}
              onChange={(event) => setLeagueId(event.target.value)}
            />
            <button type="submit" disabled={isConnecting}>
              {isConnecting ? 'Checking...' : 'Connect'}
            </button>
          </div>
          <p className="form-note">{message}</p>
        </form>
      </section>

      <section className="modifier-board">
        <div className="section-heading">
          <div>
            <span className="eyebrow">CURRENT MODIFIERS</span>
            <h2>What chaos is active this week?</h2>
          </div>
          <span className="status-pill">{schedule.visibleToUsers ? 'LIVE' : 'LOCKED'}</span>
        </div>

        <div className="next-modifier-list">
          {currentModifiers.map((modifier) => (
            <div className="next-modifier" style={{ background: '#e9e7df', borderLeftColor: 'var(--coral)', color: 'var(--ink)' }} key={`${modifier.label}-${modifier.target ?? 'stat'}`}>
              <span>{modifier.label}</span>
              <b style={{ color: 'var(--ink)' }}>{modifier.sign > 0 ? '+' : '−'}{modifier.percent}% {modifier.kind === 'position' ? modifier.target : 'STAT'}</b>
            </div>
          ))}
        </div>
      </section>

      {savedLeagues.length > 0 && (
        <section className="saved-section">
          <div className="section-heading">
            <div>
              <span className="eyebrow">SAVED CONNECTIONS</span>
              <h2>Your league shortcuts</h2>
            </div>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                localStorage.removeItem(storageKey);
                setSavedLeagues([]);
              }}
            >
              Clear all ×
            </button>
          </div>

          <div className="saved-list">
            {savedLeagues.map((id) => (
              <div className="saved-league" key={id}>
                <span>{id}</span>
                <div>
                  <Link href={`/leagues/${id}`}>Open league →</Link>
                  <button type="button" onClick={() => removeLeague(id)} aria-label={`Remove league ${id}`}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
