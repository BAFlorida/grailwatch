/**
 * Starter universe across the target niches. `scenario`, `basePrice`, and
 * `grades` are hints for the synthetic-data generator only — they are not
 * stored in the database.
 *
 * Scenarios:
 *   accumulation — the quiet-accumulation pattern the tool exists to catch:
 *                  low AND high grades rising in lockstep, listings draining,
 *                  sold volume up, attention flat, grading activity ticking up.
 *   viral        — already public: high grades spike, lows lag, listings and
 *                  attention both surge. Must NOT trigger.
 *   drift        — gentle broad uptrend, nothing anomalous.
 *   flat         — noise around a flat baseline.
 */

export type SeedScenario = "accumulation" | "viral" | "drift" | "flat";

export interface SeedCard {
  key: string;
  name: string;
  franchise: "pokemon" | "yugioh" | "manga" | "dbz_carddass" | "soccer" | "other";
  setName?: string;
  cardNumber?: string;
  language?: string;
  category: "card" | "book" | "sealed";
  notes?: string;
  grader: "psa" | "cgc";
  /** grades tracked in the synthetic market data (top grade first) */
  grades: string[];
  /** anchor price for the top grade */
  basePrice: number;
  scenario: SeedScenario;
}

const PSA_CARD_GRADES = ["psa_10", "psa_9", "psa_7", "psa_4", "psa_2", "raw"];
const CGC_BOOK_GRADES = ["cgc_9_8", "cgc_9_2", "cgc_6_5", "cgc_4_0", "raw"];

