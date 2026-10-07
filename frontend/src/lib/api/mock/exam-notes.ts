import "server-only";
import type { NoteContent } from "@/lib/api/exam-prep-schemas";
import type { Q } from "./refresh-zone-content";

/*
 * Built-in study notes: what a student reads when neither the college's faculty nor the AI has written notes for a
 * topic. Quant, reasoning and English topics have hand-written notes below; fact-based topics (general awareness,
 * subjects) are summarised from their reviewed questions as key facts.
 */

type N = Omit<NoteContent, "example" | "formulas" | "mistakes" | "tips"> & Partial<Pick<NoteContent, "example" | "formulas" | "mistakes" | "tips">>;
const n = (x: N): NoteContent => ({ formulas: [], example: null, mistakes: [], tips: [], ...x });

export const BUILT_IN_NOTES: Record<string, NoteContent> = {
  /* ── quantitative aptitude ── */
  "q-percentage": n({
    summary: "Percentage means ‘per hundred’. Almost every quant section uses it: profit, interest, data interpretation and growth all reduce to percentage change.",
    keyPoints: ["x% of y = x × y ÷ 100, and x% of y equals y% of x.", "Percentage change = (new − old) ÷ old × 100. Always divide by the old value.", "A rise of r% then a fall of r% always gives a net loss of r²/100 %.", "Successive changes a% and b% combine to a + b + ab/100 % (use a minus sign for a fall)."],
    formulas: ["x% of y = xy/100", "% change = (new − old)/old × 100", "Net of a% and b% = a + b + ab/100"],
    example: { problem: "A price rises by 20% and then falls by 10%. What is the net change?", solution: "Net = 20 + (−10) + (20 × −10)/100 = 10 − 2 = 8% increase." },
    mistakes: ["Dividing by the new value instead of the old one.", "Adding successive percentages directly (20% + 10% is not 30%)."],
    tips: ["Learn fraction equivalents: 12.5% = 1/8, 16.67% = 1/6, 33.33% = 1/3, 37.5% = 3/8."],
  }),
  "q-profit-loss": n({
    summary: "Profit and loss compare the selling price (SP) with the cost price (CP); discount compares the selling price with the marked price (MP).",
    keyPoints: ["Profit = SP − CP; Loss = CP − SP.", "Profit % and loss % are always calculated on the cost price.", "Discount % is always calculated on the marked price.", "SP = MP × (100 − discount%) ÷ 100."],
    formulas: ["Profit % = (SP − CP)/CP × 100", "SP = CP × (100 + profit%)/100", "SP = MP × (100 − discount%)/100"],
    example: { problem: "An article costs ₹800 and is sold at 25% profit. Find the SP.", solution: "SP = 800 × 125/100 = ₹1,000." },
    mistakes: ["Calculating profit % on the selling price.", "Calculating discount on the cost price."],
    tips: ["Two successive discounts of a% and b% equal a + b − ab/100 %."],
  }),
  "q-interest": n({
    summary: "Simple interest (SI) is charged on the principal only; compound interest (CI) is charged on the principal plus interest already added.",
    keyPoints: ["SI = P × R × T ÷ 100.", "Amount with CI = P × (1 + R/100)ᵀ.", "For 2 years, CI − SI = P × (R/100)².", "With half-yearly compounding, halve the rate and double the number of periods."],
    formulas: ["SI = PRT/100", "A = P(1 + R/100)ᵀ", "CI = A − P"],
    example: { problem: "Find the CI on ₹5,000 at 10% for 2 years.", solution: "A = 5000 × 1.1 × 1.1 = 6,050, so CI = ₹1,050 (SI would be ₹1,000; the difference is 5000 × 0.01 = ₹50)." },
    mistakes: ["Forgetting to subtract the principal to get CI.", "Using the yearly rate for half-yearly compounding."],
  }),
  "q-time-work": n({
    summary: "Time and work questions treat the whole job as 1 unit (or as the LCM of the given days) and add up how much each person does in one day.",
    keyPoints: ["If A finishes a job in a days, A does 1/a of it per day.", "Together, A and B do 1/a + 1/b per day, so they take ab/(a + b) days.", "Take the total work as the LCM of the days to avoid fractions.", "Pipes and cisterns work the same way; an emptying pipe does negative work."],
    formulas: ["Together = ab/(a + b) days", "Work = rate × time"],
    example: { problem: "A takes 12 days and B 24 days. How long together?", solution: "Total work = 24 units. A does 2/day, B 1/day, together 3/day, so 24 ÷ 3 = 8 days." },
    mistakes: ["Adding the days instead of the daily rates."],
  }),
  "q-speed": n({
    summary: "Speed = distance ÷ time. Trains, boats and relative-speed questions are variations of this one relation.",
    keyPoints: ["To convert km/h to m/s, multiply by 5/18; to convert m/s to km/h, multiply by 18/5.", "A train crossing a pole covers its own length; crossing a platform covers its length plus the platform's.", "Objects moving in opposite directions: add the speeds. Same direction: subtract them.", "Average speed for equal distances at speeds x and y is 2xy/(x + y), not (x + y)/2."],
    formulas: ["Speed = distance/time", "km/h × 5/18 = m/s", "Average speed (equal distances) = 2xy/(x + y)"],
    example: { problem: "A 150 m train runs at 54 km/h. How long does it take to cross a 300 m platform?", solution: "54 km/h = 15 m/s. Distance = 150 + 300 = 450 m. Time = 450 ÷ 15 = 30 s." },
    mistakes: ["Mixing km/h with metres and seconds.", "Taking the simple average of two speeds."],
  }),
  "q-ratio": n({
    summary: "A ratio compares quantities by parts. Mixture and alligation questions find the ratio in which two kinds must be mixed to get a mean value.",
    keyPoints: ["To share an amount in the ratio a:b, one part = total ÷ (a + b).", "Multiplying or dividing both terms by the same number keeps the ratio unchanged.", "Alligation: (dearer − mean) : (mean − cheaper) gives cheaper : dearer.", "Mean price of a mixture = (a × p₁ + b × p₂) ÷ (a + b)."],
    formulas: ["Share = total × a/(a + b)", "Cheaper : Dearer = (d − m) : (m − c)"],
    example: { problem: "Rice at ₹40/kg and ₹60/kg is mixed to sell at ₹45/kg. In what ratio?", solution: "Cheaper : dearer = (60 − 45) : (45 − 40) = 15 : 5 = 3 : 1." },
  }),
  "q-average": n({
    summary: "Average = sum ÷ count. Ages questions use the fact that the gap between two people's ages never changes.",
    keyPoints: ["Sum = average × count; most questions are easier with sums than with averages.", "If one item is added and the average changes, new item = new sum − old sum.", "The average of consecutive numbers is the middle term.", "The difference between two people's ages stays the same every year."],
    formulas: ["Average = sum/n", "Added item = (n + 1) × new average − n × old average"],
    example: { problem: "The average of 5 numbers is 20. One number is removed and the average becomes 18. Which number was removed?", solution: "Old sum = 100, new sum = 4 × 18 = 72, removed = 28." },
  }),
  "q-number": n({
    summary: "Number system questions test divisibility, HCF and LCM, and working with sums and differences of numbers.",
    keyPoints: ["HCF × LCM = product of the two numbers.", "Divisible by 3 or 9: the sum of the digits is divisible by 3 or 9.", "Divisible by 11: the difference between the sums of alternate digits is 0 or a multiple of 11.", "Given the sum S and difference D of two numbers, the larger = (S + D)/2."],
    formulas: ["HCF × LCM = a × b", "Larger = (S + D)/2, smaller = (S − D)/2"],
    example: { problem: "The HCF of two numbers is 6 and their product is 432. Find the LCM.", solution: "LCM = 432 ÷ 6 = 72." },
  }),
  "q-series": n({
    summary: "Number series questions hide a rule: a constant difference, a constant ratio, squares or cubes, or a pattern in the differences.",
    keyPoints: ["Check differences first; if they are not constant, check the differences of the differences.", "Check ratios when the numbers grow quickly.", "Know squares up to 30 and cubes up to 15.", "Alternate-term patterns: two series interleaved."],
    tips: ["Write the differences under the series before guessing."],
    example: { problem: "2, 6, 12, 20, 30, ?", solution: "Differences are 4, 6, 8, 10, so the next difference is 12 and the answer is 42 (n × (n + 1))." },
  }),

  /* ── reasoning ── */
  "r-series": n({
    summary: "Letter series use the position of letters in the alphabet (A = 1 … Z = 26) and a fixed jump between terms.",
    keyPoints: ["Memorise positions with EJOTY: E = 5, J = 10, O = 15, T = 20, Y = 25.", "Opposite letters add up to 27 (A–Z, B–Y, C–X).", "Look for jumps that grow (+1, +2, +3 …) or alternate."],
    example: { problem: "C, F, I, L, ?", solution: "Each letter moves 3 places forward (3, 6, 9, 12), so the next is O (15)." },
  }),
  "r-coding": n({
    summary: "Coding–decoding hides a word by shifting letters, reversing them or replacing them with numbers. Find the rule from the example, then apply it.",
    keyPoints: ["Compare each letter with its code and note the shift (+1, −2, …).", "Check whether the word is reversed before or after shifting.", "Number codes often use alphabet positions or their sums."],
    example: { problem: "If CAT is coded DBU, what is DOG?", solution: "Each letter moves one place forward, so DOG becomes EPH." },
    mistakes: ["Assuming the same shift for every letter without checking all of them."],
  }),
  "r-direction": n({
    summary: "Direction questions trace a path of turns and distances. Draw it, with north at the top.",
    keyPoints: ["A right turn is 90° clockwise and a left turn 90° anticlockwise; turning about is 180°.", "Net east–west and north–south distances give the final position.", "Shortest distance = √(x² + y²) (Pythagoras).", "Learn common triples: 3-4-5, 6-8-10, 5-12-13, 8-15-17."],
    example: { problem: "Walk 4 km north, turn right, walk 3 km. How far from the start?", solution: "√(4² + 3²) = 5 km, to the north-east." },
  }),
  "r-analogy": n({
    summary: "Analogy and odd-one-out questions test the relation between a pair (squares, cubes, primes, categories) and apply it to another.",
    keyPoints: ["Common number relations: n², n³, n² + 1, n × (n + 1).", "Odd one out: look for primes, even/odd, squares, or a shared category.", "State the relation in words before choosing."],
    example: { problem: "4 : 64 :: 5 : ?", solution: "64 = 4³, so the answer is 5³ = 125." },
  }),
  "r-ranking": n({
    summary: "Ranking questions place people in a row or a merit list from both ends.",
    keyPoints: ["Total = rank from left + rank from right − 1.", "Rank from right = total − rank from left + 1.", "When two people swap places, use the changed positions to find the total."],
    example: { problem: "Ravi is 7th from the left and 12th from the right. How many are in the row?", solution: "7 + 12 − 1 = 18." },
  }),
  "r-blood": n({
    summary: "Blood relation questions describe family links in words. Draw a family tree: generations top to bottom, + for male and − for female.",
    keyPoints: ["‘Only son of my father’ or ‘only daughter of my mother’ usually means the speaker.", "Maternal relatives come through the mother, paternal through the father.", "Work from the end of the sentence back to the speaker."],
    example: { problem: "A is the son of B's only sister. How is B related to A?", solution: "B is the brother of A's mother, so B is A's maternal uncle." },
  }),
  "r-syllogism": n({
    summary: "Syllogism questions ask what must follow from given statements. Judge only from the statements, however strange they sound, and use Venn diagrams.",
    keyPoints: ["‘All A are B’ + ‘All B are C’ → ‘All A are C’.", "‘Some A are B’ + ‘All B are C’ → ‘Some A are C’.", "Two ‘some’ statements give no definite conclusion.", "A conclusion follows only if it is true in every possible diagram."],
    mistakes: ["Using real-world knowledge instead of the statements.", "Accepting a conclusion that is only possible, not certain."],
  }),

  /* ── English ── */
  "e-vocabulary": n({
    summary: "Vocabulary questions test the meaning of less common words used in bank, SSC, CAT and GRE-style papers.",
    keyPoints: ["Learn words in groups with similar meanings.", "Use roots: bene- (good), mal- (bad), -phile (lover), chrono- (time).", "Read one editorial a day and note five new words."],
    tips: ["Revise the word of the day in the English tab and use it in a sentence."],
  }),
  "e-synonyms": n({
    summary: "Pick the word closest in meaning. Eliminate options with the opposite sense or a different tone first.",
    keyPoints: ["Check the part of speech: a noun's synonym is a noun.", "Prefer the option that fits the same sentence without changing its meaning.", "Watch for antonyms placed as traps."],
    example: { problem: "Synonym of ‘frugal’?", solution: "Thrifty: careful with money. ‘Extravagant’ is the trap antonym." },
  }),
  "e-antonyms": n({
    summary: "Pick the word opposite in meaning. Find the core sense of the given word, then its opposite.",
    keyPoints: ["Prefixes often make opposites: un-, in-, dis-, mal-.", "Eliminate synonyms placed as traps.", "Check that the opposite is the same part of speech."],
    example: { problem: "Antonym of ‘conceal’?", solution: "Reveal." },
  }),
  "e-idioms": n({
    summary: "Idioms mean something different from their words. They are tested in SSC, bank and CLAT papers.",
    keyPoints: ["Learn the meaning with one example sentence.", "Group idioms by theme: secrets, difficulty, speed, time."],
    example: { problem: "‘Burn the midnight oil’ means…", solution: "To work or study late into the night." },
  }),
  "e-one-word": n({
    summary: "One-word substitution replaces a phrase with a single precise word.",
    keyPoints: ["Learn common endings: -cide (killing), -cracy (rule), -logy (study), -phobia (fear).", "Omni- means all: omnipresent, omniscient, omnipotent."],
    example: { problem: "One who knows everything?", solution: "Omniscient." },
  }),
  "e-error-spotting": n({
    summary: "Find the part of a sentence with a grammar error, or choose ‘No error’. Most errors are agreement, tense, prepositions or articles.",
    keyPoints: ["Subject–verb agreement: each, every, either and neither take singular verbs.", "With ‘along with’ or ‘as well as’, the verb follows the first subject.", "‘Since’ takes a point in time; ‘for’ takes a period.", "Uncountable nouns (furniture, information, advice) take no plural."],
    mistakes: ["Choosing a part only because it sounds unusual. Check the rule first."],
  }),
  "e-fill-blanks": n({
    summary: "Fill-in-the-blank questions test prepositions, tenses, agreement and fixed expressions in context.",
    keyPoints: ["Read the whole sentence for time clues before choosing a tense.", "Learn fixed pairs: good at, refrain from, insist on, prefer … to.", "‘It is high time’ is followed by the past tense."],
  }),
  "e-sentence-improvement": n({
    summary: "Replace the part in brackets with the correct form, or choose ‘No improvement’ if it is already right.",
    keyPoints: ["‘Did not’ or ‘does not’ is followed by the base verb.", "Finished past times (yesterday, last week) take the simple past, not the present perfect.", "Avoid double comparatives (‘more cleverer’) and redundancy (‘return back’)."],
  }),
};

/** Notes built from a topic's reviewed questions: each becomes one key fact. */
export function factNotes(title: string, questions: Q[], intro?: string): NoteContent {
  const facts = questions.slice(0, 15).map((q) => {
    const stem = q.prompt.replace(/[?…:]\s*$/, "").replace(/\s+/g, " ").trim();
    return `${stem}: ${q.options[q.answer]}.`.slice(0, 300);
  });
  return {
    summary: (intro ?? `Key facts for ${title}, taken from the reviewed question bank. Read them, then practise the topic.`).slice(0, 1200),
    keyPoints: facts.length ? facts : [`Practise ${title} questions to build up this topic.`],
    formulas: [],
    example: null,
    mistakes: [],
    tips: ["Revise these facts again the day after you study them, and once more a week later."],
  };
}
