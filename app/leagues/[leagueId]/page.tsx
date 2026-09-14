"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const storageKey = "wild-card-leagues";

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
  const [isSaved, setIsSaved] = useState(false);
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
      if (data.refreshedAt) {
        setLastUpdated(data.refreshedAt);
        setSecondsUntilRefresh(
          Math.max(
            0,
            60 - Math.floor((Date.now() - Date.parse(data.refreshedAt)) / 1000),
          ),
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
    const refreshTimer = window.setInterval(loadDashboard, 60_000);
    return () => window.clearInterval(refreshTimer);
  }, [leagueId]);

  useEffect(() => {
    if (!lastUpdated) return;
    const timer = window.setInterval(
      () =>
        setSecondsUntilRefresh(
          Math.max(
            0,
            60 - Math.floor((Date.now() - Date.parse(lastUpdated)) / 1000),
          ),
        ),
      1000,
    );
    return () => window.clearInterval(timer);
  }, [lastUpdated]);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem(storageKey) || "[]",
      ) as string[];
      setIsSaved(saved.includes(leagueId));
    } catch {
      setIsSaved(false);
    }
  }, [leagueId]);

  function addLeague() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(storageKey) || "[]",
      ) as string[];
      const updated = [
        leagueId,
        ...saved.filter((id) => id !== leagueId),
      ].slice(0, 5);
      localStorage.setItem(storageKey, JSON.stringify(updated));
      setIsSaved(true);
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
      <Link className="back-link" href="/">
        ← Back to leagues
      </Link>
      {loading && <p className="page-note">Loading league dashboard...</p>}
      {error && (
        <div className="error-state">
          <p>{error}</p>
          <button onClick={() => loadDashboard()}>Try Again</button>
        </div>
      )}
      {dashboard && (
        <>
          <div className="league-page-header">
            <div>
              <span className="eyebrow">
                {dashboard.league.season} SLEEPER LEAGUE / WEEK{" "}
                {String(dashboard.week).padStart(2, "0")}
              </span>
              <h1>{dashboard.league.name}</h1>
            </div>
            <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
              <Link
                className="status-pill dark-pill"
                href={`/leagues/${leagueId}/verification?week=${dashboard.week}`}
              >
                VERIFY WEEK →
              </Link>
              <a
                className="status-pill dark-pill"
                href={`https://sleeper.app/leagues/${leagueId}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                SLEEPER APP ↗
              </a>
              <button
                onClick={addLeague}
                className="status-pill"
                style={{
                  border: isSaved ? "1px solid #c9cec6" : "1px solid #d4ef52",
                  background: isSaved ? "transparent" : "var(--lime)",
                  color: isSaved ? "var(--ink)" : "var(--dark)",
                  cursor: isSaved ? "default" : "pointer",
                  opacity: isSaved ? 0.6 : 1,
                }}
                disabled={isSaved}
              >
                {isSaved ? "✓ SAVED" : "ADD LEAGUE"}
              </button>
            </div>
          </div>
          <div className="league-status">
            <span>
              <span className="live-dot" />{" "}
              {lastUpdated
                ? `UPDATED / NEXT IN ${secondsUntilRefresh}S`
                : "WAITING FOR REFRESH"}
            </span>
            <span>
              {dashboard.teams.length} TEAMS / {matchups.length} MATCHUPS
            </span>
          </div>
          <div className="league-week-toolbar">
            <label htmlFor="league-week">VIEW WEEK</label>
            <select
              id="league-week"
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
          <section className="league-modifiers">
            <div className="section-heading">
              <div>
                <span className="eyebrow">
                  {!dashboard.modifiersAvailable
                    ? "RULES LOCKED"
                    : "ACTIVE RULES"}
                </span>
                <h2>Week {dashboard.week} modifiers</h2>
              </div>
              <Link
                className="text-button"
                href={`/leagues/${leagueId}/verification?week=${dashboard.week}`}
              >
                Audit scores →
              </Link>
            </div>
            {!dashboard.modifiersAvailable ? (
              <p className="future-week-note">
                Modifiers will be revealed when Week {dashboard.week} is active.
              </p>
            ) : (
              <div className="next-modifier-list">
                {dashboard.modifiers.map((modifier) => (
                  <div className="next-modifier" key={modifier.label}>
                    <span>{modifier.label}</span>
                    <strong>
                      {modifier.kind === "stat" ? "STAT" : modifier.target}
                    </strong>
                    <b>
                      {modifier.sign > 0 ? "+" : "−"}
                      {modifier.percent}%
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
                      <div className="next-modifier" key={modifier.label}>
                        <span>{modifier.label}</span>
                        <strong>
                          {modifier.kind === "stat" ? "STAT" : modifier.target}
                        </strong>
                        <b>
                          {modifier.sign > 0 ? "+" : "−"}
                          {modifier.percent}%
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
