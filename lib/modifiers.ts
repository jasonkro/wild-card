export type WeeklyModifier = {
  kind: 'position' | 'stat';
  target?: 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF';
  label: string;
  sign: 1 | -1;
  percent: 5 | 10 | 15 | 20 | 25;
  stats?: ('pass_td' | 'rush_td' | 'rec_td' | 'int' | 'fum_lost')[];
};
type PositionTarget = NonNullable<WeeklyModifier['target']>;

const positionLabels: Record<PositionTarget, { positive: string; negative: string }> = {
  QB: { positive: 'AIR RAID', negative: 'AIR POCKET' },
  RB: { positive: 'RUSH HOUR', negative: 'RUSH LIMIT' },
  WR: { positive: 'WIDE OPEN', negative: 'TIGHT COVERAGE' },
  TE: { positive: 'TIGHT WINDOW', negative: 'TIGHT SQUEEZE' },
  FLEX: { positive: 'LONG SHOT', negative: 'SHORT LEASH' },
  K: { positive: 'BOOT LEG', negative: 'COLD FOOT' },
  DEF: { positive: 'LOCKDOWN', negative: 'SOFT COVERAGE' },
};

export function getPositionModifierLabel(target: PositionTarget, sign: 1 | -1) {
  return positionLabels[target][sign > 0 ? 'positive' : 'negative'];
}

export function normalizeWeeklyModifiers(modifiers: WeeklyModifier[]) {
  return modifiers.map((modifier) => modifier.kind === 'position' && modifier.target
    ? { ...modifier, label: getPositionModifierLabel(modifier.target, modifier.sign) }
    : { ...modifier });
}

const weekOneModifiers: WeeklyModifier[] = [
  { kind: 'position', target: 'RB', label: 'RUSH HOUR', sign: 1, percent: 20 },
  { kind: 'position', target: 'QB', label: 'AIR RAID', sign: -1, percent: 10 },
  { kind: 'position', target: 'FLEX', label: 'LONG SHOT', sign: 1, percent: 15 },
];

export const modifierTimezone = 'America/New_York';

function easternScheduleParts(now: Date) {
  return new Intl.DateTimeFormat('en-US', { timeZone: modifierTimezone, weekday: 'short', hour: 'numeric', minute: 'numeric', hour12: false }).formatToParts(now);
}

export function getModifierSchedule(now = new Date()) {
  const parts = easternScheduleParts(now);
  const weekday = parts.find((part) => part.type === 'weekday')?.value;
  const hour = Number(parts.find((part) => part.type === 'hour')?.value);
  const sundayRevealWindowOpen = weekday === 'Sun' && hour >= 20;
  return { locked: !sundayRevealWindowOpen, visibleToUsers: sundayRevealWindowOpen, timezone: modifierTimezone, lockTime: 'Sunday 8:00 PM ET', revealTime: 'Sunday 8:00 PM ET' };
}

export function getWeeklyModifiers(_week: number): WeeklyModifier[] {
  if (_week === 1) return weekOneModifiers.map((modifier) => ({ ...modifier }));
  if (_week === 2) return [
    { kind: 'position', target: 'RB', label: 'RUSH HOUR', sign: 1, percent: 20 },
    { kind: 'position', target: 'QB', label: 'AIR RAID', sign: -1, percent: 10 },
    { kind: 'position', target: 'WR', label: 'WIDE OPEN', sign: 1, percent: 5 },
  ];

  let seed = (_week * 2654435761) >>> 0;
  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const targets: PositionTarget[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
  const selected: PositionTarget[] = [];
  while (selected.length < 3) {
    const target = targets[Math.floor(nextRandom() * targets.length)];
    if (!selected.includes(target)) selected.push(target);
  }
  const percentages: WeeklyModifier['percent'][] = [10, 15, 20, 25];
  return selected.map((target) => {
    const sign = nextRandom() > 0.5 ? 1 : -1;
    return { kind: 'position', target, label: getPositionModifierLabel(target, sign), sign, percent: percentages[Math.floor(nextRandom() * percentages.length)] };
  });
}

export function getRandomWeeklyModifiers(): WeeklyModifier[] {
  const targets: PositionTarget[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
  const selected: PositionTarget[] = [];
  while (selected.length < 3) {
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (!selected.includes(target)) selected.push(target);
  }
  const positionPercentages: WeeklyModifier['percent'][] = [10, 15, 20, 25];
  return selected.map((target) => {
    const sign = Math.random() > 0.5 ? 1 : -1;
    return {
      kind: 'position',
      target,
      label: getPositionModifierLabel(target, sign),
      sign,
      percent: positionPercentages[Math.floor(Math.random() * positionPercentages.length)],
    };
  });
}
