import "server-only";
import type { Q } from "./refresh-zone-content";

/*
 * General awareness and subject questions for competitive and entrance exams. Only stable facts (no office holders,
 * rates or figures that change each year): those belong in the staff-curated Current Affairs feed instead.
 * Each row is written with the right answer first; options are shuffled when a round is built.
 */

type Row = [prompt: string, right: string, w1: string, w2: string, w3: string, explanation: string];
const toQ = ([prompt, right, w1, w2, w3, explanation]: Row): Q => ({ prompt, options: [right, w1, w2, w3], answer: 0, explanation });

const POLITY: Row[] = [
  ["The Constitution of India came into force on", "26 January 1950", "15 August 1947", "26 November 1949", "2 October 1950", "It was adopted on 26 November 1949 and came into force on 26 January 1950, Republic Day."],
  ["Fundamental Rights are listed in which Part of the Constitution?", "Part III", "Part II", "Part IV", "Part V", "Part III, Articles 12–35."],
  ["The Directive Principles of State Policy are in", "Part IV", "Part III", "Part IVA", "Part VI", "Part IV, Articles 36–51."],
  ["Article 21 guarantees", "Protection of life and personal liberty", "Equality before law", "Freedom of speech", "Right against exploitation", "Article 21: no person shall be deprived of life or personal liberty except by procedure established by law."],
  ["Dr B. R. Ambedkar called which Article the ‘heart and soul’ of the Constitution?", "Article 32", "Article 14", "Article 19", "Article 368", "Article 32, the right to constitutional remedies."],
  ["The President of India is elected by", "An electoral college of elected MPs and elected MLAs", "Direct vote of the people", "Members of the Lok Sabha only", "The Council of Ministers", "Elected members of both Houses of Parliament and of the State Legislative Assemblies (and Delhi and Puducherry)."],
  ["The maximum strength of the Rajya Sabha is", "250", "245", "552", "238", "Up to 238 elected members plus 12 nominated by the President."],
  ["The minimum age to become a member of the Lok Sabha is", "25 years", "21 years", "30 years", "35 years", "Article 84 sets 25 years for the Lok Sabha and 30 for the Rajya Sabha."],
  ["Who chaired the Drafting Committee of the Constituent Assembly?", "Dr B. R. Ambedkar", "Dr Rajendra Prasad", "Jawaharlal Nehru", "Sardar Patel", "Dr Ambedkar chaired the Drafting Committee; Dr Rajendra Prasad presided over the Assembly."],
  ["Fundamental Duties were added by the", "42nd Amendment (1976)", "44th Amendment (1978)", "73rd Amendment (1992)", "86th Amendment (2002)", "On the Swaran Singh Committee's advice, as Article 51A."],
  ["Article 356 deals with", "President's Rule in a State", "National Emergency", "Financial Emergency", "Amendment of the Constitution", "Article 352 is national emergency and Article 360 financial emergency."],
  ["The Governor of a State is appointed by the", "President", "Chief Minister", "Prime Minister", "Chief Justice of India", "Article 155."],
  ["A Money Bill can be introduced only in the", "Lok Sabha", "Rajya Sabha", "Either House", "A joint sitting", "Article 109: Money Bills originate in the Lok Sabha."],
  ["Constitutional status was given to Panchayati Raj by the", "73rd Amendment", "74th Amendment", "61st Amendment", "52nd Amendment", "The 73rd Amendment (1992) added Part IX; the 74th covers municipalities."],
  ["The Right to Education is provided under", "Article 21A", "Article 45", "Article 51A", "Article 30", "Added by the 86th Amendment (2002) for children aged 6 to 14."],
];

