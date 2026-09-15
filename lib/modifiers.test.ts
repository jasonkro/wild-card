import test from 'node:test';
import assert from 'node:assert/strict';
import { getModifierSchedule } from './modifiers.ts';

test('next week modifiers stay hidden before Sunday 8pm ET', () => {
  const beforeReveal = new Date('2026-09-14T18:00:00-04:00');
  assert.equal(getModifierSchedule(beforeReveal).visibleToUsers, false);
});

test('next week modifiers become visible at Sunday 8pm ET', () => {
  const afterReveal = new Date('2026-09-13T20:00:00-04:00');
  assert.equal(getModifierSchedule(afterReveal).visibleToUsers, true);
});
