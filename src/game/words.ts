import { RECOGNISED_LETTERS } from './recognizer.js';

/**
 * Five-letter answers. Every word uses only letters the recogniser supports;
 * anything that does not is dropped by the filter below (and a test checks it).
 */
const RAW = `
ABIDE ABOVE ADOBE AGILE AGREE AHEAD ALGAE ALIBI ALIVE ALLEY ALLOW ALLOY ALOUD
ARGUE AUDIO AVOID AWARD AWARE AWFUL BADGE BADLY BAGEL BEACH BEARD BELOW BERRY
BIRCH BLADE BLARE BLEED BLOOD BLUFF BOARD BRAID BRAVE BRAVO BREAD BREED BRIBE
BRIDE BROAD BUDDY BUGLE BUILD BULGE BULLY CABLE CACHE CADDY CARGO CARRY CARVE
CEDAR CELLO CHAIR CHEER CHIEF CHILD CHILI CHILL CHOIR CHORD CIDER CIGAR CIVIC
CIVIL CLEAR CLIFF CLOUD COACH COBRA COCOA COLOR CORAL COUCH COUGH COULD COVER
CRAVE CRAWL CROWD CRUDE CRUEL CURLY CURRY CURVE CYCLE DADDY DAILY DAIRY DECAL
DECAY DELAY DIARY DODGE DOUGH DRIVE DROVE DRYER EAGER EAGLE EARLY ELBOW ELDER
ERROR EVERY FABLE FAIRY FERRY FEVER FIBER FIELD FIERY FLAIR FLARE FLOOD FLOOR
FLORA FLOUR FLUFF FLUID FOLLY FORCE FORGE FULLY FURRY GAUGE GAVEL GLARE GLIDE
GLOBE GLORY GLOVE GOOEY GORGE GRACE GRADE GRAVE GRAVY GREED GROVE GROWL GRUFF
GUARD GUAVA GUIDE GUILD HAIRY HARDY HEARD HEAVE HEAVY HEDGE HELLO HOBBY HOLLY
HOVER HURRY IDEAL IVORY LABEL LADLE LARGE LAUGH LAYER LEAVE LEDGE LEGAL LEVEL
LIVER LOBBY LOCAL LODGE LOGIC LOVER LOWER LOYAL LUCID OCCUR OFFER OLDER OLIVE
ORDER RADAR RADIO RALLY REACH READY REBEL REFER RELAX RELAY RELIC RIDER RIDGE
RIGID RIVAL RIVER RODEO ROGUE ROUGE ROUGH ROWDY ROYAL RUGBY RULER VAGUE VALID
VALUE VALVE VERGE VIDEO VIGOR VILLA VIRAL VIVID VOCAL VOICE VOUCH WAFER WAGER
WEAVE WEDGE WEIRD WHALE WHARF WHEEL WHERE WHICH WHILE WHIRL WHOLE WIDER WIELD
WORLD WORRY WOULD YIELD BOXER FIXED
`;

const allowed = new Set<string>(RECOGNISED_LETTERS);

export const WORDS: string[] = RAW.split(/\s+/)
  .filter((w) => w.length === 5 && [...w].every((c) => allowed.has(c)))
  .filter((w, i, all) => all.indexOf(w) === i);

export const WORD_LENGTH = 5;
export const MAX_GUESSES = 6;

/** Days since 1 Jan 2026 in the player's own time zone. */
export function dayNumber(date = new Date()): number {
  const start = Date.UTC(2026, 0, 1);
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((local - start) / 86_400_000);
}

/** The same word for everyone on the same calendar day. */
export function dailyWord(day: number): string {
  const n = WORDS.length;
  // A fixed stride that shares no factor with the list length visits every
  // word once before repeating.
  let stride = 101;
  while (gcd(stride, n) !== 1) stride++;
  return WORDS[(((day * stride + 37) % n) + n) % n];
}

export function randomWord(except: string, random = Math.random): string {
  let word = except;
  while (word === except) word = WORDS[Math.floor(random() * WORDS.length)];
  return word;
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}
