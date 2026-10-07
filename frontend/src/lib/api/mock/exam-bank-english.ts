import "server-only";
import type { EnglishKind } from "@/lib/api/exam-prep-schemas";
import { shuffled, vocabularyRound, WORDS, type Q, type Rng } from "./refresh-zone-content";
import { textOptions } from "./exam-bank-reasoning";

/*
 * English for competitive exams: vocabulary, synonyms and antonyms, idioms, one-word substitution, error spotting,
 * fill in the blanks and sentence improvement. Every item here was written and checked by hand.
 */

/** word · a synonym · an antonym (the three columns never overlap between rows). */
export const TRIPLES: ReadonlyArray<readonly [string, string, string]> = [
  ["abundant", "plentiful", "scarce"],
  ["ancient", "old", "modern"],
  ["brave", "courageous", "cowardly"],
  ["brief", "short", "lengthy"],
  ["cautious", "careful", "reckless"],
  ["diligent", "industrious", "lazy"],
  ["eminent", "distinguished", "obscure"],
  ["expand", "enlarge", "contract"],
  ["fragile", "delicate", "sturdy"],
  ["frugal", "thrifty", "extravagant"],
  ["genuine", "authentic", "fake"],
  ["humble", "modest", "arrogant"],
  ["hostile", "unfriendly", "amicable"],
  ["immense", "huge", "tiny"],
  ["lucid", "clear", "vague"],
  ["obstinate", "stubborn", "flexible"],
  ["optimistic", "hopeful", "pessimistic"],
  ["prosperity", "affluence", "poverty"],
  ["scanty", "meagre", "ample"],
  ["tranquil", "calm", "turbulent"],
  ["victory", "triumph", "defeat"],
  ["vivid", "bright", "dull"],
  ["zeal", "enthusiasm", "apathy"],
  ["accelerate", "hasten", "decelerate"],
  ["benevolent", "kind", "malevolent"],
  ["conceal", "hide", "reveal"],
  ["artificial", "synthetic", "natural"],
  ["permanent", "lasting", "temporary"],
  ["admire", "respect", "despise"],
  ["innocent", "blameless", "guilty"],
];

export const IDIOMS: ReadonlyArray<readonly [string, string]> = [
  ["a piece of cake", "something very easy"],
  ["break the ice", "to start a conversation in an awkward situation"],
  ["burn the midnight oil", "to work or study late into the night"],
  ["call it a day", "to stop working for the day"],
  ["cost an arm and a leg", "to be very expensive"],
  ["hit the nail on the head", "to describe exactly what is causing a problem"],
  ["once in a blue moon", "very rarely"],
  ["spill the beans", "to reveal a secret"],
  ["under the weather", "feeling slightly ill"],
  ["a blessing in disguise", "something good that at first seemed bad"],
  ["bite the bullet", "to face something unpleasant with courage"],
  ["by hook or by crook", "by any means possible"],
  ["cry over spilt milk", "to regret something that cannot be undone"],
  ["in hot water", "in trouble"],
  ["keep one's fingers crossed", "to hope for a good result"],
  ["make a mountain out of a molehill", "to make a small problem seem much bigger"],
  ["a white elephant", "a costly possession that is of little use"],
  ["at the eleventh hour", "at the last possible moment"],
  ["beat around the bush", "to avoid talking about the main point"],
  ["turn a deaf ear", "to refuse to listen"],
  ["the ball is in your court", "it is your turn to decide or act"],
  ["through thick and thin", "in good times and bad times"],
  ["to add fuel to the fire", "to make a bad situation worse"],
  ["a bolt from the blue", "a complete surprise"],
  ["to see eye to eye", "to agree with someone"],
];