export const SEED_CARDS: SeedCard[] = [
  // ── First-print English manga Vol. 1s (CGC-graded books) ──────────────────
  {
    key: "naruto-v1",
    name: "Naruto Vol. 1 (1st Printing)",
    franchise: "manga",
    setName: "VIZ Media, 2003",
    language: "English",
    category: "book",
    grader: "cgc",
    grades: CGC_BOOK_GRADES,
    basePrice: 1400,
    scenario: "viral",
    notes: "First English printing; already repriced by a big channel video in the synthetic data.",
  },
  {
    key: "one-piece-v1",
    name: "One Piece Vol. 1 (1st Printing)",
    franchise: "manga",
    setName: "VIZ Media, 2003",
    language: "English",
    category: "book",
    grader: "cgc",
    grades: CGC_BOOK_GRADES,
    basePrice: 900,
    scenario: "drift",
  },
  {
    key: "berserk-v1",
    name: "Berserk Vol. 1 (1st Printing)",
    franchise: "manga",
    setName: "Dark Horse, 2003",
    language: "English",
    category: "book",
    grader: "cgc",
    grades: CGC_BOOK_GRADES,
    basePrice: 1100,
    scenario: "accumulation",
    notes: "Thin-supply first print; synthetic quiet-accumulation pattern.",
  },
  {
    key: "fma-v1",
    name: "Fullmetal Alchemist Vol. 1 (1st Printing)",
    franchise: "manga",
    setName: "VIZ Media, 2005",
    language: "English",
    category: "book",
    grader: "cgc",
    grades: CGC_BOOK_GRADES,
    basePrice: 350,
    scenario: "drift",
  },
  {
    key: "death-note-v1",
    name: "Death Note Vol. 1 (1st Printing)",
    franchise: "manga",
    setName: "VIZ Media, 2005",
    language: "English",
    category: "book",
    grader: "cgc",
    grades: CGC_BOOK_GRADES,
    basePrice: 400,
    scenario: "flat",
  },
  {
    key: "slam-dunk-v1",
    name: "Slam Dunk Vol. 1 (1st Printing)",
    franchise: "manga",
    setName: "VIZ Media, 2008",
    language: "English",
    category: "book",
    grader: "cgc",
    grades: CGC_BOOK_GRADES,
    basePrice: 250,
    scenario: "flat",
  },

  // ── Dragon Ball Carddass 1988–1997 ─────────────────────────────────────────
  {
    key: "carddass-goku-prism",
    name: "Dragon Ball Carddass Hondan Part 1 No.1 Son Goku (Prism)",
    franchise: "dbz_carddass",
    setName: "Carddass Hondan Part 1 (1988)",
    cardNumber: "1",
    language: "Japanese",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 2500,
    scenario: "accumulation",
    notes: "Key prism; synthetic quiet-accumulation pattern.",
  },
  {
    key: "carddass-gohan",
    name: "Dragon Ball Carddass Hondan Part 1 No.18 Son Gohan",
    franchise: "dbz_carddass",
    setName: "Carddass Hondan Part 1 (1988)",
    cardNumber: "18",
    language: "Japanese",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 300,
    scenario: "flat",
  },
  {
    key: "carddass-vegeta-prism",
    name: "Dragon Ball Carddass Hondan Part 2 No.47 Vegeta (Prism)",
    franchise: "dbz_carddass",
    setName: "Carddass Hondan Part 2 (1989)",
    cardNumber: "47",
    language: "Japanese",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 950,
    scenario: "drift",
  },
  {
    key: "carddass-frieza-prism",
    name: "Dragon Ball Carddass Hondan Part 3 No.100 Frieza (Prism)",
    franchise: "dbz_carddass",
    setName: "Carddass Hondan Part 3 (1989)",
    cardNumber: "100",
    language: "Japanese",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 800,
    scenario: "flat",
  },
  {
    key: "carddass-sealed-box",
    name: "Dragon Ball Carddass Hondan Part 1 Sealed Box",
    franchise: "dbz_carddass",
    setName: "Carddass Hondan Part 1 (1988)",
    language: "Japanese",
    category: "sealed",
    grader: "psa",
    grades: ["raw"],
    basePrice: 6000,
    scenario: "flat",
  },

  // ── Pokémon CoroCoro-era / early Japanese promos ───────────────────────────
  {
    key: "corocoro-pikachu",
    name: "Pikachu CoroCoro Comic Promo #025",
    franchise: "pokemon",
    setName: "CoroCoro Promo (1996)",
    cardNumber: "025",
    language: "Japanese",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 3200,
    scenario: "accumulation",
    notes: "Early CoroCoro promo; synthetic quiet-accumulation pattern.",
  },
  {
    key: "corocoro-jigglypuff",
    name: "Jigglypuff CoroCoro Comic Promo #039",
    franchise: "pokemon",
    setName: "CoroCoro Promo (1996)",
    cardNumber: "039",
    language: "Japanese",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 1200,
    scenario: "drift",
  },
  {
    key: "topsun-charizard",
    name: "Charizard Topsun (Blue Back)",
    franchise: "pokemon",
    setName: "Topsun (1995)",
    language: "Japanese",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 5000,
    scenario: "viral",
    notes: "Synthetic already-viral pattern: highs spiking, attention spiking. Should NOT trigger.",
  },
  {
    key: "jr-rally-pikachu",
    name: "Pikachu JR East Rally Promo",
    franchise: "pokemon",
    setName: "JR Stamp Rally (1998)",
    language: "Japanese",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 1500,
    scenario: "flat",
  },
  {
    key: "vending-sheet-sealed",
    name: "Pokémon Japanese Vending Series 1 Sealed Sheet",
    franchise: "pokemon",
    setName: "Vending Series 1 (1998)",
    language: "Japanese",
    category: "sealed",
    grader: "psa",
    grades: ["raw"],
    basePrice: 800,
    scenario: "drift",
  },

  // ── Yu-Gi-Oh! tournament / prize cards ─────────────────────────────────────
  {
    key: "tp1-mechanicalchaser",
    name: "Mechanicalchaser (Tournament Pack 1)",
    franchise: "yugioh",
    setName: "Tournament Pack: 1st Season (2002)",
    cardNumber: "TP1-001",
    language: "English",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 600,
    scenario: "drift",
  },
  {
    key: "tp2-morphing-jar",
    name: "Morphing Jar (Tournament Pack 2)",
    franchise: "yugioh",
    setName: "Tournament Pack: 2nd Season (2002)",
    cardNumber: "TP2-001",
    language: "English",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 900,
    scenario: "flat",
  },
  {
    key: "sjc-cyber-stein",
    name: "Cyber-Stein (Shonen Jump Championship Prize)",
    franchise: "yugioh",
    setName: "SJC Prize (2004)",
    cardNumber: "SJC-EN001",
    language: "English",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 4500,
    scenario: "drift",
  },
  {
    key: "tp3-needle-worm",
    name: "Needle Worm (Tournament Pack 3)",
    franchise: "yugioh",
    setName: "Tournament Pack: 3rd Season (2002)",
    cardNumber: "TP3-002",
    language: "English",
    category: "card",
    grader: "psa",
    grades: PSA_CARD_GRADES,
    basePrice: 250,
    scenario: "flat",
  },
];