const HISTORY: Row[] = [
  ["The First Battle of Panipat (1526) was fought between", "Babur and Ibrahim Lodi", "Akbar and Hemu", "Babur and Rana Sanga", "Ahmad Shah Abdali and the Marathas", "Babur's victory founded the Mughal empire."],
  ["Gandhi's Dandi March took place in", "1930", "1920", "1942", "1919", "The Salt Satyagraha began on 12 March 1930."],
  ["The Indian National Congress was founded in", "1885", "1857", "1905", "1920", "Its first session was held in Bombay in December 1885."],
  ["The Jallianwala Bagh massacre happened in", "1919", "1909", "1922", "1930", "On 13 April 1919 in Amritsar."],
  ["The Quit India Movement was launched in", "1942", "1930", "1920", "1947", "On 8 August 1942, with the call ‘Do or Die’."],
  ["The Maurya empire was founded by", "Chandragupta Maurya", "Ashoka", "Bindusara", "Samudragupta", "Around 321 BCE, with Chanakya's guidance."],
  ["The Battle of Plassey was fought in", "1757", "1764", "1857", "1799", "Robert Clive defeated Siraj-ud-Daulah."],
  ["The Buddha attained enlightenment at", "Bodh Gaya", "Sarnath", "Lumbini", "Kushinagar", "Under the Bodhi tree; he gave his first sermon at Sarnath."],
  ["The Brihadeeswarar Temple at Thanjavur was built by", "Rajaraja Chola I", "Rajendra Chola I", "Narasimhavarman I", "Krishnadevaraya", "Completed around 1010 CE."],
  ["The Vellore Mutiny took place in", "1806", "1857", "1799", "1824", "Sepoys at Vellore Fort rose against the East India Company in July 1806."],
  ["The first Governor-General of independent India was", "Lord Mountbatten", "C. Rajagopalachari", "Lord Wavell", "Lord Canning", "C. Rajagopalachari succeeded him in 1948 as the first and only Indian Governor-General."],
  ["The Self-Respect Movement was started by", "E. V. Ramasamy (Periyar)", "C. N. Annadurai", "K. Kamaraj", "V. O. Chidambaram Pillai", "Periyar began it in 1925."],
  ["Which Harappan site had a dockyard?", "Lothal", "Mohenjo-daro", "Kalibangan", "Harappa", "Lothal in Gujarat."],
  ["The Partition of Bengal was carried out in", "1905", "1911", "1919", "1947", "By Lord Curzon; it was reversed in 1911."],
  ["‘Swaraj is my birthright and I shall have it’ was said by", "Bal Gangadhar Tilak", "Lala Lajpat Rai", "Gopal Krishna Gokhale", "Subhas Chandra Bose", "Tilak, a leader of the Extremists."],
];

const GEOGRAPHY: Row[] = [
  ["The longest river flowing within India is the", "Ganga", "Godavari", "Yamuna", "Brahmaputra", "The Ganga flows about 2,500 km; the Godavari is the longest peninsular river."],
  ["The largest Indian state by area is", "Rajasthan", "Madhya Pradesh", "Maharashtra", "Uttar Pradesh", "Rajasthan covers about 10.4% of India's area."],
  ["India's standard meridian (82.5° E) passes near", "Mirzapur", "Nagpur", "Bhopal", "Chennai", "Indian Standard Time is based on 82.5° E, near Mirzapur in Uttar Pradesh."],
  ["The Palk Strait separates India from", "Sri Lanka", "Maldives", "Myanmar", "Bangladesh", "It lies between Tamil Nadu and northern Sri Lanka."],
  ["Black (regur) soil is best suited for growing", "Cotton", "Tea", "Rice", "Coffee", "Black soil holds moisture well; it is also called black cotton soil."],
  ["Doddabetta, the highest peak of the Nilgiris, is in", "Tamil Nadu", "Kerala", "Karnataka", "Andhra Pradesh", "About 2,637 m, near Ooty."],
  ["The largest freshwater lake in India is", "Wular Lake", "Dal Lake", "Chilika Lake", "Loktak Lake", "Wular Lake in Jammu and Kashmir. Chilika is a brackish lagoon."],
  ["Indira Point, the southernmost tip of India, is on", "Great Nicobar", "Kanyakumari", "Rameswaram", "Little Andaman", "Kanyakumari is the southern tip of the mainland."],
  ["The Kaveri rises at", "Talakaveri in Kodagu, Karnataka", "Mahabaleshwar", "Amarkantak", "Nashik", "It flows through Karnataka and Tamil Nadu to the Bay of Bengal."],
  ["The Western Ghats are also known as the", "Sahyadri", "Aravalli", "Satpura", "Vindhya", "They run parallel to India's west coast."],
  ["The largest ocean is the", "Pacific Ocean", "Atlantic Ocean", "Indian Ocean", "Arctic Ocean", "It covers about a third of Earth's surface."],
  ["Day and night are caused by the Earth's", "Rotation", "Revolution", "Tilt only", "Distance from the Sun", "The Earth turns on its axis once in about 24 hours."],
  ["The Thar Desert lies mainly in", "Rajasthan", "Gujarat", "Punjab", "Haryana", "It extends into Pakistan."],
  ["Chilika Lake is in", "Odisha", "Andhra Pradesh", "West Bengal", "Tamil Nadu", "It is India's largest brackish-water lagoon."],
  ["The Tropic of Cancer passes through how many Indian states?", "8", "6", "10", "5", "Gujarat, Rajasthan, Madhya Pradesh, Chhattisgarh, Jharkhand, West Bengal, Tripura and Mizoram."],
];