/** description · the single word for it. */
export const ONE_WORD: ReadonlyArray<readonly [string, string]> = [
  ["A person who does not believe in the existence of God", "atheist"],
  ["A life history written by the person himself or herself", "autobiography"],
  ["A person who can speak many languages", "polyglot"],
  ["One who is present everywhere", "omnipresent"],
  ["One who knows everything", "omniscient"],
  ["A government by the people", "democracy"],
  ["That which cannot be read", "illegible"],
  ["That which cannot be avoided", "inevitable"],
  ["A person who loves mankind", "philanthropist"],
  ["The study of the human mind and behaviour", "psychology"],
  ["A place where birds are kept", "aviary"],
  ["A person who walks in sleep", "somnambulist"],
  ["An animal that eats only plants", "herbivore"],
  ["A word that means the opposite of another word", "antonym"],
  ["A speech made without any preparation", "extempore"],
  ["One who is new to a profession or activity", "novice"],
  ["A disease that spreads over a very wide area or the whole world", "pandemic"],
  ["That which cannot be corrected", "incorrigible"],
  ["Killing of one's own brother", "fratricide"],
  ["Medicine that counteracts a poison", "antidote"],
  ["A person who looks at the bright side of things", "optimist"],
  ["The art of beautiful handwriting", "calligraphy"],
  ["A collection of poems", "anthology"],
  ["Rule by a few powerful people", "oligarchy"],
  ["One who is unable to pay debts", "insolvent"],
];

type Fixed = [prompt: string, options: [string, string, string, string], answer: number, explanation: string];

export const ERROR_SPOTTING: Fixed[] = [
  ["Find the part with an error: “Each of the students / have submitted / the assignment on time.”", ["Each of the students", "have submitted", "the assignment on time", "No error"], 1, "‘Each’ is singular, so it takes ‘has submitted’."],
  ["Find the part with an error: “Neither the teacher nor the students / was present / at the meeting.”", ["Neither the teacher nor the students", "was present", "at the meeting", "No error"], 1, "With ‘neither … nor’, the verb agrees with the nearer subject, ‘students’: ‘were present’."],
  ["Find the part with an error: “He is one of the best player / who have represented / the college.”", ["He is one of the best player", "who have represented", "the college", "No error"], 0, "‘One of the’ is followed by a plural noun: ‘one of the best players’."],
  ["Find the part with an error: “I have been living / in Chennai / since five years.”", ["I have been living", "in Chennai", "since five years", "No error"], 2, "Use ‘for’ with a period of time: ‘for five years’. ‘Since’ marks a point in time."],
  ["Find the part with an error: “The news / are very encouraging / for the farmers.”", ["The news", "are very encouraging", "for the farmers", "No error"], 1, "‘News’ is singular: ‘is very encouraging’."],
  ["Find the part with an error: “She is senior than me / by two years / in the office.”", ["She is senior than me", "by two years", "in the office", "No error"], 0, "‘Senior’ takes ‘to’, not ‘than’: ‘senior to me’."],
  ["Find the part with an error: “The furnitures / in this room / are very old.”", ["The furnitures", "in this room", "are very old", "No error"], 0, "‘Furniture’ is uncountable: ‘The furniture in this room is very old’."],
  ["Find the part with an error: “If I was you, / I would accept / the offer.”", ["If I was you,", "I would accept", "the offer", "No error"], 0, "In an imaginary condition use ‘were’: ‘If I were you’."],
  ["Find the part with an error: “He did not / attended the class / yesterday.”", ["He did not", "attended the class", "yesterday", "No error"], 1, "After ‘did not’, use the base form: ‘attend the class’."],
  ["Find the part with an error: “The committee has / submitted its report / to the principal.”", ["The committee has", "submitted its report", "to the principal", "No error"], 3, "‘Committee’ acting as one body takes a singular verb and ‘its’. The sentence is correct."],
  ["Find the part with an error: “Hardly had he reached the station / when the train / left.”", ["Hardly had he reached the station", "when the train", "left", "No error"], 3, "‘Hardly … when’ with the past perfect is correct."],
  ["Find the part with an error: “The price of vegetables / have gone up / this month.”", ["The price of vegetables", "have gone up", "this month", "No error"], 1, "The subject is ‘price’ (singular): ‘has gone up’."],
  ["Find the part with an error: “My friend and I / went to the market / to buy a umbrella.”", ["My friend and I", "went to the market", "to buy a umbrella", "No error"], 2, "Use ‘an’ before a vowel sound: ‘an umbrella’."],
  ["Find the part with an error: “Unless you do not work hard, / you will not / pass the exam.”", ["Unless you do not work hard,", "you will not", "pass the exam", "No error"], 0, "‘Unless’ already means ‘if not’: ‘Unless you work hard’."],
  ["Find the part with an error: “He prefers tea / than coffee / in the morning.”", ["He prefers tea", "than coffee", "in the morning", "No error"], 1, "‘Prefer’ takes ‘to’: ‘prefers tea to coffee’."],
  ["Find the part with an error: “The number of applicants / are increasing / every year.”", ["The number of applicants", "are increasing", "every year", "No error"], 1, "‘The number of’ takes a singular verb: ‘is increasing’."],
  ["Find the part with an error: “She has / returned back / from Delhi.”", ["She has", "returned back", "from Delhi", "No error"], 1, "‘Returned’ already means came back; ‘back’ is redundant."],
  ["Find the part with an error: “Ten kilometres / are a long distance / to walk.”", ["Ten kilometres", "are a long distance", "to walk", "No error"], 1, "A distance treated as one amount takes a singular verb: ‘is a long distance’."],
  ["Find the part with an error: “The teacher along with her students / were going / on a trip.”", ["The teacher along with her students", "were going", "on a trip", "No error"], 1, "With ‘along with’, the verb agrees with the first subject, ‘teacher’: ‘was going’."],
  ["Find the part with an error: “I look forward / to meet you / next week.”", ["I look forward", "to meet you", "next week", "No error"], 1, "In ‘look forward to’, ‘to’ is a preposition and takes an -ing form: ‘to meeting you’."],
];

