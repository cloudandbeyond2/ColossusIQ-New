import "server-only";
import { int, numeric, pick, plain, shuffled, type Gen, type Q, type Rng } from "./refresh-zone-content";

/*
 * Logical reasoning for competitive exams. Series, coding, direction, analogy, odd-one-out and ranking questions are
 * generated (answers computed); blood relations and syllogisms come from a small reviewed set.
 */

const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const letter = (i: number) => A[((i % 26) + 26) % 26]!;

/** Four distinct text options with the right one at a random place. */
export function textOptions(rng: Rng, right: string, wrong: readonly string[], prompt: string, explanation: string): Q {
  const others = shuffled(rng, [...new Set(wrong.filter((w) => w !== right))]).slice(0, 3);
  if (others.length < 3) throw new Error(`Not enough distinct options for: ${prompt}`);
  const at = int(rng, 0, 3);
  const opts = [...others];
  opts.splice(at, 0, right);
  return { prompt, options: opts as Q["options"], answer: at, explanation };
}

const shift = (word: string, k: number) => [...word].map((c) => letter(A.indexOf(c) + k)).join("");
const WORDS = ["CAT", "DOG", "SUN", "PEN", "MAP", "BOOK", "LAMP", "TREE", "FISH", "COLD", "RAIN", "GOLD", "MILK", "SHIP", "BIRD", "KING"];
const PRIMES = [11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97];
const ODD_COMPOSITES = [21, 27, 33, 39, 49, 51, 57, 63, 69, 77, 81, 87, 91, 93];

export const REASONING: Record<string, Gen> = {
  letterSeries(rng) {
    const d = int(rng, 1, 4);
    const s = int(rng, 0, 25 - 5 * d);
    const terms = [0, 1, 2, 3].map((i) => letter(s + i * d));
    const right = letter(s + 4 * d);
    return textOptions(rng, right, [letter(s + 4 * d + 1), letter(s + 4 * d - 1), letter(s + 4 * d + 2), letter(s + 4 * d - 2)], `Find the next letter: ${terms.join(", ")}, …`, `Each letter moves ${d} place${d > 1 ? "s" : ""} forward, so the next is ${right}.`);
  },
  coding(rng) {
    const [w1, w2] = shuffled(rng, WORDS).slice(0, 2) as [string, string];
    const k = int(rng, 1, 3);
    const right = shift(w2, k);
    return textOptions(rng, right, [shift(w2, k + 1), shift(w2, -k), [...right].reverse().join(""), shift(w2, k + 2)], `If ${w1} is written as ${shift(w1, k)} in a code, how is ${w2} written in that code?`, `Each letter moves ${k} place${k > 1 ? "s" : ""} forward (${w1} → ${shift(w1, k)}), so ${w2} → ${right}.`);
  },
  directionDistance(rng) {
    const [p, q, h] = pick(rng, [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]] as Array<[number, number, number]>);
    const north = q + int(rng, 2, 9);
    const south = north - q;
    return numeric(rng, h, (n) => `${n} km`, `Ravi walks ${north} km north, turns right and walks ${p} km, then turns right again and walks ${south} km. How far is he from his starting point?`, `He ends ${p} km east and ${north} − ${south} = ${q} km north of the start. Distance = √(${p}² + ${q}²) = ${h} km.`, 1);
  },
  directionFacing(rng) {
    const DIRS = ["North", "East", "South", "West"];
    const start = int(rng, 0, 3);
    const turns = shuffled(rng, [["right", 1], ["left", -1], ["right", 1], ["left", -1], ["about", 2]] as Array<[string, number]>).slice(0, 3);
    const end = (((start + turns.reduce((s, [, t]) => s + t, 0)) % 4) + 4) % 4;
    const words = turns.map(([w]) => (w === "about" ? "turns about" : `turns ${w}`)).join(", then ");
    return textOptions(rng, DIRS[end]!, DIRS, `Priya faces ${DIRS[start]}. She ${words}. Which direction is she facing now?`, `A right turn is 90° clockwise, a left turn 90° anticlockwise, and turning about is 180°. She ends facing ${DIRS[end]}.`);
  },
  analogy(rng) {
    const a = int(rng, 2, 9);
    let b = int(rng, 2, 12);
    if (b === a) b = a + 1;
    const cube = rng() < 0.4 && b <= 9;
    const right = cube ? b ** 3 : b * b;
    return numeric(rng, right, plain, `${a} : ${cube ? a ** 3 : a * a} :: ${b} : ?`, cube ? `The second number is the cube of the first: ${b}³ = ${right}.` : `The second number is the square of the first: ${b}² = ${right}.`, cube ? b * b : 2 * b - 1);
  },
  oddOne(rng) {
    const primes = shuffled(rng, PRIMES).slice(0, 3);
    const odd = pick(rng, ODD_COMPOSITES);
    const at = int(rng, 0, 3);
    const opts = primes.map(String);
    opts.splice(at, 0, String(odd));
    return { prompt: "Which number is the odd one out?", options: opts as Q["options"], answer: at, explanation: `${primes.join(", ")} are prime; ${odd} is not (it has a factor other than 1 and itself).` };
  },
  ranking(rng) {
    const n = int(rng, 20, 60);
    const k = int(rng, 3, n - 3);
    return numeric(rng, n - k + 1, plain, `In a row of ${n} students, Arun is ${k}th from the left. What is his position from the right?`, `Position from right = total − position from left + 1 = ${n} − ${k} + 1 = ${n - k + 1}.`, 1);
  },
};