const ECONOMY: Row[] = [
  ["The Reserve Bank of India was established in", "1935", "1947", "1949", "1969", "Under the RBI Act, 1934; it was nationalised in 1949."],
  ["GST was introduced in India on", "1 July 2017", "1 April 2017", "8 November 2016", "1 January 2018", "It replaced many indirect taxes."],
  ["NITI Aayog replaced the", "Planning Commission", "Finance Commission", "National Development Council", "Election Commission", "On 1 January 2015."],
  ["The repo rate is the rate at which", "The RBI lends to commercial banks", "Banks lend to customers", "Banks lend to each other overnight", "The RBI borrows from the government", "Reverse repo is the rate at which the RBI absorbs money from banks."],
  ["Fiscal deficit equals", "Total expenditure minus total receipts excluding borrowings", "Revenue expenditure minus revenue receipts", "Imports minus exports", "Total expenditure minus tax revenue", "It shows how much the government must borrow."],
  ["The ‘Blue Revolution’ is associated with", "Fisheries", "Milk", "Oilseeds", "Poultry", "White is milk, Yellow is oilseeds."],
  ["MGNREGA guarantees how many days of wage employment a year to a rural household?", "100", "150", "200", "365", "To adult members willing to do unskilled manual work."],
  ["SEBI regulates", "The securities market", "Insurance companies", "Banks", "Foreign trade", "IRDAI regulates insurance and the RBI regulates banks."],
  ["Fourteen major banks were nationalised in", "1969", "1980", "1991", "1955", "A further six were nationalised in 1980."],
  ["The Union Budget (Annual Financial Statement) is presented under", "Article 112", "Article 110", "Article 280", "Article 265", "Article 280 is the Finance Commission."],
  ["Which of these is a direct tax?", "Income tax", "GST", "Customs duty", "Excise duty", "A direct tax is paid by the person on whom it is levied."],
  ["CPI stands for", "Consumer Price Index", "Central Price Index", "Commodity Price Indicator", "Cost of Production Index", "It measures retail inflation."],
  ["The father of the Green Revolution in India is", "M. S. Swaminathan", "Verghese Kurien", "C. Subramaniam", "Norman Borlaug", "Verghese Kurien led the White Revolution; Borlaug led the Green Revolution worldwide."],
  ["The economic reforms of liberalisation began in India in", "1991", "1985", "1999", "1975", "The LPG reforms: liberalisation, privatisation and globalisation."],
  ["Which body recommends how tax revenue is shared between the Union and the States?", "Finance Commission", "NITI Aayog", "RBI", "GST Council", "A constitutional body under Article 280, set up every five years."],
];

const SCIENCE: Row[] = [
  ["The chemical symbol of sodium is", "Na", "So", "Sd", "S", "From the Latin ‘natrium’."],
  ["The SI unit of force is the", "Newton", "Joule", "Watt", "Pascal", "1 N = 1 kg·m/s²."],
  ["Which vitamin does the skin make in sunlight?", "Vitamin D", "Vitamin A", "Vitamin C", "Vitamin K", "UV-B light helps the skin make vitamin D."],
  ["The ‘powerhouse of the cell’ is the", "Mitochondrion", "Ribosome", "Nucleus", "Golgi body", "It makes ATP by cellular respiration."],
  ["The speed of light in a vacuum is about", "3 × 10⁸ m/s", "3 × 10⁶ m/s", "3 × 10⁵ m/s", "340 m/s", "340 m/s is roughly the speed of sound in air."],
  ["The largest planet in the Solar System is", "Jupiter", "Saturn", "Earth", "Neptune", "A gas giant more than 11 times Earth's diameter."],
  ["The gas found in the largest proportion in air is", "Nitrogen", "Oxygen", "Carbon dioxide", "Argon", "About 78% nitrogen and 21% oxygen."],
  ["Iron deficiency mainly causes", "Anaemia", "Rickets", "Scurvy", "Goitre", "Rickets is vitamin D, scurvy vitamin C and goitre iodine."],
  ["The universal donor blood group is", "O negative", "AB positive", "A positive", "B negative", "AB positive is the universal recipient."],
  ["The pH of pure water at 25 °C is", "7", "0", "14", "1", "Neutral: neither acidic nor basic."],
  ["Insulin is produced by the", "Pancreas", "Liver", "Thyroid", "Kidney", "By the beta cells of the islets of Langerhans."],
  ["The SI unit of electric current is the", "Ampere", "Volt", "Ohm", "Coulomb", "The volt is potential difference and the ohm is resistance."],
  ["The ozone layer protects life from", "Ultraviolet radiation", "Infrared radiation", "Radio waves", "Visible light", "It lies in the stratosphere."],
  ["An adult human body has how many bones?", "206", "300", "212", "196", "A newborn has about 300, many of which fuse."],
  ["Photosynthesis takes place in the", "Chloroplast", "Mitochondrion", "Nucleus", "Vacuole", "Chlorophyll in the chloroplast captures light energy."],
];