export const FILL_BLANKS: Fixed[] = [
  ["She is good ___ mathematics.", ["at", "in", "on", "with"], 0, "We are good ‘at’ a subject or skill."],
  ["The train left ___ time.", ["in", "on", "at", "by"], 1, "‘On time’ means at the planned time."],
  ["He has been working here ___ 2019.", ["for", "from", "since", "by"], 2, "‘Since’ is used with a point in time."],
  ["Neither of the answers ___ correct.", ["are", "were", "is", "have been"], 2, "‘Neither of’ takes a singular verb."],
  ["I wish I ___ a bird.", ["am", "was", "were", "be"], 2, "Use ‘were’ for an unreal wish."],
  ["He is the ___ of the two brothers.", ["tallest", "taller", "most tall", "tall"], 1, "Use the comparative ‘taller’ when comparing two."],
  ["The meeting was called ___ due to heavy rain.", ["off", "on", "up", "out"], 0, "‘Call off’ means cancel."],
  ["She insisted ___ paying the bill.", ["to", "for", "on", "at"], 2, "‘Insist on’ + -ing."],
  ["The doctor advised him ___ smoking.", ["to quit", "quitting", "quit", "for quitting"], 0, "‘Advise someone to do something’."],
  ["By the time we reached, the film ___.", ["started", "has started", "had started", "starts"], 2, "The earlier of two past actions takes the past perfect."],
  ["He is junior ___ me in service.", ["than", "to", "from", "with"], 1, "‘Junior’ and ‘senior’ take ‘to’."],
  ["Please refrain ___ using mobile phones in the library.", ["to", "from", "of", "against"], 1, "‘Refrain from’ + -ing."],
  ["The police ___ investigating the case.", ["is", "was", "are", "has"], 2, "‘Police’ is a plural noun: ‘are investigating’."],
  ["It is high time we ___ for the station.", ["leave", "left", "will leave", "are leaving"], 1, "‘It is high time’ is followed by the past form."],
  ["She has a great liking ___ music.", ["to", "for", "on", "with"], 1, "‘A liking for’ something."],
  ["The judge acquitted him ___ the charge.", ["from", "of", "for", "with"], 1, "‘Acquit someone of’ a charge."],
  ["He succeeded ___ clearing the exam.", ["to", "for", "in", "at"], 2, "‘Succeed in’ + -ing."],
  ["If it rains tomorrow, we ___ the match.", ["will postpone", "would postpone", "postponed", "had postponed"], 0, "A real future condition: ‘if’ + present, ‘will’ + verb."],
  ["The sun ___ in the east.", ["rise", "rises", "is rising", "rose"], 1, "Universal truths use the simple present."],
  ["She did not come because she was ill, ___?", ["didn't she", "did she", "wasn't she", "was she"], 1, "A negative statement takes a positive tag: ‘did she?’."],
];

