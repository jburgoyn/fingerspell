/** Everything the game remembers between visits. Stored only on this device. */
export interface SaveData {
  version: 1;
  tutorialDone: boolean;
  streak: number;
  bestStreak: number;
  /** Day number of the last daily win, or -1. */
  lastWinDay: number;
  played: number;
  wins: number;
  /** Progress on today's word so a reload does not lose it. */
  today: { day: number; guesses: string[]; finished: boolean } | null;
  /** How many times each letter has been signed successfully in practice. */
  practice: Record<string, number>;
  holdMs: number;
  highContrast: boolean;
  leftHanded: boolean;
}

const KEY = 'fingerspell.save.v1';
export const HOLD_OPTIONS = [600, 900, 1300, 1800];
export const MASTERY_COUNT = 3;

export function defaultSave(): SaveData {
  return {
    version: 1,
    tutorialDone: false,
    streak: 0,
    bestStreak: 0,
    lastWinDay: -1,
    played: 0,
    wins: 0,
    today: null,
    practice: {},
    holdMs: 900,
    highContrast: false,
    leftHanded: false,
  };
}

export function loadSave(storage: Pick<Storage, 'getItem'> | null = safeStorage()): SaveData {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return defaultSave();
    const parsed = JSON.parse(raw) as Partial<SaveData>;
    if (parsed.version !== 1) return defaultSave();
    return { ...defaultSave(), ...parsed };
  } catch {
    return defaultSave();
  }
}

export function storeSave(
  data: SaveData,
  storage: Pick<Storage, 'setItem'> | null = safeStorage(),
): void {
  try {
    storage?.setItem(KEY, JSON.stringify(data));
  } catch {
    // Private browsing or a full disk: the game still works, it just forgets.
  }
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

/** The streak to show today: it lapses if a day was missed. */
export function currentStreak(save: SaveData, day: number): number {
  return save.lastWinDay >= day - 1 ? save.streak : 0;
}

/** Record the result of a daily round. Safe to call once per day. */
export function recordDaily(save: SaveData, day: number, won: boolean): void {
  save.played++;
  if (won) {
    save.wins++;
    save.streak = save.lastWinDay === day - 1 ? save.streak + 1 : 1;
    save.lastWinDay = day;
    save.bestStreak = Math.max(save.bestStreak, save.streak);
  } else {
    save.streak = 0;
  }
}

export function lettersLearned(save: SaveData): number {
  return Object.values(save.practice).filter((n) => n >= MASTERY_COUNT).length;
}