/* ───────────────────────────── reviewed sets ───────────────────────────── */
type Fixed = [prompt: string, options: [string, string, string, string], answer: number, explanation: string];

export const BLOOD_RELATIONS: Fixed[] = [
  ["Pointing to a man, Meena said, “His mother is the only daughter of my mother.” How is Meena related to the man?", ["Sister", "Mother", "Aunt", "Grandmother"], 1, "The only daughter of Meena's mother is Meena herself, so Meena is the man's mother."],
  ["A is B's brother. C is A's mother. D is C's father. How is B related to D?", ["Grandchild", "Son", "Nephew", "Brother"], 0, "D is the father of C, the mother of A and B, so B is D's grandchild."],
  ["Introducing a woman, Kumar said, “She is the wife of my mother's only son.” How is the woman related to Kumar?", ["Sister", "Mother", "Wife", "Cousin"], 2, "Kumar's mother's only son is Kumar, so the woman is his wife."],
  ["P is the father of Q. Q is the sister of R. S is the mother of P. How is R related to S?", ["Daughter", "Grandchild", "Niece", "Sister"], 1, "S is P's mother and P is R's father, so R is S's grandchild."],
  ["X is the son of Y. Y is the daughter of Z. How is Z related to X?", ["Father", "Uncle", "Grandparent", "Brother"], 2, "Z is the parent of X's mother Y, so Z is X's grandparent."],
  ["Pointing to a photo, Raj said, “He is the son of my father's only son.” Who is in the photo?", ["Raj's brother", "Raj's son", "Raj himself", "Raj's nephew"], 1, "Raj's father's only son is Raj, so the photo shows Raj's son."],
  ["M is the brother of N. N is the daughter of O. O is the husband of P. How is M related to P?", ["Brother", "Son", "Nephew", "Husband"], 1, "O and P are a couple and N is their daughter, so N's brother M is P's son."],
  ["A's mother is the sister of B's father. How is A related to B?", ["Brother", "Cousin", "Nephew", "Uncle"], 1, "A's mother and B's father are siblings, so A and B are cousins."],
  ["Lata is the daughter of Ravi's only sister. How is Ravi related to Lata?", ["Father", "Uncle (maternal)", "Brother", "Grandfather"], 1, "Ravi is the brother of Lata's mother, so he is her maternal uncle."],
  ["J is the wife of K. L is the brother of J. M is the son of K and J. How is L related to M?", ["Father", "Uncle (maternal)", "Brother", "Cousin"], 1, "L is the brother of M's mother J, so L is M's maternal uncle."],
];