const TAMIL_NADU: Row[] = [
  ["Thirukkural was written by", "Thiruvalluvar", "Kambar", "Ilango Adigal", "Avvaiyar", "Ilango Adigal wrote Silappathikaram and Kambar wrote the Kamba Ramayanam."],
  ["How many couplets (kurals) are in the Thirukkural?", "1330", "1000", "1080", "133", "133 chapters of 10 couplets each."],
  ["The state animal of Tamil Nadu is the", "Nilgiri tahr", "Elephant", "Tiger", "Spotted deer", "A mountain goat of the Nilgiris and the Western Ghats."],
  ["The state bird of Tamil Nadu is the", "Emerald dove", "Peacock", "Kingfisher", "Myna", "The peacock is India's national bird."],
  ["The state tree of Tamil Nadu is the", "Palmyra palm", "Banyan", "Neem", "Coconut palm", "The palmyra (panai) palm."],
  ["The state flower of Tamil Nadu is the", "Gloriosa lily", "Lotus", "Jasmine", "Marigold", "Gloriosa superba."],
  ["The Mettur Dam is built across the", "Kaveri", "Vaigai", "Thamirabarani", "Palar", "It forms the Stanley Reservoir."],
  ["The monuments at Mamallapuram were built mainly by the", "Pallavas", "Cholas", "Pandyas", "Nayaks", "A UNESCO World Heritage Site from the 7th–8th centuries."],
  ["Madras State was renamed Tamil Nadu in", "1969", "1956", "1967", "1972", "Under Chief Minister C. N. Annadurai, effective 14 January 1969."],
  ["Pongal is celebrated at the start of the Tamil month of", "Thai", "Chithirai", "Aadi", "Karthigai", "The harvest festival of mid-January."],
  ["Kudankulam in Tirunelveli district is known for its", "Nuclear power plant", "Steel plant", "Space centre", "Salt pans", "Built with Russian collaboration."],
  ["Tamil was declared India's first classical language in", "2004", "1996", "2008", "2014", "The first language to receive the status."],
  ["The Meenakshi Amman Temple is in", "Madurai", "Thanjavur", "Kanchipuram", "Tiruchirappalli", "On the banks of the Vaigai."],
  ["The Gulf of Mannar Marine National Park lies between India and", "Sri Lanka", "Maldives", "Myanmar", "Indonesia", "Off the coast of Ramanathapuram and Thoothukudi."],
  ["Silappathikaram, one of the Five Great Epics of Tamil, was written by", "Ilango Adigal", "Seethalai Saathanar", "Thiruvalluvar", "Kambar", "Seethalai Saathanar wrote Manimekalai."],
];

const COMPUTER: Row[] = [
  ["CPU stands for", "Central Processing Unit", "Central Program Unit", "Computer Processing Unit", "Control Processing Unit", "It runs the instructions of a program."],
  ["One byte has", "8 bits", "4 bits", "16 bits", "10 bits", "A bit is a single 0 or 1."],
  ["Which memory loses its contents when power is switched off?", "RAM", "ROM", "Hard disk", "SSD", "RAM is volatile; ROM and storage keep data."],
  ["HTTP stands for", "HyperText Transfer Protocol", "High Transfer Text Protocol", "HyperText Transmission Program", "Host Transfer Text Protocol", "The protocol used to load web pages."],
  ["Which is an input device?", "Keyboard", "Monitor", "Printer", "Speaker", "The others are output devices."],
  ["An IPv4 address is made of", "32 bits", "64 bits", "128 bits", "16 bits", "IPv6 uses 128 bits."],
  ["A file ending in .xlsx is a", "Spreadsheet", "Presentation", "Image", "Compressed archive", "A Microsoft Excel workbook."],
  ["Phishing is", "Tricking people into revealing sensitive information by posing as a trusted source", "A type of computer virus that deletes files", "Backing up data to the cloud", "Speeding up a slow network", "Never share OTPs or passwords in reply to a message or call."],
  ["1 kilobyte (binary) equals", "1024 bytes", "1000 bytes", "512 bytes", "2048 bytes", "2¹⁰ = 1024."],
  ["Which of these is NOT an operating system?", "Python", "Linux", "Windows", "Android", "Python is a programming language."],
  ["URL stands for", "Uniform Resource Locator", "Universal Record Link", "Uniform Routing Language", "Unified Resource Library", "The address of a web page."],
  ["The binary form of the decimal number 10 is", "1010", "1100", "1001", "0110", "8 + 2 = 10, so 1010."],
];

