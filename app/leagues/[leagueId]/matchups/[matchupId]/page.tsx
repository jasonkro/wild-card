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

export default function MatchupPage() {
  const params = useParams<{ leagueId: string; matchupId: string }>();
  const searchParams = useSearchParams();
  const week = searchParams.get("week") || "1";
  const [teams, setTeams] = useState<Team[]>([]);
  const [modifiers, setModifiers] = useState<Modifier[]>([]);
  const [leagueName, setLeagueName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadMatchup() {
      try {
        const response = await fetch(`/api/leagues/${params.leagueId}/dashboard?week=${week}`, {
          cache: "no-store",
        });
        if (!response.ok || !active) return;
        const data = (await response.json()) as { league?: { name?: string }; modifiers?: Modifier[]; teams?: Team[] };
        setLeagueName(data.league?.name || "Sleeper league");
        setModifiers(data.modifiers || []);
        setTeams((data.teams || []).filter((team) => String(team.matchupId) === params.matchupId));
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadMatchup();
    const refreshTimer = window.setInterval(loadMatchup, 60_000);
    return () => {
      active = false;
      window.clearInterval(refreshTimer);
    };
  }, [params.leagueId, params.matchupId, week]);

  return (
    <main className="matchup-page">
      <Link className="back-link" href="/">
        ← Back to league board
      </Link>
      <div className="matchup-page-header">
        <div>
          <span className="eyebrow">
            {leagueName || "SLEEPER LEAGUE"} / WEEK{" "}
            {String(week).padStart(2, "0")}
          </span>
          <h1>Matchup {params.matchupId}</h1>
        </div>
        <span className="status-pill dark-pill">AUDIT VIEW</span>
      </div>
      {!loading && modifiers.length > 0 && (
        <section className="matchup-modifiers">
          <div className="section-heading">
            <div>
              <span className="eyebrow">ACTIVE RULES</span>
              <h2>Week {week} modifiers</h2>
            </div>
            <Link
              className="text-button"
              href={`/leagues/${params.leagueId}/verification?week=${week}`}
            >
              Audit scores →
            </Link>
          </div>
          <div className="next-modifier-list">
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
                  {modifier.percent}%{" "}
                  {modifier.kind === "position" ? modifier.target : "STAT"}
                </b>
              </div>
            ))}
          </div>
        </section>
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
                  <span className="eyebrow">TEAM</span>
                  <h2>{team.name}</h2>
                      <small className="league-score-summary matchup-team-score">
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
                </div>
                <strong>{team.adjustedPoints.toFixed(1)}</strong>
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
                      <small>
                        {player.position === player.slot
                          ? player.position
                          : `${player.position} / ${player.slot}`}
                      </small>
                    </div>
                    <div className="player-modifier">{player.modifier}</div>
                    <div className="score-stack">
                      <div className="score-line score-line-actual">
                        <span>Actual {player.points.toFixed(1)} / </span>
                        <strong>{player.adjustedPoints.toFixed(1)}</strong>
                      </div>
                      <div className="score-line score-line-projection">
                        <span>
                          Projected{" "}
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