export const SYLLOGISMS: Fixed[] = [
  ["Statements: All roses are flowers. All flowers are plants. Conclusion: All roses are plants. Does the conclusion follow?", ["Definitely follows", "Does not follow", "Follows only if some plants are roses", "Cannot be decided"], 0, "Roses ⊂ flowers ⊂ plants, so every rose is a plant."],
  ["Statements: Some pens are books. All books are bags. Conclusion: Some pens are bags. Does the conclusion follow?", ["Definitely follows", "Does not follow", "Only if all pens are books", "Cannot be decided"], 0, "The pens that are books are also bags, so some pens are bags."],
  ["Statements: All cats are animals. Some animals are dogs. Conclusion: Some cats are dogs. Does the conclusion follow?", ["Definitely follows", "Does not follow", "Follows only if all dogs are animals", "Is always false"], 1, "The dogs may be among the animals that are not cats, so the conclusion does not necessarily follow."],
  ["Statements: No chair is a table. All tables are wooden. Conclusion: No chair is wooden. Does the conclusion follow?", ["Definitely follows", "Does not follow", "Follows only for some chairs", "Is always true"], 1, "Chairs may still be wooden; the statements only say they are not tables."],
  ["Statements: All teachers are graduates. Some graduates are engineers. Conclusion: Some teachers are engineers. Does the conclusion follow?", ["Definitely follows", "Does not follow", "Follows only if all engineers are graduates", "Is always true"], 1, "The engineers may be graduates who are not teachers, so it does not necessarily follow."],
  ["Statements: All mangoes are fruits. No fruit is a vegetable. Conclusion: No mango is a vegetable. Does the conclusion follow?", ["Definitely follows", "Does not follow", "Follows only for ripe mangoes", "Cannot be decided"], 0, "Every mango is a fruit and no fruit is a vegetable, so no mango is a vegetable."],
  ["Statements: Some boys are players. Some players are singers. Conclusion: Some boys are singers. Does the conclusion follow?", ["Definitely follows", "Does not follow", "Is always false", "Follows only if all players sing"], 1, "Two ‘some’ statements give no definite link between boys and singers."],
  ["Statements: All birds can fly. A penguin is a bird. Conclusion: A penguin can fly. Within the logic of the statements, does the conclusion follow?", ["Definitely follows", "Does not follow", "Cannot be decided", "Is false"], 0, "Syllogisms are judged only on the statements given, however odd they sound. If all birds fly and a penguin is a bird, it follows."],
  ["Statements: No metal is a liquid. Mercury is a metal. Conclusion: Mercury is not a liquid. Within the logic of the statements, does the conclusion follow?", ["Definitely follows", "Does not follow", "Cannot be decided", "Is false"], 0, "Judged only on the statements: mercury is a metal and no metal is a liquid, so the conclusion follows."],
  ["Statements: Some doctors are writers. All writers are readers. Conclusion: Some readers are doctors. Does the conclusion follow?", ["Definitely follows", "Does not follow", "Only if all doctors write", "Cannot be decided"], 0, "The doctors who are writers are also readers, so some readers are doctors."],
];

export const fixedQ = ([prompt, options, answer, explanation]: Fixed): Q => ({ prompt, options, answer, explanation });

export const REASONING_TOPICS: Record<string, { title: string; kinds: string[]; fixed?: Fixed[] }> = {
  "r-series": { title: "Letter & number series", kinds: ["letterSeries"] },
  "r-coding": { title: "Coding–decoding", kinds: ["coding"] },
  "r-direction": { title: "Direction sense", kinds: ["directionDistance", "directionFacing"] },
  "r-analogy": { title: "Analogy & odd one out", kinds: ["analogy", "oddOne"] },
  "r-ranking": { title: "Ranking & order", kinds: ["ranking"] },
  "r-blood": { title: "Blood relations", kinds: [], fixed: BLOOD_RELATIONS },
  "r-syllogism": { title: "Syllogism", kinds: [], fixed: SYLLOGISMS },
};