const BANKING: Row[] = [
  ["NEFT stands for", "National Electronic Funds Transfer", "New Electronic Fund Transfer", "National Easy Funds Transaction", "Net Electronic Finance Transfer", "Settled in half-hourly batches."],
  ["The minimum amount for an RTGS transfer is", "₹2 lakh", "₹1 lakh", "₹50,000", "No minimum", "RTGS is meant for large-value transfers in real time."],
  ["CRR (Cash Reserve Ratio) is the share of deposits a bank must keep", "With the RBI as cash", "As gold in its own vault", "In government bonds", "As loans to farmers", "SLR is the share kept in liquid assets such as government securities."],
  ["KYC stands for", "Know Your Customer", "Keep Your Cash", "Know Your Credit", "Key Your Code", "Identity checks banks must run before opening accounts."],
  ["UPI was developed by", "NPCI", "RBI", "SBI", "SEBI", "National Payments Corporation of India."],
  ["The headquarters of the Reserve Bank of India is in", "Mumbai", "New Delhi", "Kolkata", "Chennai", "It moved from Kolkata to Mumbai in 1937."],
  ["NABARD mainly finances", "Agriculture and rural development", "Exports and imports", "Housing", "Small industries in cities", "National Bank for Agriculture and Rural Development."],
  ["DICGC insures bank deposits up to", "₹5 lakh per depositor per bank", "₹1 lakh per account", "₹10 lakh per depositor", "The full balance", "The limit was raised from ₹1 lakh to ₹5 lakh in 2020."],
  ["An IFSC code has how many characters?", "11", "9", "10", "12", "4 letters for the bank, a 0, then 6 characters for the branch."],
  ["‘Bancassurance’ means", "Banks selling insurance products", "Insurance of bank buildings", "Banks lending to insurers", "Insurance for bank loans only", "Banks act as a channel for insurance companies."],
  ["A cheque is valid for how long from its date?", "3 months", "6 months", "1 month", "1 year", "RBI rule since 2012."],
  ["A ‘Non-Performing Asset’ is a loan whose interest or instalment is overdue for more than", "90 days", "30 days", "60 days", "180 days", "Under RBI norms."],
];

const PHYSICS: Row[] = [
  ["The SI unit of work is the", "Joule", "Watt", "Newton", "Pascal", "1 J = 1 N × 1 m."],
  ["Acceleration due to gravity at the Earth's surface is about", "9.8 m/s²", "8.9 m/s²", "98 m/s²", "1.6 m/s²", "1.6 m/s² is the value on the Moon."],
  ["Ohm's law states that", "V = IR", "P = VI", "F = ma", "E = mc²", "At constant temperature, current is proportional to voltage."],
  ["Short-sightedness (myopia) is corrected with a", "Concave lens", "Convex lens", "Cylindrical lens", "Bifocal lens", "A diverging lens moves the image back onto the retina."],
  ["Sound travels fastest through", "Steel", "Water", "Air", "A vacuum", "Sound needs a medium and travels fastest in solids; it cannot travel in a vacuum."],
  ["The SI unit of power is the", "Watt", "Joule", "Volt", "Ampere", "1 W = 1 J/s."],
  ["Momentum is", "Mass × velocity", "Mass × acceleration", "Force × time ÷ mass", "Mass ÷ velocity", "p = mv, a vector quantity."],
  ["The kinetic energy of a body of mass m moving at speed v is", "½mv²", "mv", "mgh", "mv²", "mgh is potential energy."],
  ["The SI unit of frequency is the", "Hertz", "Decibel", "Metre", "Second", "1 Hz = one cycle per second."],
  ["A device that converts AC into DC is a", "Rectifier", "Transformer", "Generator", "Inverter", "An inverter does the opposite."],
  ["Optical fibres work on the principle of", "Total internal reflection", "Refraction only", "Diffraction", "Polarisation", "Light keeps reflecting inside the core."],
  ["Newton's third law says that", "Every action has an equal and opposite reaction", "Force equals mass times acceleration", "A body stays at rest unless a force acts", "Energy can neither be created nor destroyed", "The forces act on two different bodies."],
];

