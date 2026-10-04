import test from 'node:test';
import assert from 'node:assert/strict';
import { formatSlotModifierTarget, getLineupSlotTarget, getModifierSchedule, getPositionModifierFactor, getRandomWeeklyModifiers, getWeeklyModifiers, WeeklyModifier } from './modifiers';

test('next week modifiers stay hidden before Sunday 8pm ET', () => {
  const beforeReveal = new Date('2026-09-14T18:00:00-04:00');
  assert.equal(getModifierSchedule(beforeReveal).visibleToUsers, false);
});

test('next week modifiers become visible at Sunday 8pm ET', () => {
  const afterReveal = new Date('2026-09-13T20:00:00-04:00');
  assert.equal(getModifierSchedule(afterReveal).visibleToUsers, true);
});

test('single-slot targets resolve only the first slot of each position type', () => {
  const slots = ['QB', 'RB', 'RB', 'WR', 'FLEX', 'FLEX', 'TE'];
  assert.equal(getLineupSlotTarget(slots, 0), 'QB1');
  assert.equal(getLineupSlotTarget(slots, 1), 'RB1');
  assert.equal(getLineupSlotTarget(slots, 2), undefined);
  assert.equal(getLineupSlotTarget(slots, 3), 'WR1');
  assert.equal(getLineupSlotTarget(slots, 4), 'FLEX1');
  assert.equal(getLineupSlotTarget(slots, 5), undefined);
  assert.equal(getLineupSlotTarget(slots, 6), 'TE1');
});

test('slot modifier labels omit the ordinal when a position has only one lineup slot', () => {
  const slots = ['QB', 'RB', 'RB', 'WR', 'TE', 'FLEX', 'FLEX', 'K', 'DEF'];
  assert.equal(formatSlotModifierTarget('QB1', slots), 'QB');
  assert.equal(formatSlotModifierTarget('RB1', slots), 'RB1');
  assert.equal(formatSlotModifierTarget('FLEX1', slots), 'FLEX1');
});

test('single-slot modifiers only affect their matching slot and stack with position rules', () => {
  const modifiers: WeeklyModifier[] = [
    { kind: 'position', target: 'RB', label: 'RUSH HOUR', sign: 1, percent: 10 },
    { kind: 'slot', target: 'RB1', label: 'RUSH LIMIT', sign: -1, percent: 50 },
  ];
  assert.equal(getPositionModifierFactor(modifiers, 'RB', 'RB1'), -0.4);
  assert.equal(getPositionModifierFactor(modifiers, 'RB', undefined), 0.1);
  assert.equal(getPositionModifierFactor(modifiers, 'WR', 'WR1'), 0);
});

test('randomized position percentages stay within -50% to +100%', () => {
  for (const modifier of getRandomWeeklyModifiers()) {
    const signedPercent = modifier.sign * modifier.percent;
    assert.ok(signedPercent >= -50 && signedPercent <= 100);
  }
});

test('randomized modifier sets start with a +100% single slot and obey group exclusions', () => {
  const sets = [...Array.from({ length: 200 }, () => getRandomWeeklyModifiers()), ...Array.from({ length: 96 }, (_, index) => getWeeklyModifiers(index + 3))];
  for (const modifiers of sets) {
    assert.equal(modifiers.length, 3);
    const first = modifiers[0];
    assert.equal(first.kind, 'slot');
    assert.equal(first.sign, 1);
    assert.equal(first.percent, 100);
    assert.ok(first.target?.endsWith('1'));

    const firstPosition = first.target?.slice(0, -1) as WeeklyModifier['target'];
    const groupTargets = modifiers.slice(1).map((modifier) => modifier.target);
    assert.ok(modifiers.slice(1).every((modifier) => modifier.kind === 'position'));
    assert.equal(modifiers[1].sign, 1);
    assert.equal(modifiers[1].percent, 50);
    assert.equal(modifiers[2].sign, -1);
    assert.equal(modifiers[2].percent, 50);
    assert.equal(new Set(groupTargets).size, 2);
    assert.ok(!groupTargets.includes(firstPosition));
    assert.ok(!(groupTargets.includes('K') && groupTargets.includes('DEF')));
    if (firstPosition === 'K' || firstPosition === 'DEF') {
      assert.ok(!groupTargets.includes('K') && !groupTargets.includes('DEF'));
    }
  }
});
