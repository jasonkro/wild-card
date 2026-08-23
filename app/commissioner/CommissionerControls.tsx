'use client';

import { useState } from 'react';
import { WeeklyModifier } from '@/lib/modifiers';

const positions = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'] as const;
const events = ['pass_td', 'rush_td', 'rec_td', 'int', 'fum_lost'] as const;
const values = ['+5', '+10', '+15', '+20', '-5', '-10', '-15', '-20'];

export default function CommissionerControls({ initialModifiers }: { initialModifiers: WeeklyModifier[] }) {
  const [modifiers, setModifiers] = useState(initialModifiers);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  function update(index: number, changes: Partial<WeeklyModifier>) {
    setModifiers((current) => current.map((modifier, itemIndex) => itemIndex === index ? { ...modifier, ...changes } : modifier));
  }

  async function save() {
    setMessage('');
    setSaving(true);
    try {
      const response = await fetch('/api/commissioner/modifiers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ week: 2, modifiers }) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Could not save modifiers.');
      setModifiers(result.modifiers);
      setMessage(`Global modifiers saved for Week 2 (${result.storage || 'local'}).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not save modifiers.');
    } finally {
      setSaving(false);
    }
  }

  return <>
    <div className="commissioner-modifier-grid">{modifiers.map((modifier, index) => <div className="control-modifier" key={index}><div className="control-modifier-header"><span className="eyebrow">MODIFIER {String(index + 1).padStart(2, '0')}</span><span className="control-preview"><strong>{modifier.kind === 'stat' ? 'STAT' : modifier.target} {modifier.sign > 0 ? '+' : '−'}{modifier.percent}%</strong></span></div><div className="control-modifier-fields">{modifier.kind === 'stat' ? <div><label htmlFor={`modifier-${index}-stat`}>EVENT</label><select id={`modifier-${index}-stat`} value={modifier.stats?.[0] || 'rush_td'} onChange={(event) => update(index, { stats: [event.target.value as typeof events[number]] })}>{events.map((event) => <option value={event} key={event}>{event.replace('_', ' ').toUpperCase()}</option>)}</select></div> : <div><label htmlFor={`modifier-${index}-target`}>TARGET</label><select id={`modifier-${index}-target`} value={modifier.target} onChange={(event) => update(index, { target: event.target.value as typeof positions[number] })}>{positions.map((position) => <option key={position}>{position}</option>)}</select></div>}<div><label htmlFor={`modifier-${index}-value`}>VALUE</label><select id={`modifier-${index}-value`} value={`${modifier.sign * modifier.percent}`} onChange={(event) => { const numericValue = Number(event.target.value); update(index, { sign: numericValue >= 0 ? 1 : -1, percent: Math.abs(numericValue) as WeeklyModifier['percent'] }); }}>{values.map((value) => <option value={value} key={value}>{value}%</option>)}</select></div></div><p className="modifier-name">{modifier.kind === 'stat' ? `${modifier.sign > 0 ? '+' : '−'}${modifier.percent}% per ${modifier.stats?.map((stat) => stat.replace('_', ' ')).join(' + ')}` : modifier.label}</p></div>)}</div>
    <div className="save-row"><button className="primary-button" type="button" onClick={save} disabled={saving}>{saving ? 'Saving...' : 'Save global modifiers'} <span>↗</span></button>{message && <span className="save-message">{message}</span>}</div>
  </>;
}