const CHEMISTRY: Row[] = [
  ["The atomic number of carbon is", "6", "12", "8", "14", "Six protons; 12 is its common mass number."],
  ["Avogadro's number is about", "6.022 × 10²³", "3 × 10⁸", "1.6 × 10⁻¹⁹", "9.1 × 10⁻³¹", "Particles in one mole."],
  ["The hardest natural substance is", "Diamond", "Graphite", "Quartz", "Iron", "Each carbon atom is bonded to four others."],
  ["A solution with pH less than 7 is", "Acidic", "Basic", "Neutral", "Saturated", "Above 7 is basic."],
  ["Common salt is", "Sodium chloride", "Sodium carbonate", "Calcium chloride", "Potassium chloride", "NaCl."],
  ["Which of these is a noble gas?", "Neon", "Nitrogen", "Oxygen", "Chlorine", "Group 18: He, Ne, Ar, Kr, Xe, Rn."],
  ["The formula of methane is", "CH₄", "C₂H₆", "CO₂", "CH₃OH", "The simplest alkane."],
  ["Isotopes of an element have the same", "Number of protons", "Number of neutrons", "Mass number", "Number of nucleons", "They differ in neutrons, so mass number differs."],
  ["A catalyst", "Changes the rate of a reaction without being used up", "Is always consumed in the reaction", "Changes the products formed", "Only slows reactions down", "It lowers the activation energy."],
  ["The most electronegative element is", "Fluorine", "Oxygen", "Chlorine", "Nitrogen", "Pauling value 3.98."],
  ["Baking soda is", "Sodium bicarbonate (NaHCO₃)", "Sodium carbonate (Na₂CO₃)", "Calcium carbonate (CaCO₃)", "Sodium hydroxide (NaOH)", "Washing soda is sodium carbonate."],
  ["Rusting of iron needs", "Both oxygen and moisture", "Only oxygen", "Only water", "Only carbon dioxide", "Iron oxidises in moist air."],
];

const BIOLOGY: Row[] = [
  ["The basic structural and functional unit of life is the", "Cell", "Tissue", "Organ", "Nucleus", "Proposed in the cell theory."],
  ["The double-helix model of DNA was proposed by", "Watson and Crick", "Mendel and Morgan", "Darwin and Wallace", "Hooke and Brown", "In 1953."],
  ["The functional unit of the kidney is the", "Nephron", "Neuron", "Alveolus", "Villus", "Each kidney has about a million nephrons."],
  ["Haemoglobin carries", "Oxygen", "Glucose", "Hormones", "Antibodies", "It is the iron-containing pigment in red blood cells."],
  ["A normal human body (somatic) cell has how many chromosomes?", "46", "23", "44", "48", "23 pairs; gametes have 23."],
  ["Which cells fight infection?", "White blood cells", "Red blood cells", "Platelets", "Nerve cells", "Platelets help blood clot."],
  ["The largest gland in the human body is the", "Liver", "Pancreas", "Thyroid", "Pituitary", "The pituitary is called the master gland."],
  ["Malaria is caused by", "Plasmodium", "A virus", "A bacterium", "Fungus", "A protozoan spread by the female Anopheles mosquito."],
  ["The enzyme in saliva that starts starch digestion is", "Salivary amylase", "Pepsin", "Trypsin", "Lipase", "Also called ptyalin."],
  ["Proteins are made at the", "Ribosomes", "Lysosomes", "Centrosomes", "Vacuoles", "Ribosomes translate mRNA."],
  ["The plant hormone that promotes cell elongation is", "Auxin", "Abscisic acid", "Ethylene", "Cytokinin", "Abscisic acid is a growth inhibitor."],
  ["Blood is pumped to the whole body by the", "Left ventricle", "Right ventricle", "Left atrium", "Right atrium", "It has the thickest wall."],
];

const MATHS: Row[] = [
  ["The derivative of x² is", "2x", "x", "x³/3", "2", "d/dx (xⁿ) = n·xⁿ⁻¹."],
  ["sin²θ + cos²θ equals", "1", "0", "2", "tan θ", "A Pythagorean identity."],
  ["log₁₀ 1000 equals", "3", "2", "10", "100", "10³ = 1000."],
  ["The sum of the first n natural numbers is", "n(n + 1)/2", "n²", "n(n − 1)/2", "2n + 1", "Gauss's formula."],
  ["∫ (1/x) dx equals", "ln|x| + C", "x²/2 + C", "−1/x² + C", "eˣ + C", "For x ≠ 0."],
  ["The determinant of the matrix [[2, 3], [1, 4]] is", "5", "11", "8", "−5", "2 × 4 − 3 × 1 = 5."],
  ["The probability of a head when a fair coin is tossed is", "1/2", "1", "1/4", "0", "Two equally likely outcomes."],
  ["The distance between (0, 0) and (3, 4) is", "5", "7", "1", "25", "√(3² + 4²) = 5."],
  ["In how many ways can 4 different books be arranged on a shelf?", "24", "16", "12", "4", "4! = 24."],
  ["The roots of x² − 5x + 6 = 0 are", "2 and 3", "−2 and −3", "1 and 6", "−1 and 6", "(x − 2)(x − 3) = 0."],
  ["tan 45° equals", "1", "0", "√3", "1/√3", "sin 45° = cos 45°."],
  ["The area of a circle of radius r is", "πr²", "2πr", "πd", "4πr²", "2πr is the circumference."],
];

