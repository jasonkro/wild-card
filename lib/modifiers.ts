export type WeeklyModifier = {
  kind: 'position' | 'stat';
  target?: 'QB' | 'RB' | 'WR' | 'TE' | 'FLEX' | 'K' | 'DEF';
  label: string;
  sign: 1 | -1;
  percent: 5 | 10 | 15 | 20;
  stats?: ('pass_td' | 'rush_td' | 'rec_td' | 'int' | 'fum_lost')[];
};
type PositionTarget = NonNullable<WeeklyModifier['target']>;

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
  const sundayLockPassed = weekday === 'Sun' && hour >= 20 || ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(weekday || '');
  return { locked: sundayLockPassed, visibleToUsers: sundayLockPassed, timezone: modifierTimezone, lockTime: 'Sunday 8:00 PM ET', revealTime: 'Sunday 8:00 PM ET' };
}

export function getWeeklyModifiers(_week: number): WeeklyModifier[] {
  if (_week === 1) return weekOneModifiers.map((modifier) => ({ ...modifier }));
  if (_week === 2) return [
    { kind: 'position', target: 'RB', label: 'RUSH HOUR', sign: 1, percent: 20 },
    { kind: 'position', target: 'QB', label: 'AIR RAID', sign: -1, percent: 10 },
    { kind: 'stat', label: 'RUSHING TD BONUS', sign: 1, percent: 5, stats: ['rush_td'] },
  ];

  let seed = (_week * 2654435761) >>> 0;
  const nextRandom = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 4294967296;
  };
  const targets: PositionTarget[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
  const labels: Record<NonNullable<WeeklyModifier['target']>, string> = {
    QB: 'AIR RAID', RB: 'RUSH HOUR', WR: 'WIDE OPEN', TE: 'TIGHT WINDOW', FLEX: 'LONG SHOT', K: 'BOOT LEG', DEF: 'LOCKDOWN',
  };
  const selected: PositionTarget[] = [];
  while (selected.length < 3) {
    const target = targets[Math.floor(nextRandom() * targets.length)];
    if (!selected.includes(target)) selected.push(target);
  }
  const percentages: WeeklyModifier['percent'][] = [5, 10, 15, 20];
  return selected.map((target) => {
    const sign = nextRandom() > 0.5 ? 1 : -1;
    return { kind: 'position', target, label: labels[target], sign, percent: percentages[Math.floor(nextRandom() * percentages.length)] };
  });
}

export function getRandomWeeklyModifiers(): WeeklyModifier[] {
  const targets: PositionTarget[] = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'];
  const labels: Record<PositionTarget, string> = {
    QB: 'AIR RAID', RB: 'RUSH HOUR', WR: 'WIDE OPEN', TE: 'TIGHT WINDOW', FLEX: 'LONG SHOT', K: 'BOOT LEG', DEF: 'LOCKDOWN',
  };
  const selected: PositionTarget[] = [];
  while (selected.length < 2) {
    const target = targets[Math.floor(Math.random() * targets.length)];
    if (!selected.includes(target)) selected.push(target);
  }
  const positionPercentages: WeeklyModifier['percent'][] = [5, 10, 15, 20];
  const positionModifiers: WeeklyModifier[] = selected.map((target) => ({
    kind: 'position', target, label: labels[target], sign: Math.random() > 0.5 ? 1 : -1, percent: positionPercentages[Math.floor(Math.random() * positionPercentages.length)],
  }));
  const positiveEvents = ['pass_td', 'rush_td', 'rec_td'] as const;
  const negativeEvents = ['int', 'fum_lost'] as const;
  const isPositive = Math.random() > 0.4;
  const event = isPositive ? positiveEvents[Math.floor(Math.random() * positiveEvents.length)] : negativeEvents[Math.floor(Math.random() * negativeEvents.length)];
  return [...positionModifiers, { kind: 'stat', label: `${event.replace('_', ' ').toUpperCase()} MODIFIER`, sign: isPositive ? 1 : -1, percent: (Math.random() > 0.5 ? 5 : 10) as 5 | 10, stats: [event] }];
}
