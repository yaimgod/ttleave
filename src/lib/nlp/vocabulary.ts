/**
 * Work-stress vocabulary with weighted scores (0-100).
 * Tailored for "boss event" inputs — general AFINN is not domain-specific enough.
 */
export const STRESS_VOCABULARY: Record<string, number> = {
  // Critical / terminal (80-100)
  fired: 95,
  terminated: 95,
  lawsuit: 90,
  suing: 90,
  harassment: 88,
  hostile: 85,
  screamed: 82,
  yelled: 80,
  threatened: 80,
  explosion: 78,
  rage: 76,
  furious: 76,
  outraged: 75,
  humiliated: 78,
  berated: 75,

  // High stress (55-74)
  angry: 70,
  shouted: 68,
  confronted: 65,
  deadline: 65,
  escalated: 63,
  overdue: 62,
  urgent: 60,
  critical: 60,
  blamed: 60,
  micromanage: 58,
  micromanaged: 58,
  demanding: 56,
  disappointed: 55,
  frustrated: 55,
  upset: 55,

  // Moderate (35-54)
  annoyed: 52,
  irritated: 50,
  pressured: 50,
  overwhelmed: 50,
  anxious: 48,
  worried: 45,
  concerned: 42,
  rushed: 40,
  pushed: 40,
  stressed: 45,
  exhausted: 45,
  burned: 42,
  burnout: 50,
  complaint: 40,
  complained: 38,
  issue: 35,

  // Low (10-34)
  reminder: 20,
  feedback: 15,
  comment: 12,
  question: 10,
  busy: 25,
  behind: 28,
  late: 25,
  overtime: 32,
  weekend: 20,
  meetings: 15,
  meeting: 10,
};

/**
 * Negation words — reverse / reduce stress when preceding a keyword.
 */
export const NEGATIONS = new Set([
  "not",
  "n't",
  "no",
  "never",
  "barely",
  "hardly",
  "wasn't",
  "isn't",
  "aren't",
  "didn't",
  "doesn't",
  "won't",
]);

/**
 * Intensifiers — amplify the next keyword's score.
 */
export const INTENSIFIERS: Record<string, number> = {
  very: 1.3,
  extremely: 1.5,
  incredibly: 1.5,
  really: 1.2,
  so: 1.15,
  absolutely: 1.4,
  totally: 1.3,
  completely: 1.4,
  super: 1.25,
};
