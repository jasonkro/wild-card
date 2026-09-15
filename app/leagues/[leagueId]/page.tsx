"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const storageKey = "wild-card-leagues";
type SavedLeague = { id: string; name: string };

function secondsToRefresh() {
  return 60 - Math.floor((Date.now() % 60_000) / 1_000);
}

type Team = {
  name: string;
  matchupId: number;
  adjustedPoints: number;
  points: number;
  projectedBasePoints: number | null;
  projectedPoints: number | null;
};

type Dashboard = {
  league: { name: string; season: string };
  week: number;
  currentWeek: number;
  modifiersAvailable: boolean;
  upcomingWeek: number;
  upcomingModifiersAvailable: boolean;
  upcomingModifiers: {
    target?: string;
    label: string;
    kind: string;
    sign: number;
    percent: number;
    stats?: string[];
  }[];
  refreshedAt?: string;
  teams: Team[];
  modifiers: {
    target?: string;
    label: string;
    kind: string;
    sign: number;
    percent: number;
    stats?: string[];
  }[];
};

export default function LeaguePage() {
  const { leagueId } = useParams<{ leagueId: string }>();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const selectedWeekRef = useRef<number | null>(null);

  async function loadDashboard(isRetry = false, weekOverride?: number) {
    if (isRetry) {
      setRetryCount((prev) => prev + 1);
    } else {
      setRetryCount(0);
    }
    setLoading(true);
    setError(null);

    try {
      const week = weekOverride ?? selectedWeekRef.current;
      const weekQuery = week ? `?week=${week}` : "";
      const response = await fetch(`/api/leagues/${leagueId}/dashboard${weekQuery}`, {
        cache: "no-store",
      });
        if (response.status === 304) {
          setLoading(false);
          setRetryCount(0);
          return;
        }
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: string;
          retryAfter?: number;
        } | null;
        const errorMsg =
          payload?.error ||
          `League data is unavailable right now (${response.status}).`;
        setError(errorMsg);
        setLoading(false);

        // Auto-retry with exponential backoff for server errors
        if (response.status >= 500 || response.status === 429) {
          const delayMs = Math.min(1000 * Math.pow(2, retryCount), 30000); // Max 30 seconds
          const timer = setTimeout(() => {
            loadDashboard(true);
          }, delayMs);
          return () => clearTimeout(timer);
        }
        return;
      }

      const data = (await response.json()) as Dashboard;
      setDashboard(data);
      selectedWeekRef.current = data.week;
      saveLeague(data.league.name);
      if (data.refreshedAt) {
        setLastUpdated(data.refreshedAt);
        setSecondsUntilRefresh(
            secondsToRefresh(),
        );
      }
      setLoading(false);
      setRetryCount(0); // Reset retry count on success
    } catch {
      setError("Could not load this league dashboard. Please try again.");
      setLoading(false);

      // Auto-retry network errors
      const delayMs = Math.min(1000 * Math.pow(2, retryCount), 30000);
      const timer = setTimeout(() => {
        loadDashboard(true);
      }, delayMs);
      return () => clearTimeout(timer);
    }
  }

  useEffect(() => {
    loadDashboard();
    let refreshTimer: number | undefined;
    const firstRefresh = window.setTimeout(() => {
      loadDashboard();
      refreshTimer = window.setInterval(loadDashboard, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      window.clearTimeout(firstRefresh);
      if (refreshTimer) window.clearInterval(refreshTimer);
    };
  }, [leagueId]);

  useEffect(() => {
    if (!lastUpdated) return;
    const timer = window.setInterval(
      () =>
        setSecondsUntilRefresh(
          secondsToRefresh(),
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [lastUpdated]);

  function saveLeague(name: string) {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) || "[]") as (string | SavedLeague)[];
      const updated = [
        { id: leagueId, name: name || leagueId },
        ...saved
          .map((league) => typeof league === "string" ? { id: league, name: league } : league)
          .filter((league) => league.id !== leagueId),
      ].slice(0, 5);
      localStorage.setItem(storageKey, JSON.stringify(updated));
    } catch {
      // Handle error silently
    }
  }

  function changeWeek(week: number) {
    selectedWeekRef.current = week;
    loadDashboard(false, week);
  }

  const matchups = Array.from(
    new Set((dashboard?.teams || []).map((team) => team.matchupId)),
  ).map((matchupId) => ({
    matchupId,
    teams:
      dashboard?.teams.filter((team) => team.matchupId === matchupId) || [],
  }));

  return (
    <main className="league-page">
      <div className="league-nav-controls">
        <button
          className="menu-toggle"
          type="button"
          aria-label="Open league menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <span className="league-nav-name">
          {dashboard?.league.name || "Loading league"}
        </span>
        <span className="league-refresh-status">
          <span className="live-dot" />
          {loading
            ? "LOADING"
            : lastUpdated
              ? `UPDATED / ${secondsUntilRefresh}S`
              : "UPDATING"}
        </span>
      </div>
      {isMenuOpen && (
        <>
          <button
            className="drawer-backdrop"
            type="button"
            aria-label="Close league menu"
            onClick={() => setIsMenuOpen(false)}
          />
          <aside className="league-drawer" aria-label="League menu">
            <div className="league-drawer-header">
              <span className="eyebrow">LEAGUE MENU</span>
              <button
                className="drawer-close"
                type="button"
                aria-label="Close league menu"
                onClick={() => setIsMenuOpen(false)}
              >
                ×
              </button>
            </div>
            <Link href="/" onClick={() => setIsMenuOpen(false)}>
              SWITCH LEAGUES
            </Link>
            <Link
              href={`/leagues/${leagueId}/verification?week=${dashboard?.week || 1}`}
              onClick={() => setIsMenuOpen(false)}
            >
              VERIFY WEEK →
            </Link>
            <a
              href={`https://sleeper.app/leagues/${leagueId}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsMenuOpen(false)}
            >
              SLEEPER APP ↗
            </a>
          </aside>
        </>
      )}
      {error && (
        <div className="error-state">
          <p>{error}</p>
          <button onClick={() => loadDashboard()}>Try Again</button>
        </div>
      )}
      {dashboard && (
        <>
          <section className="league-modifiers">
            <div className="section-heading">
              <div>
                <span className="eyebrow">ACTIVE RULES</span>
              </div>
              <select
                className="league-week-select"
                id="league-week"
                aria-label="Select week"
                value={dashboard.week}
                onChange={(event) => changeWeek(Number(event.target.value))}
              >
                {Array.from({ length: 18 }, (_, index) => index + 1).map((week) => (
                  <option key={week} value={week}>
                    WEEK {String(week).padStart(2, "0")}
                  </option>
                ))}
              </select>
            </div>
            {!dashboard.modifiersAvailable ? (
              <p className="future-week-note">
                Modifiers will be revealed when Week {dashboard.week} is active.
              </p>
            ) : (
              <div className="next-modifier-list">
                {dashboard.modifiers.map((modifier) => (
                    <div
                      className="next-modifier"
                      style={{ background: "#e9e7df", borderLeftColor: "var(--coral)", color: "var(--ink)" }}
                      key={modifier.label}
                    >
                      <span>{modifier.label}</span>
                      <b style={{ color: "var(--ink)" }}>
                        {modifier.sign > 0 ? "+" : "−"}
                        {modifier.percent}% {modifier.kind === "position" ? modifier.target : modifier.stats?.[0] === "rec_td" ? "REC TD" : modifier.stats?.[0]?.replace("_", " ").toUpperCase() || "STAT"}
                      </b>
                    </div>
                ))}
              </div>
            )}
            {dashboard.week === dashboard.currentWeek &&
              dashboard.upcomingModifiersAvailable && (
                <div className="upcoming-modifiers">
                  <div className="upcoming-modifiers-heading">
                    <span className="eyebrow">UP NEXT / WEEK {dashboard.upcomingWeek}</span>
                    <span>REVEALED</span>
                  </div>
                  <div className="next-modifier-list">
                    {dashboard.upcomingModifiers.map((modifier) => (
                      <div
                        className="next-modifier"
                        style={{ background: "#e9e7df", borderLeftColor: "var(--coral)", color: "var(--ink)" }}
                        key={modifier.label}
                      >
                        <span>{modifier.label}</span>
                        <b style={{ color: "var(--ink)" }}>
                          {modifier.sign > 0 ? "+" : "−"}
                          {modifier.percent}% {modifier.kind === "position" ? modifier.target : modifier.stats?.[0] === "rec_td" ? "REC TD" : modifier.stats?.[0]?.replace("_", " ").toUpperCase() || "STAT"}
                        </b>
                      </div>
                    ))}
                  </div>
                </div>
              )}
          </section>
          <section className="league-matchups">
            <div className="section-heading">
              <div>
                <span className="eyebrow">CURRENT MATCHUPS</span>
                <h2>Live adjusted scores</h2>
              </div>
            </div>
            {matchups.map(({ matchupId, teams }) => (
              <div className="league-matchup" key={matchupId}>
                <div className="matchup-number">
                  MATCHUP {String(matchupId).padStart(2, "0")}
                </div>
                {teams.map((team) => (
                  <Link
                    className="league-team"
                    href={`/leagues/${leagueId}/matchups/${matchupId}?week=${dashboard.week}`}
                    key={team.name}
                  >
                      <span>
                        <b>{team.name}</b>
                      </span>
                      <small className="league-score-summary">
                        <span>
                          Actual {team.points.toFixed(1)} /{" "}
                          <b>{team.adjustedPoints.toFixed(1)}</b>
                        </span>
                        <span>
                          Projected {team.projectedBasePoints === null
                            ? "—"
                            : team.projectedBasePoints.toFixed(1)} /{" "}
                          <b>
                            {team.projectedPoints === null
                              ? "—"
                              : team.projectedPoints.toFixed(1)}
                          </b>
                        </span>
                      </small>
                  </Link>
                ))}
              </div>
            ))}
          </section>
        </>
      )}
    </main>
  );
}
