"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Player = {
  id: string;
  name: string;
  position: string;
  slot: string;
  points: number;
  modifier: string;
  adjustment: number;
  adjustedPoints: number;
  projectedPoints: number | null;
  projectedAdjustedPoints: number | null;
};
type Team = {
  name: string;
  matchupId: number;
  points: number;
  adjustedPoints: number;
  projectedBasePoints: number | null;
  projectedPoints: number | null;
  adjustment: number;
  playerBreakdown: Player[];
};
type Modifier = {
  target?: string;
  label: string;
  kind: string;
  sign: number;
  percent: number;
};

function secondsToRefresh() {
  return 60 - Math.floor((Date.now() % 60_000) / 1_000);
}
export default function MatchupPage() {
  const params = useParams<{ leagueId: string; matchupId: string }>();
  const searchParams = useSearchParams();
  const week = searchParams.get("week") || "1";
  const [teams, setTeams] = useState<Team[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [secondsUntilRefresh, setSecondsUntilRefresh] = useState(0);

  useEffect(() => {
    let active = true;
    async function loadMatchup() {
      setLoading(true);
      try {
        const response = await fetch(`/api/leagues/${params.leagueId}/dashboard?week=${week}`, {
          cache: "no-store",
        });
        if (!response.ok || !active) return;
        const data = (await response.json()) as { league?: { name?: string }; modifiers?: Modifier[]; teams?: Team[]; refreshedAt?: string };
        setLeagueName(data.league?.name || "Sleeper league");
        setModifiers(data.modifiers || []);
        setTeams((data.teams || []).filter((team) => String(team.matchupId) === params.matchupId));
        setLastUpdated(data.refreshedAt || null);
        if (data.refreshedAt) {
          setSecondsUntilRefresh(
            secondsToRefresh(),
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMatchup();
    let refreshTimer: number | undefined;
    const firstRefresh = window.setTimeout(() => {
      loadMatchup();
      refreshTimer = window.setInterval(loadMatchup, 60_000);
    }, 60_000 - (Date.now() % 60_000));
    return () => {
      active = false;
      window.clearTimeout(firstRefresh);
      if (refreshTimer) window.clearInterval(refreshTimer);
    };
  }, [params.leagueId, params.matchupId, week]);

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

  return (
    <main className="matchup-page">
      <div className="league-nav-controls">
        <button
          className="menu-toggle"
          type="button"
          aria-label="Open matchup menu"
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen(true)}
        >
          <span />
          <span />
          <span />
        </button>
        <span className="league-nav-name">{leagueName || "Loading league"}</span>
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
          <button className="drawer-backdrop" type="button" aria-label="Close matchup menu" onClick={() => setIsMenuOpen(false)} />
          <aside className="league-drawer" aria-label="Matchup menu">
            <div className="league-drawer-header">
              <span className="eyebrow">MATCHUP MENU</span>
              <button className="drawer-close" type="button" aria-label="Close matchup menu" onClick={() => setIsMenuOpen(false)}>×</button>
            </div>
            <Link href="/" onClick={() => setIsMenuOpen(false)}>SWITCH LEAGUES</Link>
            <Link href={`/leagues/${params.leagueId}`} onClick={() => setIsMenuOpen(false)}>← BACK TO LEAGUE</Link>
            <Link href={`/leagues/${params.leagueId}/verification?week=${week}`} onClick={() => setIsMenuOpen(false)}>VERIFY WEEK →</Link>
            <a href={`https://sleeper.app/leagues/${params.leagueId}`} target="_blank" rel="noopener noreferrer" onClick={() => setIsMenuOpen(false)}>SLEEPER APP ↗</a>
          </aside>
        </>
      )}
      <div className="matchup-context-line">
        ACTIVE RULES / WEEK {String(week).padStart(2, "0")}
      </div>
      {!loading && modifiers.length > 0 && (
        <div className="next-modifier-list matchup-modifiers-compact">
          {modifiers.map((modifier) => (
            <div
              className="next-modifier"
              style={{
                background: "#e9e7df",
                borderLeftColor: "var(--coral)",
                color: "var(--ink)",
              }}
              key={modifier.label}
            >
              <span>{modifier.label}</span>
              <b style={{ color: "var(--ink)" }}>
                {modifier.sign > 0 ? "+" : "−"}
                {modifier.percent}% {modifier.kind === "position" ? modifier.target : "STAT"}
              </b>
            </div>
          ))}
        </div>
      )}
      {loading && <p className="page-note">Loading matchup data...</p>}
      {!loading && teams.length === 0 && (
        <p className="page-note">No matchup data is available for this week.</p>
      )}
      {!loading && teams.length > 0 && (
        <div className="matchup-team-panels">
          {teams.map((team) => (
            <section className="matchup-team-panel" key={team.name}>
              <div className="panel-heading">
                <div>
                  <h2 title={team.name}>{team.name}</h2>
                      <small className="league-score-summary matchup-team-score">
                        <span>
                          <span className="summary-label-full">Actual</span><span className="summary-label-short">Act.</span>{" "}<b className="team-total-actual">{team.points.toFixed(1)}</b> /{" "}
                          <b className="team-total-adjusted">{team.adjustedPoints.toFixed(1)}</b>
                        </span>
                        <span>
                          <span className="summary-label-full">Projected</span><span className="summary-label-short">Proj.</span>{" "}<span className="team-total-base">{team.projectedBasePoints === null
                            ? "—"
                            : team.projectedBasePoints.toFixed(1)}</span> /{" "}
                          <b>
                            {team.projectedPoints === null
                              ? "—"
                              : team.projectedPoints.toFixed(1)}
                          </b>
                        </span>
                      </small>
                </div>
              </div>
              <div className="player-table">
                <div className="player-table-head">
                  <span>STARTER</span>
                  <span>MODIFIER</span>
                  <span>SCORE</span>
                </div>
                {team.playerBreakdown.map((player) => (
                  <div className="player-table-row" key={player.id}>
                    <div>
                      <b>{player.name}</b>
                      <div className="player-meta">
                        <small className="player-position">
                          {player.position === player.slot
                            ? player.position
                            : `${player.position} / ${player.slot}`}
                        </small>
                        {player.modifier !== "—" && (
                          <span className="player-mobile-modifier">
                            {player.slot === "FLEX" && player.modifier.startsWith("FLEX ")
                              ? `FLEX/${player.position}${player.modifier.slice(4)}`
                              : player.modifier}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="player-modifier">{player.modifier}</div>
                    <div className="score-stack">
                      <div className="score-line score-line-actual">
                        <span className="score-line-prefix"><span className="score-label-full">Actual</span><span className="score-label-short">Act.</span> {player.points.toFixed(1)} / </span>
                        <strong>{player.adjustedPoints.toFixed(1)}</strong>
                      </div>
                      <div className="score-line score-line-projection">
                        <span className="score-line-prefix">
                          <span className="score-label-full">Projected</span><span className="score-label-short">Proj.</span>{" "}
                          {player.projectedPoints === null
                            ? "—"
                            : player.projectedPoints.toFixed(1)}{" "}
                          /{" "}
                        </span>
                        <strong>
                          {player.projectedAdjustedPoints === null
                            ? "—"
                            : player.projectedAdjustedPoints.toFixed(1)}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}
