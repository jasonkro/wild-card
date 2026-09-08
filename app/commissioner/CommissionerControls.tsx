'use client';

import { useState } from 'react';
import { WeeklyModifier } from '@/lib/modifiers';

const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'] as const;
const positiveEvents = ['pass_td', 'rush_td', 'rec_td'] as const;
const negativeEvents = ['int', 'fum_lost'] as const;
const statValues = ['5', '10'];
const positionValues = ['+5', '+10', '+15', '+20', '-5', '-10', '-15', '-20'];

export default function CommissionerControls({ initialWeeks }: { initialWeeks: Record<string, WeeklyModifier[]> }) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const [selectedWeek, setSelectedWeek] = useState(2);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const modifiers = weeks[String(selectedWeek)] || [];

  function update(index: number, changes: Partial<WeeklyModifier>) {
    setWeeks((current) => ({ ...current, [selectedWeek]: current[String(selectedWeek)].map((modifier, itemIndex) => itemIndex === index ? { ...modifier, ...changes } : modifier) }));
  }

  function updateStatEvent(index: number, event: typeof positiveEvents[number] | typeof negativeEvents[number]) {
    update(index, { stats: [event], sign: negativeEvents.includes(event as typeof negativeEvents[number]) ? -1 : 1 });
  }

  async function save() {
    setMessage('');
    setSaving(true);
    try {
      const response = await fetch('/api/commissioner/modifiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week: selectedWeek, modifiers }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save modifiers.');
      setWeeks((current) => ({ ...current, [selectedWeek]: result.modifiers }));
      setMessage(`Global modifiers saved for Week ${selectedWeek} (${result.storage || 'local'}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save modifiers.');
    } finally {
      setSaving(false);
    }
  }

  async function randomizeWeek() {
    setMessage('');
    setSaving(true);
    try {
      const response = await fetch('/api/commissioner/modifiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'randomize', week: selectedWeek }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not randomize this week\'s modifiers.');
      setWeeks((current) => ({ ...current, [selectedWeek]: result.modifiers }));
      setMessage(`Week ${selectedWeek} randomized and saved (${result.storage || 'local'}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not randomize this week\'s modifiers.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="commissioner-week-toolbar"><label htmlFor="commissioner-week">VIEW WEEK</label><select id="commissioner-week" value={selectedWeek} onChange={(event) => { setSelectedWeek(Number(event.target.value)); setMessage(''); }}>{Array.from({ length: 18 }, (_, index) => <option value={index + 1} key={index + 1}>WEEK {String(index + 1).padStart(2, '0')}</option>)}</select><button className="secondary-button" type="button" onClick={randomizeWeek} disabled={saving}>Randomize Week {selectedWeek}</button></div>
    <div className="commissioner-modifier-grid">{modifiers.map((modifier, index) => <div className="control-modifier" key={index}><div className="control-modifier-header"><span className="eyebrow">MODIFIER {String(index + 1).padStart(2, '0')}</span><span className="control-preview"><strong>{modifier.kind === 'stat' ? 'STAT' : modifier.target} {modifier.sign > 0 ? '+' : '−'}{modifier.percent}%</strong></span></div><div className="control-modifier-fields">{modifier.kind === 'stat' ? <><div><label htmlFor={`modifier-${selectedWeek}-${index}-stat`}>STAT EVENT</label><select id={`modifier-${selectedWeek}-${index}-stat`} value={modifier.stats?.[0] || 'rush_td'} onChange={(event) => updateStatEvent(index, event.target.value as typeof positiveEvents[number] | typeof negativeEvents[number])}>{[...positiveEvents, ...negativeEvents].map((event) => <option value={event} key={event}>{event.replace('_', ' ').toUpperCase()}</option>)}</select></div><div><label htmlFor={`modifier-${selectedWeek}-${index}-value`}>VALUE</label><select id={`modifier-${selectedWeek}-${index}-value`} value={`${modifier.sign * modifier.percent}`} onChange={(event) => update(index, { percent: Math.abs(Number(event.target.value)) as 5 | 10 })}>{statValues.map((value) => { const signedValue = modifier.sign * Number(value); return <option value={signedValue} key={value}>{signedValue > 0 ? '+' : '−'}{value}%</option>; })}</select></div></> : <><div><label htmlFor={`modifier-${selectedWeek}-${index}-target`}>POSITION</label><select id={`modifier-${selectedWeek}-${index}-target`} value={modifier.target} onChange={(event) => update(index, { target: event.target.value as typeof positions[number] })}>{positions.map((position) => <option key={position}>{position}</option>)}</select></div><div><label htmlFor={`modifier-${selectedWeek}-${index}-value`}>VALUE</label><select id={`modifier-${selectedWeek}-${index}-value`} value={`${modifier.sign * modifier.percent}`} onChange={(event) => { const numericValue = Number(event.target.value); update(index, { sign: numericValue >= 0 ? 1 : -1, percent: Math.abs(numericValue) as WeeklyModifier['percent'] }); }}>{positionValues.map((value) => <option value={value} key={value}>{value}%</option>)}</select></div></>}</div><p className="modifier-name">{modifier.kind === 'stat' ? `${modifier.sign > 0 ? '+' : '−'}${modifier.percent}% per ${modifier.stats?.map((stat) => stat.replace('_', ' ')).join(' + ')}` : modifier.label}</p></div>)}</div>
    <div className="save-row"><button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : `Save Week ${selectedWeek} modifiers`} <span>↗</span></button>{message && <span className="save-message">{message}</span>}</div>
  </>;
}
