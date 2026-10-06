import "server-only";

/*
 * Question sources for the Refresh Zone games that do not come from a department bank.
 * Aptitude questions are built from formulas, so every answer is computed, never typed in.
 */

export interface Q {
  prompt: string;
  options: [string, string, string, string];
  answer: number;
  explanation: string;
}
export type Rng = () => number;

const int = (rng: Rng, lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1));
const pick = <T,>(rng: Rng, xs: readonly T[]): T => xs[Math.floor(rng() * xs.length)]!;
export function shuffled<T>(rng: Rng, xs: readonly T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}

/** Four distinct options with the right one at a random place. `show` formats a number for display. */
function numeric(rng: Rng, answer: number, show: (n: number) => string, prompt: string, explanation: string, step = Math.max(1, Math.round(Math.abs(answer) * 0.1))): Q {
  const wrong = new Set<number>();
  const offsets = shuffled(rng, [1, -1, 2, -2, 3, -3, 4, 5]);
  for (const k of offsets) {
    const v = answer + k * step;
    if (v !== answer && v > 0) wrong.add(v);
    if (wrong.size === 3) break;
  }
  for (let k = 1; wrong.size < 3; k++) wrong.add(answer + 10 * k * step);
  const at = int(rng, 0, 3);
  const opts = [...wrong].slice(0, 3).map(show);
  opts.splice(at, 0, show(answer));
  return { prompt, options: opts as Q["options"], answer: at, explanation };
}

const inr = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const plain = (n: number) => String(n);

type Gen = (rng: Rng) => Q;
const GENERATORS: Record<string, Gen> = {
  percent(rng) {
    const p = 5 * int(rng, 1, 9);
    const n = 20 * int(rng, 3, 40);
    const a = (p * n) / 100;
    return numeric(rng, a, plain, `What is ${p}% of ${n}?`, `${p}% of ${n} = ${p} × ${n} ÷ 100 = ${a}.`);
  },
  timeWork(rng) {
    const pairs: Array<[number, number]> = [[12, 12], [20, 30], [10, 15], [30, 60], [6, 3], [12, 4], [24, 8], [20, 5], [36, 18], [45, 90], [15, 10], [60, 20]];
    const [a, b] = pick(rng, pairs);
    const t = (a * b) / (a + b);
    return numeric(rng, t, (n) => `${n} days`, `A can finish a job in ${a} days and B in ${b} days. Working together, how long will they take?`, `Together they do 1/${a} + 1/${b} = ${a + b}/${a * b} of the job a day, so ${a * b} ÷ ${a + b} = ${t} days.`, 1);
  },
  distance(rng) {
    const speed = 5 * int(rng, 8, 20);
    const t = int(rng, 2, 6);
    const h = int(rng, 3, 9);
    return numeric(rng, speed * h, (n) => `${n} km`, `A bus covers ${speed * t} km in ${t} hours. At the same speed, how far does it go in ${h} hours?`, `Speed = ${speed * t} ÷ ${t} = ${speed} km/h, so in ${h} hours it covers ${speed} × ${h} = ${speed * h} km.`, speed);
  },
  profit(rng) {
    const cost = 20 * int(rng, 5, 50);
    const p = pick(rng, [10, 20, 25, 30, 40, 50]);
    const sell = (cost * (100 + p)) / 100;
    return numeric(rng, p, (n) => `${n}%`, `An article bought for ${inr(cost)} is sold for ${inr(sell)}. What is the profit percentage?`, `Profit = ${sell} − ${cost} = ${sell - cost}. Profit % = ${sell - cost} ÷ ${cost} × 100 = ${p}%.`, 5);
  },
  simpleInterest(rng) {
    const principal = 1000 * int(rng, 2, 20);
    const r = pick(rng, [5, 6, 8, 10, 12]);
    const t = int(rng, 2, 5);
    const si = (principal * r * t) / 100;
    return numeric(rng, si, inr, `What is the simple interest on ${inr(principal)} at ${r}% per year for ${t} years?`, `SI = P × R × T ÷ 100 = ${principal} × ${r} × ${t} ÷ 100 = ${inr(si)}.`, Math.max(10, Math.round(si * 0.1 / 10) * 10));
  },
  missingNumber(rng) {
    const mean = int(rng, 50, 90);
    const four = [0, 1, 2, 3].map(() => mean + int(rng, -10, 10));
    const fifth = mean * 5 - four.reduce((s, n) => s + n, 0);
    return numeric(rng, fifth, plain, `The average of five numbers is ${mean}. Four of them are ${four.join(", ")}. What is the fifth number?`, `The total is ${mean} × 5 = ${mean * 5}. Subtract the four known numbers (${four.reduce((s, n) => s + n, 0)}) to get ${fifth}.`, 3);
  },
  series(rng) {
    const kind = int(rng, 0, 2);
    if (kind === 0) {
      const a = int(rng, 2, 20);
      const d = int(rng, 3, 9);
      const s = [0, 1, 2, 3, 4].map((i) => a + i * d);
      return numeric(rng, a + 5 * d, plain, `Find the next number: ${s.join(", ")}, …`, `Each term adds ${d}, so the next is ${s[4]} + ${d} = ${a + 5 * d}.`, d);
    }
    if (kind === 1) {
      const a = int(rng, 1, 5);
      const r = int(rng, 2, 3);
      const s = [0, 1, 2, 3].map((i) => a * r ** i);
      return numeric(rng, a * r ** 4, plain, `Find the next number: ${s.join(", ")}, …`, `Each term is multiplied by ${r}, so the next is ${s[3]} × ${r} = ${a * r ** 4}.`, a * r ** 3);
    }
    const k = int(rng, 1, 9);
    const s = [1, 2, 3, 4, 5].map((i) => i * i + k);
    return numeric(rng, 36 + k, plain, `Find the next number: ${s.join(", ")}, …`, `The terms are 1², 2², 3², … each plus ${k}, so the next is 6² + ${k} = ${36 + k}.`, 2);
  },
  ratio(rng) {
    const a = int(rng, 1, 5);
    const b = a + int(rng, 1, 4);
    const unit = 50 * int(rng, 2, 20);
    const total = (a + b) * unit;
    return numeric(rng, b * unit, inr, `${inr(total)} is shared between two people in the ratio ${a}:${b}. What is the larger share?`, `There are ${a + b} parts, each worth ${total} ÷ ${a + b} = ${inr(unit)}. The larger share is ${b} × ${unit} = ${inr(b * unit)}.`, unit);
  },
  sumDifference(rng) {
    const big = int(rng, 20, 90);
    const small = big - int(rng, 2, 18);
    return numeric(rng, big, plain, `The sum of two numbers is ${big + small} and their difference is ${big - small}. What is the larger number?`, `Larger = (sum + difference) ÷ 2 = (${big + small} + ${big - small}) ÷ 2 = ${big}.`, 2);
  },
};
export const APTITUDE_KINDS = Object.keys(GENERATORS);