export const SENTENCE_IMPROVEMENT: Fixed[] = [
  ["Improve the part in brackets: He [did not knew] the answer.", ["did not know", "does not knew", "had not knew", "No improvement"], 0, "After ‘did not’ use the base form ‘know’."],
  ["Improve the part in brackets: She [is working here since] 2020.", ["has been working here since", "was working here since", "works here since", "No improvement"], 0, "An action continuing from a point in the past takes the present perfect continuous."],
  ["Improve the part in brackets: I am [looking forward to hear] from you.", ["looking forward to hearing", "looking forward for hearing", "look forward to hear", "No improvement"], 0, "‘Look forward to’ takes an -ing form."],
  ["Improve the part in brackets: No sooner did he arrive [when] the meeting began.", ["than", "then", "as", "No improvement"], 0, "‘No sooner’ pairs with ‘than’."],
  ["Improve the part in brackets: The book [who] I bought is very useful.", ["which", "whom", "whose", "No improvement"], 0, "Use ‘which’ (or ‘that’) for things."],
  ["Improve the part in brackets: He [is used to work] late at night.", ["is used to working", "used to working", "is use to work", "No improvement"], 0, "‘Be used to’ (accustomed to) takes an -ing form."],
  ["Improve the part in brackets: Each boy and each girl [were given] a prize.", ["was given", "are given", "have been given", "No improvement"], 0, "‘Each … and each …’ takes a singular verb."],
  ["Improve the part in brackets: She is [more cleverer] than her sister.", ["cleverer", "most clever", "more clever than", "No improvement"], 0, "Do not use ‘more’ with a comparative already ending in -er."],
  ["Improve the part in brackets: We [discussed about] the plan for two hours.", ["discussed", "discussed on", "discussed over", "No improvement"], 0, "‘Discuss’ takes a direct object; ‘about’ is not needed."],
  ["Improve the part in brackets: Though he is poor, [but] he is honest.", ["yet", "and", "so", "No improvement"], 0, "‘Though’ pairs with ‘yet’ (or nothing), not ‘but’."],
  ["Improve the part in brackets: The scenery of Ooty [is] beautiful.", ["are", "were", "have been", "No improvement"], 3, "‘Scenery’ is uncountable and singular, so ‘is’ is correct."],
  ["Improve the part in brackets: He [has gone] to Madurai yesterday.", ["went", "has went", "had go", "No improvement"], 0, "With a past time like ‘yesterday’, use the simple past."],
  ["Improve the part in brackets: [Let you and I go] together.", ["Let you and me go", "Let you and I going", "Let us and I go", "No improvement"], 0, "‘Let’ takes an object pronoun: ‘you and me’."],
  ["Improve the part in brackets: I [have seen] him last week.", ["saw", "had seen", "have saw", "No improvement"], 0, "A finished past time (‘last week’) takes the simple past."],
  ["Improve the part in brackets: She speaks English [very good].", ["very well", "much good", "very nicely good", "No improvement"], 0, "Use the adverb ‘well’ to describe how someone speaks."],
];

export const fixedQ = ([prompt, options, answer, explanation]: Fixed): Q => ({ prompt, options, answer, explanation });

/** The same four options in a fresh order, the answer index following its option. */
export function reorder(rng: Rng, q: Q): Q {
  const order = shuffled(rng, [0, 1, 2, 3]);
  return { ...q, options: order.map((k) => q.options[k]!) as Q["options"], answer: order.indexOf(q.answer) };
}
/** Error-spotting and improvement items keep "No error" / "No improvement" last, as exams print them. */
function reorderFirstThree(rng: Rng, q: Q): Q {
  const order = [...shuffled(rng, [0, 1, 2]), 3];
  return { ...q, options: order.map((k) => q.options[k]!) as Q["options"], answer: order.indexOf(q.answer) };
}

