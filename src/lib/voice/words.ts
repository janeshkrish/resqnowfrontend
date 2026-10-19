/**
 * Text helpers for matching what a customer said against the app's own names: Tamil script is
 * spelt out in English letters, and words are compared by how they sound, so "ஸ்ப்ளெண்டர்",
 * "splendar" and "Splendor+" all meet.
 */

const VOWELS: Record<string, string> = {
  "அ": "a", "ஆ": "aa", "இ": "i", "ஈ": "ii", "உ": "u", "ஊ": "uu", "எ": "e", "ஏ": "ee", "ஐ": "ai", "ஒ": "o", "ஓ": "oo", "ஔ": "au",
};
const CONSONANTS: Record<string, string> = {
  "க": "k", "ங": "ng", "ச": "s", "ஞ": "nj", "ட": "t", "ண": "n", "த": "th", "ந": "n", "ப": "p", "ம": "m", "ய": "y", "ர": "r",
  "ல": "l", "வ": "v", "ழ": "zh", "ள": "l", "ற": "r", "ன": "n", "ஜ": "j", "ஷ": "sh", "ஸ": "s", "ஹ": "h",
};
const SIGNS: Record<string, string> = {
  "ா": "aa", "ி": "i", "ீ": "ii", "ு": "u", "ூ": "uu", "ெ": "e", "ே": "ee", "ை": "ai", "ொ": "o", "ோ": "oo", "ௌ": "au",
};
const VIRAMA = "்";

/** Tamil script in English letters ("பைக்" → "paik"); everything else is left as it is. */
export function tamilToLatin(text: string): string {
  let out = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const ch = chars[i];
    if (ch === "ஃ") { out += "f"; if (chars[i + 1] === "ப") i += chars[i + 2] === VIRAMA ? 2 : 1; continue; }
    if (VOWELS[ch]) { out += VOWELS[ch]; continue; }
    const c = CONSONANTS[ch];
    if (!c) { out += ch; continue; }
    const next = chars[i + 1];
    if (next === VIRAMA) { out += c; i += 1; continue; }
    if (next && SIGNS[next]) { out += c + SIGNS[next]; i += 1; continue; }
    out += c + "a";
  }
  return out;
}

/** Lower case, Tamil spelt out, punctuation gone, "+" said as "plus". */
export function normalize(text: string): string {
  return tamilToLatin(String(text || ""))
    .toLowerCase()
    .replace(/\+/g, " plus ")
    .replace(/[^a-z0-9%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** A word by its sound: hard and soft consonants and long and short vowels fold together. */
export function soundKey(word: string): string {
  let w = word.toLowerCase();
  w = w.replace(/ph/g, "f").replace(/([tdskgbz])h/g, "$1").replace(/ch/g, "s").replace(/x/g, "ks").replace(/q/g, "k");
  w = w.replace(/c/g, "k").replace(/w/g, "v").replace(/[zj]/g, "s").replace(/b/g, "p").replace(/d/g, "t").replace(/g/g, "k");
  w = w.replace(/aa/g, "a").replace(/ee|ii|y/g, "i").replace(/oo|uu/g, "u").replace(/ai|ei/g, "e").replace(/ou|au/g, "u");
  w = w.replace(/(.)\1+/g, "$1");
  return w;
}

export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let last = prev[0];
    prev[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = prev[j];
      prev[j] = Math.min(prev[j] + 1, prev[j - 1] + 1, last + (a[i - 1] === b[j - 1] ? 0 : 1));
      last = temp;
    }
  }
  return prev[b.length];
}

/** One spoken word against one name word: the same, the same sound, or one slip in a long word. */
export function wordsMeet(spoken: string, name: string, { allowSuffix = false } = {}): boolean {
  if (spoken === name) return true;
  if (allowSuffix && name.length >= 3 && spoken.startsWith(name)) return true;
  const a = soundKey(spoken), b = soundKey(name);
  if (a === b) return true;
  if (allowSuffix && b.length >= 3 && a.startsWith(b)) return true;
  return b.length >= 5 && editDistance(a, b) <= 1;
}

/** Where a name ("splendor plus") appears in the spoken words, if it does; the last word may carry "-la", "-ku". */
export function findPhrase(spoken: string[], name: string[]): number {
  if (!name.length || name.length > spoken.length) return -1;
  for (let i = 0; i + name.length <= spoken.length; i++) {
    let ok = true;
    for (let j = 0; j < name.length && ok; j++) ok = wordsMeet(spoken[i + j], name[j], { allowSuffix: j === name.length - 1 });
    if (ok) return i;
  }
  return -1;
}