/** `n` aptitude questions, cycling through the question types so a round is never all the same kind. */
export function aptitudeRound(n: number, rng: Rng = Math.random): Q[] {
  const kinds = shuffled(rng, APTITUDE_KINDS);
  const out: Q[] = [];
  const seen = new Set<string>();
  for (let i = 0; out.length < n && i < n * 6; i++) {
    const q = GENERATORS[kinds[i % kinds.length]!]!(rng);
    if (seen.has(q.prompt)) continue;
    seen.add(q.prompt);
    out.push(q);
  }
  return out;
}
export const aptitudeOfKind = (kind: string, rng: Rng): Q => GENERATORS[kind]!(rng);

/* ───────────────────────────── vocabulary ───────────────────────────── */
export const WORDS: ReadonlyArray<readonly [string, string]> = [
  ["abate", "to become less intense or widespread"],
  ["aberrant", "departing from what is normal or expected"],
  ["abstruse", "hard to understand; obscure"],
  ["acumen", "keen insight and quick judgement"],
  ["alacrity", "cheerful readiness and speed"],
  ["ameliorate", "to make something bad better"],
  ["anomaly", "something that does not fit the usual pattern"],
  ["arduous", "needing great effort; tiring"],
  ["audacious", "boldly willing to take risks"],
  ["austere", "plain and strict, without comfort or decoration"],
  ["benevolent", "kind and well-meaning"],
  ["candid", "honest and direct in speech"],
  ["capricious", "changing mood or behaviour suddenly and without reason"],
  ["circumspect", "careful to consider risks before acting"],
  ["cogent", "clear, logical and convincing"],
  ["copious", "plentiful; in large amounts"],
  ["debunk", "to show that an idea or claim is false"],
  ["deference", "polite respect for another's wishes or opinion"],
  ["diligent", "careful and hard-working"],
  ["eloquent", "fluent and persuasive in speaking or writing"],
  ["empirical", "based on observation or experiment, not theory"],
  ["ephemeral", "lasting only a very short time"],
  ["equivocal", "open to more than one meaning; deliberately vague"],
  ["frugal", "careful about spending money or using resources"],
  ["gregarious", "fond of company; sociable"],
  ["hackneyed", "overused and no longer fresh or original"],
  ["impartial", "treating all sides fairly, without bias"],
  ["inevitable", "certain to happen; unavoidable"],
  ["lucid", "easy to understand; clearly expressed"],
  ["meticulous", "showing great attention to detail"],
  ["mitigate", "to make something less severe or harmful"],
  ["obsolete", "no longer used because something newer exists"],
  ["pragmatic", "dealing with things sensibly and practically"],
  ["prudent", "acting with care and thought for the future"],
  ["reticent", "unwilling to share thoughts or feelings freely"],
  ["scrutinize", "to examine very closely and carefully"],
  ["tenacious", "holding firmly to a goal; persistent"],
  ["ubiquitous", "present everywhere at once"],
  ["verbose", "using more words than needed"],
  ["volatile", "likely to change quickly and unpredictably"],
];

export function vocabularyRound(n: number, rng: Rng = Math.random): Q[] {
  return shuffled(rng, WORDS)
    .slice(0, n)
    .map(([word, meaning]) => {
      const wrong = shuffled(rng, WORDS.filter(([w]) => w !== word)).slice(0, 3).map(([, m]) => m);
      const at = int(rng, 0, 3);
      const options = [...wrong];
      options.splice(at, 0, meaning);
      return { prompt: `What does “${word}” mean?`, options: options as Q["options"], answer: at, explanation: `${word}: ${meaning}.` };
    });
}