export const ENGLISH_INFO: Record<EnglishKind, { title: string; description: string }> = {
  vocabulary: { title: "Word meanings", description: "Advanced words seen in CAT, GRE-style and bank exams." },
  synonyms: { title: "Synonyms", description: "Pick the word closest in meaning." },
  antonyms: { title: "Antonyms", description: "Pick the word opposite in meaning." },
  idioms: { title: "Idioms & phrases", description: "What the expression really means." },
  "one-word": { title: "One-word substitution", description: "One word for a whole phrase." },
  "error-spotting": { title: "Error spotting", description: "Find the part of the sentence with a grammar error." },
  "fill-blanks": { title: "Fill in the blanks", description: "Prepositions, tenses and agreement in context." },
  "sentence-improvement": { title: "Sentence improvement", description: "Replace the part in brackets with the correct form." },
};

export function englishRound(kind: EnglishKind, n: number, rng: Rng): Q[] {
  switch (kind) {
    case "vocabulary":
      return vocabularyRound(n, rng);
    case "synonyms":
      return shuffled(rng, TRIPLES)
        .slice(0, n)
        .map(([w, syn]) => textOptions(rng, syn, TRIPLES.filter(([x]) => x !== w).map(([, other]) => other), `Choose the word closest in meaning to “${w}”.`, `${w} ≈ ${syn}.`));
    case "antonyms":
      return shuffled(rng, TRIPLES)
        .slice(0, n)
        .map(([w, , ant]) => textOptions(rng, ant, TRIPLES.filter(([x]) => x !== w).map(([, , other]) => other), `Choose the word opposite in meaning to “${w}”.`, `${w} ↔ ${ant}.`));
    case "idioms":
      return shuffled(rng, IDIOMS)
        .slice(0, n)
        .map(([idiom, meaning]) => textOptions(rng, meaning, IDIOMS.filter(([i]) => i !== idiom).map(([, m]) => m), `What does the idiom “${idiom}” mean?`, `“${idiom}” means ${meaning}.`));
    case "one-word":
      return shuffled(rng, ONE_WORD)
        .slice(0, n)
        .map(([desc, word]) => textOptions(rng, word, ONE_WORD.filter(([, w]) => w !== word).map(([, w]) => w), `One word for: ${desc}.`, `${desc}: ${word}.`));
    case "error-spotting":
      return shuffled(rng, ERROR_SPOTTING).slice(0, n).map((f) => reorderFirstThree(rng, fixedQ(f)));
    case "sentence-improvement":
      return shuffled(rng, SENTENCE_IMPROVEMENT).slice(0, n).map((f) => {
        const q = fixedQ(f);
        return q.answer === 3 ? q : reorderFirstThree(rng, q);
      });
    case "fill-blanks":
      return shuffled(rng, FILL_BLANKS).slice(0, n).map((f) => reorder(rng, fixedQ(f)));
  }
}

/** Sizes shown to the student so the bank is never over-claimed. */
export const ENGLISH_ITEMS: Record<EnglishKind, string> = {
  vocabulary: `${WORDS.length} words`,
  synonyms: `${TRIPLES.length} words`,
  antonyms: `${TRIPLES.length} words`,
  idioms: `${IDIOMS.length} idioms`,
  "one-word": `${ONE_WORD.length} items`,
  "error-spotting": `${ERROR_SPOTTING.length} sentences`,
  "fill-blanks": `${FILL_BLANKS.length} sentences`,
  "sentence-improvement": `${SENTENCE_IMPROVEMENT.length} sentences`,
};

export function wordOfDay(day: string): { word: string; meaning: string; synonym: string | null; antonym: string | null } {
  let h = 0;
  for (const c of day) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const t = TRIPLES[h % TRIPLES.length]!;
  const meaning = WORDS.find(([w]) => w === t[0])?.[1] ?? `Means the same as “${t[1]}”.`;
  return { word: t[0], meaning, synonym: t[1], antonym: t[2] };
}

