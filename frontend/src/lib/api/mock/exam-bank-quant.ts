import "server-only";
import { GENERATORS, inr, int, numeric, pick, plain, type Gen } from "./refresh-zone-content";

/*
 * Quantitative aptitude for competitive exams. Every question is built from a formula, so every answer is computed,
 * never typed in. The Refresh Zone generators are reused and a few exam staples are added.
 */

const pct = (n: number) => `${n}%`;

export const QUANT: Record<string, Gen> = {
  ...GENERATORS,
  compoundInterest(rng) {
    const principal = 1000 * int(rng, 2, 20);
    const r = pick(rng, [10, 20]);
    const amount = principal * (1 + r / 100) ** 2;
    const ci = Math.round(amount - principal);
    return numeric(rng, ci, inr, `What is the compound interest on ${inr(principal)} at ${r}% per year for 2 years, compounded yearly?`, `Amount = ${principal} × (1 + ${r}/100)² = ${inr(Math.round(amount))}. CI = amount − principal = ${inr(ci)}.`, Math.max(10, Math.round((ci * 0.1) / 10) * 10));
  },
  train(rng) {
    const kmh = pick(rng, [36, 54, 72, 90, 108]);
    const ms = (kmh * 5) / 18;
    const t = int(rng, 6, 20);
    return numeric(rng, ms * t, (n) => `${n} m`, `A train running at ${kmh} km/h crosses a pole in ${t} seconds. What is the length of the train?`, `${kmh} km/h = ${kmh} × 5/18 = ${ms} m/s. Length = speed × time = ${ms} × ${t} = ${ms * t} m.`, ms);
  },
  newAverage(rng) {
    const n = int(rng, 4, 9);
    const a = int(rng, 20, 60);
    const d = int(rng, 1, 5);
    const x = (n + 1) * (a + d) - n * a;
    return numeric(rng, x, plain, `The average of ${n} numbers is ${a}. When one more number is added, the average becomes ${a + d}. What is the number added?`, `New total = ${n + 1} × ${a + d} = ${(n + 1) * (a + d)}. Old total = ${n} × ${a} = ${n * a}. The number added is the difference, ${x}.`, n + 1);
  },
  lcm(rng) {
    const k = int(rng, 2, 9);
    const [p, q] = pick(rng, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 7], [4, 7]] as Array<[number, number]>);
    const l = k * p * q;
    return numeric(rng, l, plain, `What is the LCM of ${k * p} and ${k * q}?`, `HCF = ${k}. LCM = (${k * p} × ${k * q}) ÷ ${k} = ${l}.`, k);
  },
  mixture(rng) {
    const [a, b] = pick(rng, [[1, 1], [1, 2], [2, 1], [1, 3], [3, 1], [2, 3], [3, 2]] as Array<[number, number]>);
    const p1 = 20 * int(rng, 2, 8);
    const p2 = p1 + (a + b) * int(rng, 2, 6);
    const mean = (a * p1 + b * p2) / (a + b);
    return numeric(rng, mean, (n) => `${inr(n)}/kg`, `Rice at ${inr(p1)}/kg is mixed with rice at ${inr(p2)}/kg in the ratio ${a}:${b}. What is the price of the mixture per kg?`, `Mean price = (${a} × ${p1} + ${b} × ${p2}) ÷ ${a + b} = ${inr(mean)}/kg.`, Math.max(1, Math.round((p2 - p1) / (a + b))));
  },
  ages(rng) {
    const k = int(rng, 5, 20);
    const n = int(rng, 2, 10);
    const b = k + n;
    return numeric(rng, b, (x) => `${x} years`, `A is ${k} years older than B. ${n} years ago, A was twice as old as B. What is B's present age?`, `Let B = x. Then (x + ${k} − ${n}) = 2(x − ${n}), so x = ${k} + ${n} = ${b} years.`, 2);
  },
  successive(rng) {
    const p = pick(rng, [10, 20, 30, 40, 50]);
    const loss = (p * p) / 100;
    return numeric(rng, loss, pct, `The price of an item is increased by ${p}% and then decreased by ${p}%. What is the net percentage decrease?`, `Net change = −(${p}²)/100 = −${loss}%. An equal rise and fall always ends in a loss.`, Math.max(1, Math.round(loss / 4)));
  },
  discount(rng) {
    const mp = 100 * int(rng, 5, 50);
    const d = pick(rng, [10, 15, 20, 25, 30]);
    const sp = (mp * (100 - d)) / 100;
    return numeric(rng, sp, inr, `An article marked at ${inr(mp)} is sold at a discount of ${d}%. What is the selling price?`, `Selling price = ${mp} × (100 − ${d}) ÷ 100 = ${inr(sp)}.`, Math.max(10, Math.round(sp * 0.05 / 10) * 10));
  },
};

/** Quant topics a student can drill, mapped to the generators that build their questions. */
export const QUANT_TOPICS: Record<string, { title: string; kinds: string[] }> = {
  "q-percentage": { title: "Percentage", kinds: ["percent", "successive"] },
  "q-profit-loss": { title: "Profit, loss & discount", kinds: ["profit", "discount"] },
  "q-interest": { title: "Simple & compound interest", kinds: ["simpleInterest", "compoundInterest"] },
  "q-time-work": { title: "Time & work", kinds: ["timeWork"] },
  "q-speed": { title: "Time, speed & distance", kinds: ["distance", "train"] },
  "q-ratio": { title: "Ratio, proportion & mixtures", kinds: ["ratio", "mixture"] },
  "q-average": { title: "Averages & ages", kinds: ["missingNumber", "newAverage", "ages"] },
  "q-number": { title: "Number system & LCM", kinds: ["sumDifference", "lcm"] },
  "q-series": { title: "Number series", kinds: ["series"] },
};
