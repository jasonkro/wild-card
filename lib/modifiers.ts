export const positionTargets = ['QB', 'RB', 'WR', 'TE', 'FLEX', 'K', 'DEF'] as const;
export const slotTargets = ['QB1', 'RB1', 'WR1', 'TE1', 'FLEX1', 'K1', 'DEF1'] as const;
export type PositionTarget = typeof positionTargets[number];
export type SlotTarget = typeof slotTargets[number];
export type ModifierTarget = PositionTarget | SlotTarget;

export type WeeklyModifier = {
  kind: 'position' | 'slot' | 'stat';
  target?: ModifierTarget;
  label: string;
  sign: 1 | -1;
  percent: number;
  stats?: ('pass_td' | 'rush_td' | 'rec_td' | 'int' | 'fum_lost')[];
};

const positionLabels: Record<PositionTarget, { positive: string; negative: string }> = {
  QB: { positive: 'AIR RAID', negative: 'AIR POCKET' },
  RB: { positive: 'RUSH HOUR', negative: 'RUSH LIMIT' },
  WR: { positive: 'WIDE OPEN', negative: 'TIGHT COVERAGE' },
  TE: { positive: 'TIGHT WINDOW', negative: 'TIGHT SQUEEZE' },
  FLEX: { positive: 'LONG SHOT', negative: 'SHORT LEASH' },
  K: { positive: 'BOOT LEG', negative: 'COLD FOOT' },
  DEF: { positive: 'LOCKDOWN', negative: 'SOFT COVERAGE' },
};

function getBasePosition(target: ModifierTarget): PositionTarget {
  return (target.endsWith('1') ? target.slice(0, -1) : target) as PositionTarget;
}

export function getPositionModifierLabel(target: ModifierTarget, sign: 1 | -1) {
  return positionLabels[getBasePosition(target)][sign > 0 ? 'positive' : 'negative'];
}

export function normalizeWeeklyModifiers(modifiers: WeeklyModifier[]) {
  return modifiers.map((modifier) => (modifier.kind === 'position' || modifier.kind === 'slot') && modifier.target
    ? { ...modifier, label: getPositionModifierLabel(modifier.target, modifier.sign) }
    : { ...modifier });
}

export function getLineupSlotTarget(rosterPositions: string[], index: number): SlotTarget | undefined {
  const position = rosterPositions[index] as PositionTarget | undefined;
  if (!position || !positionTargets.includes(position)) return undefined;
  if (rosterPositions.slice(0, index).includes(position)) return undefined;
  return `${position}1` as SlotTarget;
}

export function formatSlotModifierTarget(target: SlotTarget, rosterPositions: string[]) {
  const position = getBasePosition(target);
  const slotCount = rosterPositions.filter((slot) => slot === position).length;
  return slotCount > 1 ? target : position;
}

export function getPositionModifierFactor(modifiers: WeeklyModifier[], position: string | undefined, slotTarget: SlotTarget | undefined) {
  return modifiers.filter((modifier) =>
    (modifier.kind === 'position' && modifier.target === position)
    || (modifier.kind === 'slot' && modifier.target === slotTarget),
  ).reduce((total, modifier) => total + modifier.sign * modifier.percent / 100, 0);
}

function generateWeeklyModifierSet(random: () => number): WeeklyModifier[] {
  const firstTarget = slotTargets[Math.floor(random() * slotTargets.length)];
  const firstPosition = getBasePosition(firstTarget);
  const selectedPositions = positionTargets.filter((position) =>
    position !== firstPosition && (!(firstPosition === 'K' || firstPosition === 'DEF') || (position !== 'K' && position !== 'DEF')),
  );

  for (let index = selectedPositions.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [selectedPositions[index], selectedPositions[swapIndex]] = [selectedPositions[swapIndex], selectedPositions[index]];
  }

  const positionGroupTargets: PositionTarget[] = [];
  for (const position of selectedPositions) {
    const isSpecialTeams = position === 'K' || position === 'DEF';
    const alreadyHasOtherSpecialTeam = positionGroupTargets.some((target) =>
      (target === 'K' || target === 'DEF') && target !== position,
    );
    if (isSpecialTeams && alreadyHasOtherSpecialTeam) continue;
    positionGroupTargets.push(position);
    if (positionGroupTargets.length === 2) break;
  }

  return [
    { kind: 'slot', target: firstTarget, label: getPositionModifierLabel(firstTarget, 1), sign: 1, percent: 100 },
    ...positionGroupTargets.map((target, index) => {
      const sign = index === 0 ? 1 as const : -1 as const;
      const percent = 50;
      return { kind: 'position' as const, target, label: getPositionModifierLabel(target, sign), sign, percent };
    }),
  ];
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
  return generateWeeklyModifierSet(nextRandom);
}

export function getRandomWeeklyModifiers(): WeeklyModifier[] {
  return generateWeeklyModifierSet(Math.random);
}
