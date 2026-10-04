'use client';

import { useState } from 'react';
import { getPositionModifierLabel, getWeeklyModifiers, positionTargets, slotTargets, WeeklyModifier } from '@/lib/modifiers';

const positiveEvents = ['pass_td', 'rush_td', 'rec_td'] as const;
const negativeEvents = ['int', 'fum_lost'] as const;
const statValues = ['5', '10'];

export default function CommissionerControls({ initialWeeks }: { initialWeeks: Record<string, WeeklyModifier[]> }) {
  const [weeks, setWeeks] = useState(initialWeeks);
  const [selectedWeek, setSelectedWeek] = useState(2);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  const modifiers = weeks[String(selectedWeek)] || [];

  function update(index: number, changes: Partial<WeeklyModifier>) {
    setWeeks((current) => ({
      ...current,
      [selectedWeek]: current[String(selectedWeek)].map((modifier, itemIndex) => {
        if (itemIndex !== index) return modifier;
        const updated = { ...modifier, ...changes };
        return (updated.kind === 'position' || updated.kind === 'slot') && updated.target
          ? { ...updated, label: getPositionModifierLabel(updated.target, updated.sign) }
          : updated;
      }),
    }));
  }

  function updateStatEvent(index: number, event: typeof positiveEvents[number] | typeof negativeEvents[number]) {
    update(index, { stats: [event], label: event.replace('_', ' ').toUpperCase(), sign: negativeEvents.includes(event as typeof negativeEvents[number]) ? -1 : 1 });
  }

  function updateKind(index: number, kind: WeeklyModifier['kind']) {
    if (kind === 'position' || kind === 'slot') {
      const targets = kind === 'position' ? positionTargets : slotTargets;
      const target = targets.includes(modifiers[index].target as never) ? modifiers[index].target! : targets[0];
      update(index, { kind, target, label: getPositionModifierLabel(target, modifiers[index].sign), stats: undefined });
      return;
    }
    const event = modifiers[index].stats?.[0] || 'rush_td';
    const sign = negativeEvents.includes(event as typeof negativeEvents[number]) ? -1 : 1;
    update(index, { kind, target: undefined, stats: [event], label: event.replace('_', ' ').toUpperCase(), sign, percent: [5, 10].includes(modifiers[index].percent) ? modifiers[index].percent : 10 });
  }

  function updateSignedPercent(index: number, value: number) {
    if (!Number.isInteger(value) || value < -50 || value > 100) return;
    update(index, { sign: value < 0 ? -1 : 1, percent: Math.abs(value) });
  }

  function startManualEdit() {
    setWeeks((current) => ({
      ...current,
      [selectedWeek]: current[String(selectedWeek)]?.length === 3
        ? current[String(selectedWeek)]
        : getWeeklyModifiers(selectedWeek),
    }));
    setMessage(`Week ${selectedWeek} is ready to edit. Changes take effect when saved.`);
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

  async function clearSelectedAndFutureWeeks() {
    const confirmed = window.confirm(`Clear modifiers for Week ${selectedWeek} and every future week through Week 18?`);
    if (!confirmed) return;

    setMessage('');
    setSaving(true);
    try {
      const response = await fetch('/api/commissioner/modifiers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'clear-from-week', week: selectedWeek }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not clear modifiers.');
      setWeeks((current) => {
        const updated = { ...current };
        for (let week = selectedWeek; week <= 18; week += 1) updated[String(week)] = [];
        return updated;
      });
      setMessage(`Cleared modifiers for Weeks ${selectedWeek}–18 (${result.storage || 'local'}). Randomize a week to create a new set.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not clear modifiers.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="commissioner-week-toolbar">
      <label htmlFor="commissioner-week">VIEW WEEK</label>
      <select id="commissioner-week" value={selectedWeek} onChange={(event) => { setSelectedWeek(Number(event.target.value)); setMessage(''); }}>
        {Array.from({ length: 18 }, (_, index) => <option value={index + 1} key={index + 1}>WEEK {String(index + 1).padStart(2, '0')}</option>)}
      </select>
      <button className="secondary-button" type="button" onClick={randomizeWeek} disabled={saving}>Randomize Week {selectedWeek}</button>
      <button className="secondary-button clear-button" type="button" onClick={clearSelectedAndFutureWeeks} disabled={saving}>Clear Week {selectedWeek} + Future</button>
      {modifiers.length === 0 && <button className="secondary-button" type="button" onClick={startManualEdit} disabled={saving}>Manually Edit Week {selectedWeek}</button>}
    </div>
    {modifiers.length === 0 && <p className="page-note">No modifiers are saved for this week. Start a manual set or randomize it to create an editable set.</p>}
    <div className="commissioner-modifier-grid">
      {modifiers.map((modifier, index) => {
        const signedPercent = modifier.sign * modifier.percent;
        const isPositionModifier = modifier.kind === 'position' || modifier.kind === 'slot';
        const targetOptions = modifier.kind === 'slot' ? slotTargets : positionTargets;
        return (
          <div className="control-modifier" key={index}>
            <div className="control-modifier-header">
              <span className="eyebrow">MODIFIER {String(index + 1).padStart(2, '0')}</span>
              <span className="control-preview"><strong>{modifier.kind === 'stat' ? 'STAT' : modifier.target} {signedPercent > 0 ? '+' : '−'}{modifier.percent}%</strong></span>
            </div>
            <div className="commissioner-modifier-type">
              <label htmlFor={`modifier-${selectedWeek}-${index}-kind`}>MODIFIER TYPE</label>
              <select
                id={`modifier-${selectedWeek}-${index}-kind`}
                value={modifier.kind}
                onChange={(event) => updateKind(index, event.target.value as WeeklyModifier['kind'])}
              >
                <option value="position">POSITION</option>
                <option value="slot">SINGLE SLOT</option>
                <option value="stat">STAT EVENT</option>
              </select>
            </div>
            <div className="control-modifier-fields">
              {modifier.kind === 'stat' ? <>
                <div>
                  <label htmlFor={`modifier-${selectedWeek}-${index}-stat`}>STAT EVENT</label>
                  <select id={`modifier-${selectedWeek}-${index}-stat`} value={modifier.stats?.[0] || 'rush_td'} onChange={(event) => updateStatEvent(index, event.target.value as typeof positiveEvents[number] | typeof negativeEvents[number])}>
                    {[...positiveEvents, ...negativeEvents].map((event) => <option value={event} key={event}>{event.replace('_', ' ').toUpperCase()}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`modifier-${selectedWeek}-${index}-value`}>VALUE</label>
                  <select id={`modifier-${selectedWeek}-${index}-value`} value={`${signedPercent}`} onChange={(event) => update(index, { percent: Math.abs(Number(event.target.value)) })}>
                    {statValues.map((value) => {
                      const signedValue = modifier.sign * Number(value);
                      return <option value={signedValue} key={value}>{signedValue > 0 ? '+' : '−'}{value}%</option>;
                    })}
                  </select>
                </div>
              </> : isPositionModifier ? <>
                <div>
                  <label htmlFor={`modifier-${selectedWeek}-${index}-target`}>{modifier.kind === 'slot' ? 'LINEUP SLOT' : 'POSITION'}</label>
                  <select id={`modifier-${selectedWeek}-${index}-target`} value={modifier.target} onChange={(event) => update(index, { target: event.target.value as WeeklyModifier['target'] })}>
                    {targetOptions.map((target) => <option key={target} value={target}>{target}</option>)}
                  </select>
                </div>
                <div>
                  <label htmlFor={`modifier-${selectedWeek}-${index}-value`}>VALUE (-50% TO +100%)</label>
                  <input
                    id={`modifier-${selectedWeek}-${index}-value`}
                    type="number"
                    min={-50}
                    max={100}
                    step={1}
                    value={signedPercent}
                    onChange={(event) => updateSignedPercent(index, Number(event.target.value))}
                  />
                </div>
              </> : null}
            </div>
          </div>
        );
      })}
    </div>
    <div className="save-row">
      <button className="primary-button" type="button" onClick={save} disabled={saving || modifiers.length !== 3}>{saving ? 'Saving...' : `Save Week ${selectedWeek} modifiers`} <span>↗</span></button>
      {message && <span className="save-message">{message}</span>}
    </div>
  </>;
}
