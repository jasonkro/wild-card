import Link from 'next/link';

const playerRules = [
  ['Draft and manage', 'Build and manage your roster in Sleeper as usual. Sleeper remains the official record for rosters, matchups, player stats, and final points.'],
  ['Play the weekly twist', 'Each week has a published set of position and stat modifiers. The app applies those rules to the player performances pulled from Sleeper.'],
  ['Check your matchup', 'Use the league dashboard for the live view and open a matchup to see the player-by-player score breakdown.'],
  ['Wait for final scores', 'Scores can change while Sleeper is still receiving game data. The audit is meaningful after the commissioner finalizes the week in Sleeper.'],
];

const commissionerTasks = [
  ['Before the week', 'Review the upcoming modifier set in the commissioner desk and confirm the rules are ready before publishing them.'],
  ['During games', 'Manage the league in Sleeper normally. The app reads Sleeper data and does not replace Sleeper roster or scoring controls.'],
  ['After games', 'Review the final player and team scores in Sleeper. Enter any official corrections there using Sleeper’s commissioner tools.'],
  ['Run the audit', 'Open the league’s Verification page and check every team. A mismatch means the Sleeper final score and the modifier calculation need review.'],
  ['Resolve exceptions', 'Investigate any mismatch in the matchup detail view, then correct the official Sleeper score before treating the week as final.'],
];

const possibleModifiers = [
  ['POSITION', 'QB · RB · WR · TE · FLEX · K · DEF', 'A boost or penalty from -20% to +20% applies to every eligible player in that lineup position.'],
  ['STAT', 'PASS TD · RUSH TD · REC TD · INTERCEPTION · FUMBLE LOST', 'Touchdown events add 5% or 10%. Interceptions and fumbles lost subtract 5% or 10%.'],
];

export default function GuidePage() {
  return (
    <main className="guide-page">
      <div className="guide-top">
        <Link className="back-link" href="/">← Back to league board</Link>
        <Link className="guide-commissioner-link" href="/commissioner">Commissioner desk →</Link>
      </div>

      <header className="guide-header">
        <div>
          <span className="eyebrow">THE WILD CARD LEAGUE PLAYBOOK</span>
          <h1>How the league works.</h1>
        </div>
          <p className="guide-lede">Sleeper runs the league. Wild Card League adds the weekly layer, then checks the math when the games are done.</p>
      </header>

      <section className="guide-principle">
        <span className="eyebrow">ONE SOURCE OF TRUTH</span>
        <div>
          <h2>Sleeper is official.</h2>
          <p>Roster changes, matchups, player stats, and final team scores all come from Sleeper. Wild Card League calculates the weekly modifiers and gives the commissioner a clear audit trail. It never replaces the official league record.</p>
        </div>
      </section>

      <section className="guide-section">
        <div className="guide-section-heading">
          <span className="eyebrow">THE WILDCARD MENU</span>
          <h2>Possible modifiers</h2>
        </div>
        <div className="guide-possible-grid">
          {possibleModifiers.map(([type, targets, description]) => (
            <article className="guide-possible-card" key={type}>
              <span className="guide-number">{type}</span>
              <h3>{targets}</h3>
              <p>{description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-section">
        <div className="guide-section-heading">
          <span className="eyebrow">FOR EVERY MANAGER</span>
          <h2>Your weekly rhythm</h2>
        </div>
        <div className="guide-rule-list">
          {playerRules.map(([title, description], index) => (
            <article className="guide-rule" key={title}>
              <span className="guide-number">0{index + 1}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-section commissioner-guide-section">
        <div className="guide-section-heading">
          <span className="eyebrow">FOR COMMISSIONERS</span>
          <h2>Keep the record clean</h2>
        </div>
        <div className="guide-task-list">
          {commissionerTasks.map(([title, description], index) => (
            <article className="guide-task" key={title}>
              <span className="guide-task-marker">{index === commissionerTasks.length - 1 ? 'AUDIT' : `WEEK ${String(index + 1).padStart(2, '0')}`}</span>
              <div><h3>{title}</h3><p>{description}</p></div>
            </article>
          ))}
        </div>
      </section>

      <section className="guide-status-section">
        <div className="guide-section-heading">
          <span className="eyebrow">AUDIT STATUS</span>
          <h2>What the labels mean</h2>
        </div>
        <div className="guide-status-grid">
          <div><b className="guide-status correct">VERIFIED</b><p>Sleeper’s finalized team score matches the modifier-adjusted calculation.</p></div>
          <div><b className="guide-status check-needed">CHECK NEEDED</b><p>The official Sleeper score and the calculation do not match yet.</p></div>
          <div><b className="guide-status pending">AWAITING UPDATE</b><p>Sleeper has not supplied a final score for that team or week.</p></div>
        </div>
      </section>

      <footer className="guide-footer">
        <span>WILD CARD LEAGUE / PLAYBOOK</span>
        <Link href="/">Connect a league →</Link>
      </footer>
    </main>
  );
}