const LEGAL: Row[] = [
  ["Principle: an offer can be withdrawn at any time before it is accepted. Facts: A offers to sell his bike to B on Monday, withdraws the offer on Tuesday morning, and B accepts on Tuesday evening. Is there a contract?", "No, the offer was withdrawn before acceptance", "Yes, B accepted within a day", "Yes, because A made the offer first", "Only if B pays the price", "Acceptance after a valid withdrawal creates no contract."],
  ["Principle: a person who enters another's land without permission commits trespass. Facts: C walks across D's farm without permission to take a shortcut. Has C committed trespass?", "Yes", "No, because no damage was done", "No, because it was only a shortcut", "Only if D had put up a fence", "Trespass to land needs no proof of damage."],
  ["Under Indian law, a contract with a minor is", "Void from the beginning", "Valid", "Voidable at the adult's option", "Valid if a guardian signs later", "Mohori Bibee v. Dharmodas Ghose (1903)."],
  ["‘Audi alteram partem’ means", "Hear the other side", "Let the buyer beware", "Guilty mind", "By the fact itself", "A rule of natural justice."],
  ["The writ of habeas corpus is issued to", "Produce a detained person before the court", "Stop a lower court from exceeding its jurisdiction", "Order a public official to do a duty", "Question by what authority a person holds office", "Literally ‘you may have the body’."],
  ["A tort is", "A civil wrong", "A crime against the State", "A breach of trust only", "A constitutional right", "Remedied mainly by damages."],
  ["‘Mens rea’ means", "Guilty mind", "Guilty act", "Burden of proof", "Without prejudice", "The guilty act is ‘actus reus’."],
  ["‘Ignorantia juris non excusat’ means", "Ignorance of the law is no excuse", "Ignorance of fact is an excuse", "No one is above the law", "The law does not concern trifles", "Everyone is presumed to know the law."],
  ["The age of majority in India under the Indian Majority Act, 1875 is", "18 years", "21 years", "16 years", "25 years", "Subject to some special laws."],
  ["The Preamble describes India as a", "Sovereign, Socialist, Secular, Democratic Republic", "Federal, Secular, Democratic Union", "Sovereign, Democratic Monarchy", "Socialist, Secular Federation", "‘Socialist’ and ‘Secular’ were added by the 42nd Amendment."],
  ["Principle: consent given under coercion is not free consent. Facts: X signs a sale deed after Y threatens to harm X's family. Is X's consent free?", "No", "Yes, because X signed", "Yes, if the price was fair", "Only if a witness was present", "Coercion makes a contract voidable at X's option."],
  ["‘Consideration’ in contract law means", "Something of value given in return for a promise", "Careful thought before signing", "A discount on the price", "The court's opinion", "No consideration, no contract (with some exceptions)."],
];

const PEDAGOGY: Row[] = [
  ["The ‘Zone of Proximal Development’ was proposed by", "Lev Vygotsky", "Jean Piaget", "B. F. Skinner", "Howard Gardner", "What a learner can do with help but not yet alone."],
  ["The stages of cognitive development were proposed by", "Jean Piaget", "Lev Vygotsky", "Lawrence Kohlberg", "Erik Erikson", "Sensorimotor, pre-operational, concrete operational and formal operational."],
  ["Piaget's concrete operational stage covers roughly the ages", "7 to 11 years", "0 to 2 years", "2 to 7 years", "11 years and above", "Children think logically about concrete objects."],
  ["The theory of multiple intelligences was given by", "Howard Gardner", "Alfred Binet", "Charles Spearman", "Daniel Goleman", "Linguistic, logical-mathematical, spatial and more."],
  ["The RTE Act, 2009 gives free and compulsory education to children aged", "6 to 14 years", "3 to 6 years", "5 to 15 years", "6 to 18 years", "Under Article 21A."],
  ["Operant conditioning is associated with", "B. F. Skinner", "Ivan Pavlov", "Edward Thorndike", "Albert Bandura", "Learning shaped by reinforcement."],
  ["Classical conditioning was demonstrated by", "Ivan Pavlov", "B. F. Skinner", "John Dewey", "Wolfgang Köhler", "With dogs salivating at a bell."],
  ["Formative assessment is mainly", "Assessment for learning, during teaching", "A final examination", "A selection test", "Assessment of the teacher", "It guides teaching while learning is under way."],
  ["Inclusive education means", "Children with diverse needs learning together in regular classrooms", "Separate schools for children with disabilities", "Only gifted children in special classes", "Teaching only in the mother tongue", "The school adapts to the learner."],
  ["The stages of moral development were proposed by", "Lawrence Kohlberg", "Jean Piaget", "Sigmund Freud", "Abraham Maslow", "Pre-conventional, conventional and post-conventional."],
  ["Learning by observing and imitating others is explained by", "Albert Bandura's social learning theory", "Pavlov's classical conditioning", "Thorndike's law of effect", "Piaget's schema theory", "The Bobo doll experiments."],
  ["Continuous and Comprehensive Evaluation covers", "Both scholastic and co-scholastic areas", "Only term-end exams", "Only attendance", "Only co-curricular activities", "It looks at the whole child."],
];

const RESEARCH: Row[] = [
  ["A hypothesis is", "A tentative statement to be tested", "A proven law", "The conclusion of a study", "A list of references", "Research tests it against data."],
  ["In which sampling does every member have an equal chance of being chosen?", "Simple random sampling", "Purposive sampling", "Quota sampling", "Snowball sampling", "Probability sampling avoids selection bias."],
  ["Plagiarism is", "Presenting another person's work or ideas as your own", "Citing sources correctly", "Peer review of a paper", "Collecting primary data", "Always acknowledge sources."],
  ["Primary data is", "Data collected first-hand by the researcher", "Data from published reports", "Data from a census only", "Data copied from another study", "Secondary data was collected by someone else."],
  ["The mean of 2, 4, 6, 8 and 10 is", "6", "5", "8", "30", "30 ÷ 5 = 6."],
  ["The median of 3, 7, 9, 12 and 15 is", "9", "7", "12", "9.2", "The middle value of the ordered list."],
  ["An abstract of a research paper is", "A brief summary of the whole study", "The list of references", "The raw data", "The acknowledgements", "Usually 150–300 words."],
  ["Which method suits qualitative research best?", "In-depth interview", "Structured multiple-choice test", "Census count", "Laboratory measurement", "It explores meanings and experiences."],
  ["Ex post facto research studies", "Possible causes after the effect has already occurred", "Effects of a variable the researcher manipulates", "Only future events", "Only laboratory animals", "The researcher cannot control the variables."],
  ["Bloom's taxonomy classifies", "Educational objectives", "Research designs", "Statistical tests", "Types of schools", "Remember, understand, apply, analyse, evaluate, create."],
  ["MOOC stands for", "Massive Open Online Course", "Modern Open Offline Class", "Multiple Online Objective Course", "Mass Online Operated College", "SWAYAM is India's MOOC platform."],
  ["Which of these is a barrier to communication?", "Noise", "Feedback", "Clarity", "Eye contact", "Physical noise or distraction blocks the message."],
];

export const GA_TOPICS: Record<string, { title: string; family: "General awareness" | "Subjects"; rows: Row[] }> = {
  "g-polity": { title: "Indian polity", family: "General awareness", rows: POLITY },
  "g-history": { title: "Indian history", family: "General awareness", rows: HISTORY },
  "g-geography": { title: "Geography", family: "General awareness", rows: GEOGRAPHY },
  "g-economy": { title: "Indian economy", family: "General awareness", rows: ECONOMY },
  "g-science": { title: "General science", family: "General awareness", rows: SCIENCE },
  "g-tamil-nadu": { title: "Tamil Nadu history & culture", family: "General awareness", rows: TAMIL_NADU },
  "g-computer": { title: "Computer awareness", family: "General awareness", rows: COMPUTER },
  "g-banking": { title: "Banking awareness", family: "General awareness", rows: BANKING },
  "s-physics": { title: "Physics", family: "Subjects", rows: PHYSICS },
  "s-chemistry": { title: "Chemistry", family: "Subjects", rows: CHEMISTRY },
  "s-biology": { title: "Biology", family: "Subjects", rows: BIOLOGY },
  "s-maths": { title: "Mathematics", family: "Subjects", rows: MATHS },
  "s-legal": { title: "Legal reasoning & legal GK", family: "Subjects", rows: LEGAL },
  "s-pedagogy": { title: "Child development & pedagogy", family: "Subjects", rows: PEDAGOGY },
  "s-research": { title: "Teaching & research aptitude", family: "Subjects", rows: RESEARCH },
};

export const gaQuestions = (topic: string): Q[] => (GA_TOPICS[topic]?.rows ?? []).map(toQ);
